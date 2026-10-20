import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional, Tuple
from pymongo.database import Database
from app.analytics.baseline_calculator import compute_all_baselines, compute_metric_baseline
from app.analytics.deviation_analyzer import analyze_measurement_deviation
from app.analytics.rule_engine import evaluate_demonstration_rules
from app.analytics.trend_indicator import calculate_health_stability_index
from app.models.assessment import (
    MetricBaseline,
    MetricDeviation,
    MeasurementAssessment,
    HealthAssessmentResponse
)
from app.models.alert import AlertBase
from app.core.config import settings

logger = logging.getLogger(__name__)

class AnalyticsService:
    """
    Dedicated SwasthyaTwin Calculation Engine & Analytics Service.
    Encapsulates all personal baseline calculations, deviation analysis,
    explainable rule evaluations, composite stability indices, and data provenance.
    Never delegates health indicator calculations to React or frontend components.
    """

    @staticmethod
    def get_patient_observations(
        db: Database,
        patient_id: str,
        window_days: int = 30,
        include_simulated: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Retrieves patient observations within the historical baseline window.
        Explicitly isolates simulated data unless include_simulated=True is requested.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=window_days)
        query: Dict[str, Any] = {
            "patient_id": patient_id,
            "$or": [
                {"observed_at": {"$gte": cutoff}},
                {"timestamp": {"$gte": cutoff}}
            ]
        }
        if not include_simulated:
            query["$and"] = [
                {"data_kind": {"$ne": "simulated"}},
                {"data_tier": {"$ne": "simulated"}},
                {"is_synthetic": {"$ne": True}}
            ]

        return list(db.observations.find(query, {"_id": 0}))

    @staticmethod
    def calculate_baselines(
        db: Database,
        patient_id: str,
        window_days: Optional[int] = None,
        min_observations: Optional[int] = None,
        include_simulated: bool = False
    ) -> Dict[str, MetricBaseline]:
        """
        Calculates median baseline for each patient and measurement type.
        Handles missing values explicitly, excludes invalid observations,
        and enforces configurable minimum sample counts.
        """
        patient = db.patients.find_one({"patient_id": patient_id})
        days = window_days or (patient.get("baseline_window_days") if patient else settings.DEFAULT_BASELINE_DAYS) or 30
        min_obs = min_observations or settings.MIN_OBSERVATIONS_FOR_BASELINE

        observations = AnalyticsService.get_patient_observations(
            db=db,
            patient_id=patient_id,
            window_days=days,
            include_simulated=include_simulated
        )

        return compute_all_baselines(
            observations=observations,
            window_days=days,
            min_observations=min_obs,
            include_simulated=include_simulated
        )

    @staticmethod
    def evaluate_deviations(
        db: Database,
        patient_id: str,
        window_days: Optional[int] = None,
        include_simulated: bool = False
    ) -> Tuple[Dict[str, MetricDeviation], Dict[str, MetricBaseline]]:
        """
        Evaluates current biometric telemetry against personalized statistical baselines.
        Calculates absolute deviation, relative percentage deviation where mathematically meaningful,
        rolling trends, data quality, and freshness indicators.
        """
        baselines = AnalyticsService.calculate_baselines(
            db=db,
            patient_id=patient_id,
            window_days=window_days,
            include_simulated=include_simulated
        )

        # Retrieve distinct metric types logged for this patient
        distinct_types = db.observations.distinct("measurement_type", {"patient_id": patient_id})
        if not distinct_types:
            distinct_types = db.observations.distinct("metric_type", {"patient_id": patient_id})

        # Fetch all window observations for trend/persistence analysis
        patient = db.patients.find_one({"patient_id": patient_id})
        days = window_days or (patient.get("baseline_window_days") if patient else settings.DEFAULT_BASELINE_DAYS) or 30
        all_window_obs = AnalyticsService.get_patient_observations(
            db=db,
            patient_id=patient_id,
            window_days=days,
            include_simulated=include_simulated
        )

        # Group observations by metric
        obs_by_metric: Dict[str, List[Dict[str, Any]]] = {}
        for obs in all_window_obs:
            m = obs.get("measurement_type") or obs.get("metric_type")
            if m:
                obs_by_metric.setdefault(m, []).append(obs)

        # Extract latest reading per metric
        deviations: Dict[str, MetricDeviation] = {}
        for m in distinct_types:
            m_history = obs_by_metric.get(m, [])
            latest = None
            if m_history:
                latest = sorted(
                    m_history,
                    key=lambda x: x.get("observed_at") or x.get("timestamp") or datetime.min.replace(tzinfo=timezone.utc),
                    reverse=True
                )[0]
            else:
                latest = db.observations.find_one(
                    {"patient_id": patient_id, "$or": [{"measurement_type": m}, {"metric_type": m}]},
                    {"_id": 0},
                    sort=[("observed_at", -1), ("timestamp", -1)]
                )

            if not latest or latest.get("value") is None:
                continue

            base = baselines.get(m)
            dev = analyze_measurement_deviation(
                patient_id=patient_id,
                metric_type=m,
                current_obs=latest,
                baseline=base,
                recent_history=m_history,
                freshness_threshold_hours=settings.DATA_STALENESS_WARNING_HOURS
            )
            deviations[m] = dev

        # Run explainable rule engine
        alerts, triggered_rules = evaluate_demonstration_rules(
            patient_id=patient_id,
            deviations=deviations,
            recent_history_map=obs_by_metric
        )

        return deviations, baselines

    @staticmethod
    def get_measurement_assessments(
        db: Database,
        patient_id: str,
        window_days: Optional[int] = None,
        include_simulated: bool = False
    ) -> List[MeasurementAssessment]:
        """
        Returns full per-measurement assessment records conforming to Requirement F:
        patient_id, measurement_type, observed_value, personal_baseline, unit,
        absolute_deviation, relative_deviation_percent, trend_direction,
        data_quality, data_freshness, rule_id, rule_version, explanation,
        data_source, assessed_at, limitations.
        """
        deviations, baselines = AnalyticsService.evaluate_deviations(
            db=db,
            patient_id=patient_id,
            window_days=window_days,
            include_simulated=include_simulated
        )

        assessments: List[MeasurementAssessment] = []
        now = datetime.now(timezone.utc)

        for m_type, dev in deviations.items():
            assessments.append(MeasurementAssessment(
                patient_id=patient_id,
                measurement_type=m_type,
                observed_value=dev.current_value,
                personal_baseline=dev.personal_baseline or dev.baseline_mean,
                unit=dev.unit,
                absolute_deviation=dev.delta_absolute,
                relative_deviation_percent=dev.relative_deviation_percent,
                trend_direction=dev.trend_direction,
                data_quality=dev.data_quality,
                data_freshness=dev.data_freshness,
                rule_id=dev.rule_id,
                rule_version=dev.rule_version,
                explanation=dev.explanation or f"Observed {dev.current_value} {dev.unit} compared against baseline.",
                data_source=dev.data_source,
                assessed_at=dev.assessed_at or now,
                limitations=dev.limitations
            ))

        return assessments

    @staticmethod
    def calculate_composite_stability(
        patient_id: str,
        deviations: Dict[str, MetricDeviation]
    ) -> HealthAssessmentResponse:
        """
        Calculates the transparent, explainable Health Stability Trend Indicator (0-100).
        """
        return calculate_health_stability_index(
            patient_id=patient_id,
            deviations=deviations
        )
