import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional
from pymongo.database import Database
from app.analytics.baseline_calculator import compute_all_baselines
from app.analytics.anomaly_detector import detect_deviations, evaluate_alerts
from app.analytics.trend_indicator import calculate_health_stability_index
from app.models.assessment import HealthAssessmentResponse, DigitalTwinStateResponse
from app.repositories.assessment_repository import AssessmentRepository
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
            "$or": [
                {"observed_at": {"$gte": cutoff}},
                {"timestamp": {"$gte": cutoff}}
            ]
        }, {"_id": 0}))

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
            "$or": [
                {"observed_at": {"$gte": baseline_cutoff}},
                {"timestamp": {"$gte": baseline_cutoff}}
            ]
        }, {"_id": 0}))
        baselines = compute_all_baselines(baseline_obs, window_days=window_days)

        # Current snapshot (latest measurement per metric type)
        distinct_types = db.observations.distinct("measurement_type", {"patient_id": patient_id})
        if not distinct_types:
            distinct_types = db.observations.distinct("metric_type", {"patient_id": patient_id})

        current_metrics: Dict[str, Dict[str, Any]] = {}
        for m in distinct_types:
            latest = db.observations.find_one(
                {
                    "patient_id": patient_id,
                    "$or": [{"measurement_type": m}, {"metric_type": m}]
                },
                {"_id": 0},
                sort=[("observed_at", -1), ("timestamp", -1)]
            )
            if latest:
                # normalize field name for anomaly detector
                m_key = latest.get("measurement_type") or latest.get("metric_type")
                current_metrics[m_key] = latest

        deviations = detect_deviations(current_metrics, baselines)
        assessment = calculate_health_stability_index(patient_id, deviations)

        now = datetime.now(timezone.utc)
        asmt_id = f"asmt_{uuid.uuid4().hex[:12]}"

        # Record assessment in repository with required fields
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
            "methodology": "Z-score Euclidean distance penalty against personalized 30-day baseline distribution",
            "evidence": {
                "metric_count": len(deviations),
                "z_scores": {k: round(v.z_score, 2) for k, v in deviations.items()}
            },
            "limitations": "Non-diagnostic heuristic research indicator; not calibrated for acute emergency triage",
            "model_version": "v1.2.0",
            "deviations": {k: v.model_dump() for k, v in deviations.items()},
            "explainability_factors": [f.model_dump() for f in assessment.explainability_factors],
            "summary_message": assessment.summary_message,
            "safety_disclaimer": assessment.safety_disclaimer
        }
        repo.save_assessment(assess_doc)

        # Check and persist new alerts if any
        new_alerts = evaluate_alerts(patient_id, deviations)
        for al in new_alerts:
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
            snapshot_time=now,
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

        repo = AssessmentRepository(db)
        latest_doc = repo.get_latest_for_patient(patient_id)
        if latest_doc:
            latest_doc["_id"] = latest_doc.get("assessment_id", "")
        return latest_doc
