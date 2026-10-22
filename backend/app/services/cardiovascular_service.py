"""
SwasthyaTwin Cardiovascular Intelligence Service
Provides patient-scoped retrieval and calculations for heart-rate baseline,
chronological anomaly event streams, and mathematical explanations.
Enforces strict cross-patient isolation and database validation.
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from pymongo.database import Database

from app.analytics.hr_anomaly_engine import (
    HeartRateBaseline,
    HeartRateAnomalyRecord,
    HeartRateAnomalyExplanation,
    calculate_hr_baseline,
    evaluate_heart_rate_observation,
    analyze_patient_heart_rate_stream,
    explain_heart_rate_anomaly,
    parse_observation_timestamp,
    is_eligible_observation,
    DEFAULT_WINDOW_DAYS,
    DEFAULT_MIN_OBSERVATIONS,
    DEFAULT_Z_THRESHOLD
)

logger = logging.getLogger(__name__)


class CardiovascularService:
    @staticmethod
    def get_patient_hr_baseline(
        db: Database,
        patient_id: str,
        window_days: int = DEFAULT_WINDOW_DAYS,
        min_observations: int = DEFAULT_MIN_OBSERVATIONS
    ) -> HeartRateBaseline:
        """
        Retrieves recent validated heart-rate observations for a patient and computes their current baseline.
        """
        patient = db.patients.find_one({"patient_id": patient_id})
        if not patient:
            raise ValueError(f"Patient with ID '{patient_id}' does not exist.")

        cutoff = datetime.now(timezone.utc) - timedelta(days=window_days)
        query = {
            "patient_id": patient_id,
            "$or": [
                {"measurement_type": "heart_rate"},
                {"measurement_type": "resting_heart_rate"},
                {"metric_type": "heart_rate"},
                {"metric_type": "resting_heart_rate"}
            ],
            "$and": [
                {"data_kind": {"$ne": "simulated"}},
                {"data_tier": {"$ne": "simulated"}},
                {"is_synthetic": {"$ne": True}},
                {"validation_status": {"$nin": ["rejected", "invalid"]}}
            ]
        }

        raw_obs = list(db.observations.find(query, {"_id": 0}))
        return calculate_hr_baseline(
            patient_id=patient_id,
            observations=raw_obs,
            window_days=window_days,
            min_observations=min_observations
        )

    @staticmethod
    def get_patient_hr_anomalies(
        db: Database,
        patient_id: str,
        window_days: int = DEFAULT_WINDOW_DAYS,
        min_observations: int = DEFAULT_MIN_OBSERVATIONS,
        limit: int = 200,
        skip: int = 0,
        status_filter: Optional[str] = None,
        source_filter: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyzes patient heart-rate telemetry chronologically.
        Returns timeline records and paginated anomaly events with strict patient isolation.
        """
        patient = db.patients.find_one({"patient_id": patient_id})
        if not patient:
            raise ValueError(f"Patient with ID '{patient_id}' does not exist.")

        # Query all eligible HR records for this patient
        query = {
            "patient_id": patient_id,
            "$or": [
                {"measurement_type": "heart_rate"},
                {"measurement_type": "resting_heart_rate"},
                {"metric_type": "heart_rate"},
                {"metric_type": "resting_heart_rate"}
            ]
        }
        if source_filter and source_filter != "all":
            query["$or"] = [
                {"source_type": source_filter},
                {"source": source_filter}
            ]

        raw_obs = list(db.observations.find(query, {"_id": 0}).sort("observed_at", 1))

        # Run chronological zero-leakage evaluation
        records = analyze_patient_heart_rate_stream(
            patient_id=patient_id,
            observations=raw_obs,
            window_days=window_days,
            min_observations=min_observations
        )

        # Apply optional status filter
        filtered_records = records
        if status_filter and status_filter != "all":
            filtered_records = [r for r in records if r.status == status_filter]

        # Calculate current baseline
        current_baseline = calculate_hr_baseline(
            patient_id=patient_id,
            observations=raw_obs,
            window_days=window_days,
            min_observations=min_observations
        )

        # Operational metrics
        total_eval = len(records)
        flagged_count = sum(1 for r in records if r.status in ["unusual_high", "unusual_low"])
        review_count = sum(1 for r in records if r.status == "review_data_quality")
        normal_count = sum(1 for r in records if r.status == "within_personal_range")
        insufficient_count = sum(1 for r in records if r.status == "insufficient_data")

        # Paginate events (reverse chronological: newest first)
        events_desc = list(reversed(filtered_records))
        paginated_events = events_desc[skip: skip + limit]

        # Compact timeline series for charts
        timeline_series = [
            {
                "observation_id": r.observation_id,
                "timestamp": r.timestamp.isoformat(),
                "measured_heart_rate": r.measured_heart_rate,
                "baseline_median": r.baseline_median,
                "upper_corridor": round(r.baseline_median + 2.0 * r.variability_value, 1) if (r.baseline_median is not None and r.variability_value is not None) else None,
                "lower_corridor": round(r.baseline_median - 2.0 * r.variability_value, 1) if (r.baseline_median is not None and r.variability_value is not None) else None,
                "status": r.status,
                "robust_score": r.robust_score
            }
            for r in records
        ]

        return {
            "patient_id": patient_id,
            "current_baseline": current_baseline.model_dump(),
            "operational_metrics": {
                "total_observations_analyzed": total_eval,
                "flagged_anomalies_count": flagged_count,
                "data_quality_review_count": review_count,
                "within_personal_range_count": normal_count,
                "insufficient_data_count": insufficient_count,
                "flagged_rate_pct": round((flagged_count / total_eval) * 100.0, 1) if total_eval > 0 else 0.0
            },
            "timeline": timeline_series,
            "events": {
                "total": len(filtered_records),
                "skip": skip,
                "limit": limit,
                "items": [r.model_dump() for r in paginated_events]
            }
        }

    @staticmethod
    def explain_observation(
        db: Database,
        patient_id: str,
        observation_id: str,
        window_days: int = DEFAULT_WINDOW_DAYS,
        min_observations: int = DEFAULT_MIN_OBSERVATIONS
    ) -> HeartRateAnomalyExplanation:
        """
        Retrieves the exact target observation and prior historical context to generate
        a mathematical explanation breakdown.
        """
        patient = db.patients.find_one({"patient_id": patient_id})
        if not patient:
            raise ValueError(f"Patient with ID '{patient_id}' does not exist.")

        # Find target observation scoped to patient
        target = db.observations.find_one({
            "patient_id": patient_id,
            "$or": [
                {"observation_id": observation_id},
                {"id": observation_id}
            ]
        }, {"_id": 0})

        if not target:
            raise ValueError(f"Observation with ID '{observation_id}' not found for patient '{patient_id}'.")

        t_target = parse_observation_timestamp(target)

        # Retrieve prior observations
        prior_query = {
            "patient_id": patient_id,
            "$or": [
                {"measurement_type": "heart_rate"},
                {"measurement_type": "resting_heart_rate"},
                {"metric_type": "heart_rate"},
                {"metric_type": "resting_heart_rate"}
            ],
            "$and": [
                {"data_kind": {"$ne": "simulated"}},
                {"data_tier": {"$ne": "simulated"}},
                {"is_synthetic": {"$ne": True}},
                {"validation_status": {"$nin": ["rejected", "invalid"]}}
            ]
        }
        raw_priors = list(db.observations.find(prior_query, {"_id": 0}))
        strictly_prior = [o for o in raw_priors if parse_observation_timestamp(o) < t_target]

        return explain_heart_rate_anomaly(
            target_obs=target,
            prior_observations=strictly_prior,
            window_days=window_days,
            min_observations=min_observations
        )
