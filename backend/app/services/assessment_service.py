import uuid
import numpy as np
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
from pymongo.database import Database
from app.analytics.baseline_calculator import compute_all_baselines
from app.analytics.anomaly_detector import detect_deviations, evaluate_alerts
from app.analytics.trend_indicator import calculate_health_stability_index, CANONICAL_METRIC_WEIGHTS
from app.analytics.predictor import train_and_forecast_metric
from app.analytics.health_modules import (
    SleepIntelligenceModule,
    CardiovascularTrendModule,
    ActivityIntelligenceModule,
    BloodPressureTrendModule,
    PersonalizedAnomalyModule,
    FutureTrendForecastingModule
)
from app.models.assessment import (
    HealthAssessmentResponse,
    DigitalTwinStateResponse,
    MetricTrendSummary,
    MetricBaseline
)
from app.repositories.assessment_repository import AssessmentRepository
from app.services.alert_service import AlertService
from app.core.config import settings

class AssessmentService:
    @staticmethod
    def get_patient_baselines(
        db: Database,
        patient_id: str,
        window_days: Optional[int] = None,
        include_simulated: bool = False
    ) -> Dict[str, Any]:
        patient = db.patients.find_one({"patient_id": patient_id})
        if not patient:
            return {}

        days = window_days or patient.get("baseline_window_days", settings.DEFAULT_BASELINE_DAYS)
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)

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

        observations = list(db.observations.find(query, {"_id": 0}))

        baselines = compute_all_baselines(
            observations,
            window_days=days,
            min_observations=settings.MIN_OBSERVATIONS_FOR_BASELINE,
            include_simulated=include_simulated
        )
        return {k: v.model_dump() for k, v in baselines.items()}

    @staticmethod
    def get_measurement_assessments(
        db: Database,
        patient_id: str,
        window_days: Optional[int] = None,
        include_simulated: bool = False
    ) -> List[Dict[str, Any]]:
        from app.services.analytics_service import AnalyticsService
        assessments = AnalyticsService.get_measurement_assessments(
            db=db,
            patient_id=patient_id,
            window_days=window_days,
            include_simulated=include_simulated
        )
        return [a.model_dump() for a in assessments]

    @staticmethod
    def evaluate_twin_state(db: Database, patient_id: str) -> Optional[DigitalTwinStateResponse]:
        """
        Dynamically computes the complete digital twin state combining:
        - Latest available observations
        - Personal historical baselines
        - Recent trend slopes and volatility
        - Data freshness and quality metrics
        - Explainable stability indicators
        - Explicit missing-data warnings
        """
        patient = db.patients.find_one({"patient_id": patient_id})
        if not patient:
            return None

        window_days = patient.get("baseline_window_days", settings.DEFAULT_BASELINE_DAYS)
        now = datetime.now(timezone.utc)
        baseline_cutoff = now - timedelta(days=window_days)

        # 1. Fetch observations within baseline window (preventing future timestamps and excluding simulated data)
        all_window_obs = list(db.observations.find({
            "patient_id": patient_id,
            "data_kind": {"$ne": "simulated"},
            "data_tier": {"$ne": "simulated"},
            "is_synthetic": {"$ne": True},
            "$or": [
                {"observed_at": {"$gte": baseline_cutoff, "$lte": now}},
                {"timestamp": {"$gte": baseline_cutoff, "$lte": now}}
            ]
        }, {"_id": 0}))

        baselines = compute_all_baselines(
            all_window_obs,
            window_days=window_days,
            min_observations=settings.MIN_OBSERVATIONS_FOR_BASELINE
        )

        # 2. Extract latest valid observation per distinct metric type up to current time
        distinct_types = db.observations.distinct("measurement_type", {"patient_id": patient_id})
        if not distinct_types:
            distinct_types = db.observations.distinct("metric_type", {"patient_id": patient_id})

        current_metrics: Dict[str, Dict[str, Any]] = {}
        for m in distinct_types:
            latest = db.observations.find_one(
                {
                    "patient_id": patient_id,
                    "data_kind": {"$ne": "simulated"},
                    "data_tier": {"$ne": "simulated"},
                    "$and": [
                        {"$or": [{"measurement_type": m}, {"metric_type": m}]},
                        {"$or": [{"observed_at": {"$lte": now}}, {"timestamp": {"$lte": now}}]}
                    ]
                },
                {"_id": 0},
                sort=[("observed_at", -1), ("timestamp", -1)]
            )
            if latest:
                m_key = latest.get("measurement_type") or latest.get("metric_type")
                current_metrics[m_key] = latest

        # 3. Detect deviations against personal baselines
        deviations = detect_deviations(
            current_metrics=current_metrics,
            baselines=baselines,
            freshness_threshold_hours=settings.DATA_STALENESS_WARNING_HOURS
        )

        # 4. Compute composite & domain stability indicators
        assessment = calculate_health_stability_index(patient_id, deviations)

        # 5. Compute recent trends (slopes, volatility)
        trends_map: Dict[str, MetricTrendSummary] = {}
        for m in distinct_types:
            m_obs = [
                o for o in all_window_obs
                if (o.get("measurement_type") == m or o.get("metric_type") == m) and o.get("value") is not None
            ]
            if len(m_obs) >= 2:
                # Sort chronologically
                m_obs.sort(key=lambda x: x.get("observed_at") or x.get("timestamp") or now)
                values = [float(o["value"]) for o in m_obs]
                # Calculate 7-day trend slope if recent readings exist
                recent_vals = values[-7:] if len(values) >= 7 else values
                x = np.arange(len(recent_vals))
                slope, _ = np.polyfit(x, recent_vals, 1) if len(recent_vals) > 1 else (0.0, 0.0)
                volatility = float(np.std(values)) if len(values) > 1 else 0.0

                base_m = baselines.get(m)
                cur_dev = deviations.get(m)
                cur_val = cur_dev.current_value if cur_dev else values[-1]
                unit = cur_dev.unit if cur_dev else (m_obs[-1].get("unit", ""))

                trends_map[m] = MetricTrendSummary(
                    metric_type=m,
                    unit=unit,
                    current_value=round(cur_val, 1),
                    baseline_median=base_m.median if base_m else round(cur_val, 1),
                    baseline_iqr=base_m.iqr if base_m else 0.0,
                    delta_from_baseline=cur_dev.delta_absolute if cur_dev else 0.0,
                    slope_7d=round(float(slope), 3),
                    direction="improving" if (slope < 0 and m in ["heart_rate", "blood_pressure_systolic"]) or (slope > 0 and m in ["hrv_rmssd", "sleep_duration_hours"]) else ("worsening" if abs(slope) > 0.05 else "stable"),
                    volatility=round(volatility, 2),
                    sample_count_30d=len(values),
                    freshness_hours=cur_dev.freshness_hours if cur_dev and cur_dev.freshness_hours is not None else 0.0,
                    is_stale=cur_dev.is_stale if cur_dev else False
                )

        # 6. Data Quality & Missing Data Warnings
        missing_inputs = assessment.missing_inputs
        missing_warnings = []
        for m in missing_inputs:
            label = m.replace('_', ' ').title()
            missing_warnings.append(
                f"Missing {label}: No observations recorded in the past {window_days} days. "
                f"Excluded from stability index without penalizing baseline."
            )

        total_obs_count = len(all_window_obs)
        total_outliers = sum(b.outlier_count for b in baselines.values())
        outlier_pct = round((total_outliers / total_obs_count * 100.0), 1) if total_obs_count > 0 else 0.0

        # Overall freshness: min freshness hours across active metrics
        active_freshness = [d.freshness_hours for d in deviations.values() if d.freshness_hours is not None]
        overall_freshness_h = min(active_freshness) if active_freshness else None
        is_overall_stale = overall_freshness_h > settings.DATA_STALENESS_WARNING_HOURS if overall_freshness_h is not None else True

        if is_overall_stale:
            if overall_freshness_h is not None:
                missing_warnings.append(
                    f"Data Staleness Warning: Most recent telemetry is {overall_freshness_h:.0f} hours old "
                    f"(exceeds {settings.DATA_STALENESS_WARNING_HOURS}h threshold)."
                )
            else:
                missing_warnings.append(
                    f"Data Staleness Warning: No biometric telemetry recorded yet for baseline calculations."
                )

        data_quality = {
            "window_observations_count": total_obs_count,
            "tracked_metrics_count": len(deviations),
            "canonical_coverage_pct": round((len(deviations) / len(CANONICAL_METRIC_WEIGHTS)) * 100.0, 1),
            "outlier_reading_count": total_outliers,
            "outlier_rate_pct": outlier_pct,
            "sufficient_baseline_count": sum(1 for b in baselines.values() if b.is_sufficient),
            "freshness_status": "fresh" if not is_overall_stale else "stale"
        }

        # 7. Persist assessment record
        asmt_id = f"asmt_{uuid.uuid4().hex[:12]}"
        repo = AssessmentRepository(db)
        assess_doc = {
            "assessment_id": asmt_id,
            "patient_id": patient_id,
            "assessed_at": now,
            "calculated_at": now,
            "baseline_window": window_days,
            "indicator_type": "vitality_stability_index",
            "indicator_value": round(assessment.vitality_index, 1),
            "vitality_index": round(assessment.vitality_index, 1),
            "stability_status": assessment.stability_status,
            "methodology": "Normalized baseline Euclidean distance deduction against personal historical distribution",
            "evidence": {
                "active_metrics_count": len(deviations),
                "z_scores": {k: round(v.z_score, 2) for k, v in deviations.items()}
            },
            "limitations": "Non-diagnostic heuristic research indicator; not calibrated for acute emergency triage",
            "model_version": settings.RULE_ENGINE_VERSION,
            "deviations": {k: v.model_dump() for k, v in deviations.items()},
            "explainability_factors": [f.model_dump() for f in assessment.explainability_factors],
            "summary_message": assessment.summary_message,
            "safety_disclaimer": assessment.safety_disclaimer,
            "missing_inputs": missing_inputs,
            "component_contributions": assessment.component_contributions
        }
        repo.save_assessment(assess_doc)

        # 8. Check and persist alerts (avoid duplicate alerts for same observation and rule)
        new_alerts = evaluate_alerts(patient_id, deviations)
        for al in new_alerts:
            recent_unack = db.alerts.find_one({
                "patient_id": patient_id,
                "metric_type": al.metric_type,
                "is_acknowledged": False
            })
            exact_existing = db.alerts.find_one({
                "patient_id": patient_id,
                "metric_type": al.metric_type,
                "current_value": al.current_value,
                "timestamp": al.timestamp
            })
            if not recent_unack and not exact_existing:
                AlertService.create_alert(db, al)

        active_alert_count = db.alerts.count_documents({
            "patient_id": patient_id,
            "is_acknowledged": False
        })

        # Synchronize patient cohort record with latest calculated state
        db.patients.update_one(
            {"patient_id": patient_id},
            {
                "$set": {
                    "stability_status": assessment.stability_status,
                    "latest_vitality_index": round(assessment.vitality_index, 1),
                    "active_alerts_count": active_alert_count,
                    "updated_at": now
                }
            }
        )

        return DigitalTwinStateResponse(
            patient_id=patient_id,
            snapshot_time=now,
            baseline_window_days=window_days,
            metrics=deviations,
            baselines=baselines,
            trends=trends_map,
            overall_vitality=assessment.vitality_index,
            stability_status=assessment.stability_status,
            active_alert_count=active_alert_count,
            missing_inputs=missing_inputs,
            missing_data_warnings=missing_warnings,
            data_quality=data_quality,
            data_freshness_hours=overall_freshness_h,
            is_data_stale=is_overall_stale
        )

    @staticmethod
    def get_latest_assessment(db: Database, patient_id: str) -> Optional[Dict[str, Any]]:
        state = AssessmentService.evaluate_twin_state(db, patient_id)
        if not state:
            return None

        repo = AssessmentRepository(db)
        latest_doc = repo.get_latest_for_patient(patient_id)
        if latest_doc:
            latest_doc["_id"] = latest_doc.get("assessment_id", "")
        return latest_doc

    @staticmethod
    def get_patient_trends(db: Database, patient_id: str) -> Dict[str, Any]:
        """Returns structured trends, baseline corridors, and trajectories for visualization."""
        state = AssessmentService.evaluate_twin_state(db, patient_id)
        if not state:
            return {}

        return {
            "patient_id": patient_id,
            "evaluated_at": state.snapshot_time,
            "trends": {k: v.model_dump() for k, v in state.trends.items()},
            "baselines": {k: v.model_dump() for k, v in state.baselines.items()},
            "data_quality": state.data_quality,
            "missing_inputs": state.missing_inputs
        }

    @staticmethod
    def get_patient_predictions(
        db: Database,
        patient_id: str,
        metrics: Optional[List[str]] = None,
        horizon_days: int = 7
    ) -> Dict[str, Any]:
        """
        Executes time-series autoregressive forecasting with temporal leakage prevention
        and held-out validation against persistence baselines.
        """
        target_metrics = metrics or ["heart_rate", "blood_pressure_systolic", "sleep_duration_hours"]
        cutoff = datetime.now(timezone.utc) - timedelta(days=90)

        results: Dict[str, Any] = {}
        for m in target_metrics:
            query = {
                "patient_id": patient_id,
                "$and": [
                    {"$or": [{"measurement_type": m}, {"metric_type": m}]},
                    {"$or": [{"observed_at": {"$gte": cutoff}}, {"timestamp": {"$gte": cutoff}}]}
                ]
            }
            obs = list(db.observations.find(query, {"_id": 0}).sort("observed_at", 1))

            if not obs:
                # Fallback to query without date cutoff if sparse
                obs = list(db.observations.find({
                    "patient_id": patient_id,
                    "$or": [{"measurement_type": m}, {"metric_type": m}]
                }, {"_id": 0}).sort("observed_at", 1))

            unit = obs[0].get("unit", "") if obs else ""
            forecast = train_and_forecast_metric(
                metric_type=m,
                unit=unit,
                observations=obs,
                horizon_days=horizon_days
            )
            if forecast:
                results[m] = forecast.model_dump()


        return {
            "patient_id": patient_id,
            "horizon_days": horizon_days,
            "generated_at": datetime.now(timezone.utc),
            "forecasts": results
        }

    @staticmethod
    def get_patient_active_layers(db: Database, patient_id: str) -> Dict[str, Any]:
        """
        Calculates active data layers available for a patient based on verified observations.
        Ensures UI layers are ONLY enabled when relevant measurements actually exist.
        """
        cardio_count = db.observations.count_documents({
            "patient_id": patient_id,
            "measurement_type": {"$in": ["heart_rate", "resting_heart_rate", "hrv_rmssd"]}
        })
        sleep_count = db.observations.count_documents({
            "patient_id": patient_id,
            "measurement_type": {"$in": ["sleep_duration_hours", "sleep_duration"]}
        })
        activity_count = db.observations.count_documents({
            "patient_id": patient_id,
            "measurement_type": "daily_steps"
        })
        bp_count = db.observations.count_documents({
            "patient_id": patient_id,
            "measurement_type": {"$in": ["blood_pressure_systolic", "systolic_bp"]}
        })
        total_obs = db.observations.count_documents({"patient_id": patient_id})

        return {
            "patient_id": patient_id,
            "layers": {
                "cardiovascular": {
                    "is_active": cardio_count > 0,
                    "observation_count": cardio_count,
                    "label": "Cardiovascular Core",
                    "metrics": ["heart_rate", "hrv_rmssd"]
                },
                "sleep": {
                    "is_active": sleep_count > 0,
                    "observation_count": sleep_count,
                    "label": "Sleep Intelligence",
                    "metrics": ["sleep_duration_hours"]
                },
                "activity": {
                    "is_active": activity_count > 0,
                    "observation_count": activity_count,
                    "label": "Activity & Kinetic",
                    "metrics": ["daily_steps"]
                },
                "blood_pressure": {
                    "is_active": bp_count > 0,
                    "observation_count": bp_count,
                    "label": "Blood Pressure & Hemodynamics",
                    "metrics": ["blood_pressure_systolic", "blood_pressure_diastolic"]
                },
                "anomalies": {
                    "is_active": total_obs >= 14,
                    "observation_count": total_obs,
                    "label": "Personalized Anomaly Detection",
                    "requires_minimum": 14
                },
                "forecast": {
                    "is_active": (cardio_count >= 14 or activity_count >= 14),
                    "observation_count": max(cardio_count, activity_count),
                    "label": "Future Trend Forecasting",
                    "requires_minimum": 14
                }
            }
        }

    @staticmethod
    def get_patient_health_modules(db: Database, patient_id: str) -> Dict[str, Any]:
        """
        Evaluates all six health modules (A-F) for a patient from real MongoDB observations.
        """
        all_obs = list(db.observations.find({"patient_id": patient_id}, {"_id": 0}).sort("observed_at", 1))

        sleep_summary = SleepIntelligenceModule.evaluate(patient_id, all_obs)
        cardio_summary = CardiovascularTrendModule.evaluate(patient_id, all_obs)
        activity_summary = ActivityIntelligenceModule.evaluate(patient_id, all_obs)
        bp_summary = BloodPressureTrendModule.evaluate(patient_id, all_obs)
        anomaly_summary = PersonalizedAnomalyModule.evaluate(patient_id, all_obs)
        forecast_summary = FutureTrendForecastingModule.forecast(patient_id, "heart_rate", "bpm", all_obs, horizon_days=7)

        return {
            "patient_id": patient_id,
            "evaluated_at": datetime.now(timezone.utc),
            "modules": {
                "sleep_intelligence": sleep_summary.model_dump(),
                "cardiovascular_trends": cardio_summary.model_dump(),
                "activity_intelligence": activity_summary.model_dump(),
                "blood_pressure_tracking": bp_summary.model_dump(),
                "personalized_anomalies": anomaly_summary.model_dump(),
                "trend_forecasting": forecast_summary.model_dump()
            }
        }
