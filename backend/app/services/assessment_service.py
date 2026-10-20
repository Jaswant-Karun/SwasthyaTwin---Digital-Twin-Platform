from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
from pymongo.database import Database
from app.analytics.baseline_calculator import compute_all_baselines
from app.analytics.anomaly_detector import detect_deviations, evaluate_alerts
from app.analytics.trend_indicator import calculate_health_stability_index
from app.models.assessment import HealthAssessmentResponse, DigitalTwinStateResponse
from app.services.alert_service import AlertService

class AssessmentService:
    @staticmethod
    def get_patient_baselines(db: Database, patient_id: str, window_days: Optional[int] = None) -> Dict[str, Any]:
        patient = db.patients.find_one({"patient_id": patient_id})
        if not patient:
            return {}

        days = window_days or patient.get("baseline_window_days", 30)
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)

        observations = list(db.observations.find({
            "patient_id": patient_id,
            "timestamp": {"$gte": cutoff}
        }))

        baselines = compute_all_baselines(observations, window_days=days)
        return {k: v.model_dump() for k, v in baselines.items()}

    @staticmethod
    def evaluate_twin_state(db: Database, patient_id: str) -> Optional[DigitalTwinStateResponse]:
        patient = db.patients.find_one({"patient_id": patient_id})
        if not patient:
            return None

        window_days = patient.get("baseline_window_days", 30)
        baseline_cutoff = datetime.now(timezone.utc) - timedelta(days=window_days)

        # Baseline observations (30 days)
        baseline_obs = list(db.observations.find({
            "patient_id": patient_id,
            "timestamp": {"$gte": baseline_cutoff}
        }))
        baselines = compute_all_baselines(baseline_obs, window_days=window_days)

        # Current snapshot (latest measurement per metric type)
        distinct_metrics = db.observations.distinct("metric_type", {"patient_id": patient_id})
        current_metrics: Dict[str, Dict[str, Any]] = {}
        for m in distinct_metrics:
            latest = db.observations.find_one(
                {"patient_id": patient_id, "metric_type": m},
                sort=[("timestamp", -1)]
            )
            if latest:
                current_metrics[m] = latest

        deviations = detect_deviations(current_metrics, baselines)
        assessment = calculate_health_stability_index(patient_id, deviations)

        # Record assessment in history
        assess_doc = assessment.model_dump()
        assess_doc["deviations"] = {k: v.model_dump() for k, v in deviations.items()}
        assess_doc["explainability_factors"] = [f.model_dump() for f in assessment.explainability_factors]
        db.health_assessments.insert_one(assess_doc)

        # Check and persist new alerts if any
        new_alerts = evaluate_alerts(patient_id, deviations)
        for al in new_alerts:
            # Avoid duplicate unacknowledged alert for same metric within 24h
            recent = db.alerts.find_one({
                "patient_id": patient_id,
                "metric_type": al.metric_type,
                "is_acknowledged": False
            })
            if not recent:
                AlertService.create_alert(db, al)

        active_alert_count = db.alerts.count_documents({
            "patient_id": patient_id,
            "is_acknowledged": False
        })

        return DigitalTwinStateResponse(
            patient_id=patient_id,
            snapshot_time=datetime.now(timezone.utc),
            baseline_window_days=window_days,
            metrics=deviations,
            overall_vitality=assessment.vitality_index,
            stability_status=assessment.stability_status,
            active_alert_count=active_alert_count
        )

    @staticmethod
    def get_latest_assessment(db: Database, patient_id: str) -> Optional[Dict[str, Any]]:
        # Evaluate fresh state to reflect latest incoming telemetry
        state = AssessmentService.evaluate_twin_state(db, patient_id)
        if not state:
            return None

        latest_doc = db.health_assessments.find_one(
            {"patient_id": patient_id},
            sort=[("calculated_at", -1)]
        )
        if latest_doc:
            latest_doc["_id"] = str(latest_doc["_id"])
        return latest_doc
