import logging
from typing import Dict, Any, Optional
from pymongo.database import Database
from app.services.assessment_service import AssessmentService
from app.analytics.explanation_generator import (
    build_metric_explanation,
    build_baseline_explanation,
    build_trend_explanation,
    build_alert_explanation,
    build_simulation_explanation
)
from app.analytics.twin_simulation_engine import run_twin_simulation
from app.models.explanation import (
    CalculationExplanation,
    PatientExplanationsResponse,
    SimulationExplanationRequest
)
from app.models.simulation import InterventionParams

logger = logging.getLogger(__name__)

class ExplanationService:
    @staticmethod
    def get_patient_explanations(
        db: Database,
        patient_id: str
    ) -> Optional[PatientExplanationsResponse]:
        """
        Dynamically computes transparent, explainable calculation metadata
        and worked numerical examples for all health metrics, baselines,
        trend indicators, alerts, and baseline simulations for the given patient.
        """
        patient = db.patients.find_one({"patient_id": patient_id})
        if not patient:
            return None

        # 1. Fetch current digital twin state and assessment
        twin_state = AssessmentService.evaluate_twin_state(db, patient_id)
        if not twin_state:
            return None

        assessment = AssessmentService.get_latest_assessment(db, patient_id)

        # 2. Build metric explanations
        metrics_expl: Dict[str, CalculationExplanation] = {}
        all_metric_types = [
            "heart_rate",
            "blood_pressure_systolic",
            "blood_pressure_diastolic",
            "respiratory_rate",
            "sleep_duration_hours",
            "daily_steps",
            "fasting_blood_glucose",
            "hrv_rmssd",
            "spo2"
        ]
        # Include any tracked metric present in twin_state
        for m in twin_state.metrics.keys():
            if m not in all_metric_types:
                all_metric_types.append(m)

        for m in all_metric_types:
            dev = twin_state.metrics.get(m)
            base = twin_state.baselines.get(m)
            metrics_expl[m] = build_metric_explanation(
                patient_id=patient_id,
                metric_type=m,
                deviation=dev,
                baseline=base,
                patient=patient
            )

        # 3. Build baseline explanations
        baselines_expl: Dict[str, CalculationExplanation] = {}
        for m in all_metric_types:
            base = twin_state.baselines.get(m)
            baselines_expl[m] = build_baseline_explanation(
                patient_id=patient_id,
                metric_type=m,
                baseline=base,
                patient=patient
            )

        # 4. Build trend explanations (Overall Vitality Index and Metric Trends)
        trends_expl: Dict[str, CalculationExplanation] = {}
        # Composite Vitality Index
        trends_expl["vitality_index"] = build_trend_explanation(
            patient_id=patient_id,
            twin_state=twin_state,
            assessment=assessment or twin_state,
            patient=patient
        )

        # 5. Build alert explanations
        alerts_cursor = db.alerts.find({"patient_id": patient_id}).sort("timestamp", -1).limit(20)
        alerts_list = list(alerts_cursor)
        alerts_expl: Dict[str, CalculationExplanation] = {}
        for al in alerts_list:
            al_id = str(al.get("_id", al.get("id", al.get("metric_type", "alert"))))
            al["_id"] = al_id
            alerts_expl[al_id] = build_alert_explanation(
                patient_id=patient_id,
                alert_dict=al,
                patient=patient
            )
            # Also key by metric_type if alert for that metric exists
            m_type = al.get("metric_type")
            if m_type and m_type not in alerts_expl:
                alerts_expl[m_type] = alerts_expl[al_id]

        # 6. Build baseline simulation explanation
        base_rhr = 72.0
        base_sbp = 124.0
        base_hrv = 42.0
        if "heart_rate" in twin_state.baselines:
            base_rhr = twin_state.baselines["heart_rate"].median
        elif "heart_rate" in twin_state.metrics:
            base_rhr = twin_state.metrics["heart_rate"].current_value

        if "blood_pressure_systolic" in twin_state.baselines:
            base_sbp = twin_state.baselines["blood_pressure_systolic"].median
        elif "blood_pressure_systolic" in twin_state.metrics:
            base_sbp = twin_state.metrics["blood_pressure_systolic"].current_value

        if "hrv_rmssd" in twin_state.baselines:
            base_hrv = twin_state.baselines["hrv_rmssd"].median
        elif "hrv_rmssd" in twin_state.metrics:
            base_hrv = twin_state.metrics["hrv_rmssd"].current_value

        default_baseline_summary = {
            "resting_hr": round(base_rhr, 1),
            "systolic_bp": round(base_sbp, 1),
            "hrv_rmssd": round(base_hrv, 1)
        }

        # Run standard 30d baseline simulation (+1h sleep, +3000 steps)
        default_params = InterventionParams(
            delta_sleep_hours=1.0,
            delta_daily_steps=3000,
            delta_stress_level=0.0,
            sodium_reduction_pct=15.0,
            duration_days=30
        )
        sim_res = run_twin_simulation(
            patient_id=patient_id,
            scenario_name="Standard Lifestyle Optimization Scenario",
            params=default_params,
            baseline_stats=default_baseline_summary
        )

        sim_expl = build_simulation_explanation(
            patient_id=patient_id,
            scenario_name=sim_res["scenario_name"],
            parameters=sim_res["parameters"],
            baseline_summary=sim_res["baseline_summary"],
            projected_outcomes=sim_res["projected_outcomes"]
        )

        return PatientExplanationsResponse(
            patient_id=patient_id,
            metrics=metrics_expl,
            baselines=baselines_expl,
            trends=trends_expl,
            alerts=alerts_expl,
            simulation=sim_expl
        )

    @staticmethod
    def get_simulation_explanation(
        db: Database,
        patient_id: str,
        payload: SimulationExplanationRequest
    ) -> CalculationExplanation:
        """
        Dynamically explains a custom or executed What-If simulation run.
        """
        patient = db.patients.find_one({"patient_id": patient_id})
        twin_state = AssessmentService.evaluate_twin_state(db, patient_id) if patient else None

        base_summary = payload.baseline_summary
        if not base_summary:
            base_rhr = 72.0
            base_sbp = 124.0
            base_hrv = 42.0
            if twin_state and "heart_rate" in twin_state.baselines:
                base_rhr = twin_state.baselines["heart_rate"].median
            if twin_state and "blood_pressure_systolic" in twin_state.baselines:
                base_sbp = twin_state.baselines["blood_pressure_systolic"].median
            if twin_state and "hrv_rmssd" in twin_state.baselines:
                base_hrv = twin_state.baselines["hrv_rmssd"].median
            base_summary = {
                "resting_hr": round(base_rhr, 1),
                "systolic_bp": round(base_sbp, 1),
                "hrv_rmssd": round(base_hrv, 1)
            }

        params = payload.parameters or {
            "delta_sleep_hours": 1.0,
            "delta_daily_steps": 3000,
            "delta_stress_level": 0.0,
            "sodium_reduction_pct": 15.0,
            "duration_days": 30
        }

        projected = payload.projected_outcomes
        scenario_name = payload.scenario_name or "Custom What-If Scenario"

        if not projected:
            interv = InterventionParams(
                delta_sleep_hours=params.get("delta_sleep_hours", 0.0),
                delta_daily_steps=params.get("delta_daily_steps", 0),
                delta_stress_level=params.get("delta_stress_level", 0.0),
                sodium_reduction_pct=params.get("sodium_reduction_pct", 0.0),
                duration_days=params.get("duration_days", 30)
            )
            sim_res = run_twin_simulation(
                patient_id=patient_id,
                scenario_name=scenario_name,
                params=interv,
                baseline_stats=base_summary
            )
            projected = sim_res["projected_outcomes"]

        return build_simulation_explanation(
            patient_id=patient_id,
            scenario_name=scenario_name,
            parameters=params,
            baseline_summary=base_summary,
            projected_outcomes=projected,
            metric_focus=payload.metric_focus
        )
