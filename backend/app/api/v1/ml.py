"""
FastAPI Endpoints for Machine Learning Health Intelligence & Live AI Optical Scanning
"""

from typing import Dict, Any, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException
from pymongo.database import Database
from app.api.deps import get_database
from app.analytics.ml_health_engine import ml_health_engine
from app.services.observation_service import ObservationService
from app.services.assessment_service import AssessmentService
from app.models.observation import ObservationCreate

router = APIRouter(prefix="", tags=["Machine Learning Intelligence"])

class InputValidationRequest(BaseModel):
    measurement_type: str
    value: float
    unit: str
    patient_id: Optional[str] = None
    paired_measurements: Optional[Dict[str, float]] = None

class AIScanRequest(BaseModel):
    heart_rate: float = Field(..., ge=30, le=240, description="Optical pulse rate in bpm")
    hrv_rmssd: float = Field(..., ge=5, le=250, description="Optical heart rate variability in ms")
    respiratory_rate: Optional[float] = Field(default=16.0, ge=6, le=60)
    signal_quality_pct: Optional[float] = Field(default=95.0, ge=10, le=100)
    auto_persist_twin: bool = Field(default=True, description="Whether to automatically log verified biometrics to the patient twin")

@router.post("/ml/validate-input")
def validate_input_plausibility(
    req: InputValidationRequest,
    db: Database = Depends(get_database)
):
    """
    AI Multi-Variate Plausibility Guard:
    Checks physiological validity, detects typos (e.g. 700 bpm or systolic <= diastolic),
    and returns a plausibility score with suggested corrections.
    """
    baseline_mean = None
    baseline_std = None

    if req.patient_id:
        patient = db.patients.find_one({"patient_id": req.patient_id})
        if patient:
            twin_baselines = AssessmentService.get_patient_baselines(db, req.patient_id)
            base = twin_baselines.get(req.measurement_type.lower())
            if base:
                baseline_mean = base.get("mean")
                baseline_std = base.get("std_dev")

    result = ml_health_engine.validate_input_plausibility(
        measurement_type=req.measurement_type,
        value=req.value,
        unit=req.unit,
        existing_baseline_mean=baseline_mean,
        existing_baseline_std=baseline_std,
        paired_measurements=req.paired_measurements
    )
    return result

@router.get("/patients/{patient_id}/ml/prediction")
def get_patient_ml_prediction(
    patient_id: str,
    db: Database = Depends(get_database)
):
    """
    Runs the trained Machine Learning ensemble on the patient's current multi-modal twin telemetry.
    Predicts 14-day risk tier, continuous vitality trajectory delta, clinical phenotype, and top driving factors.
    """
    patient = db.patients.find_one({"patient_id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found.")

    twin_state = AssessmentService.evaluate_twin_state(db=db, patient_id=patient_id)
    
    # Extract latest metrics for ML model
    current_metrics = {}
    if twin_state and twin_state.metrics:
        for m_type, m_val in twin_state.metrics.items():
            current_metrics[m_type] = m_val.current_value

    max_z = 0.5
    if twin_state and twin_state.metrics:
        z_scores = [abs(m.z_score) for m in twin_state.metrics.values()]
        if z_scores:
            max_z = float(max(z_scores))

    prediction = ml_health_engine.predict_health_trajectory(
        current_metrics=current_metrics,
        age=patient.get("age", 38),
        baseline_z_max=max_z
    )
    prediction["patient_id"] = patient_id
    prediction["patient_name"] = patient.get("display_name") or patient.get("full_name") or patient_id
    return prediction

@router.post("/patients/{patient_id}/ai-scan")
def process_ai_optical_scan(
    patient_id: str,
    scan_req: AIScanRequest,
    db: Database = Depends(get_database)
):
    """
    Processes real-time camera rPPG / bio-sensor scan telemetry.
    1. Validates optical signal quality and physiological consistency.
    2. Runs trained ML predictive ensemble on the extracted biometrics.
    3. If valid and auto_persist_twin=True, updates the patient's Digital Twin with verified biometrics.
    """
    patient = db.patients.find_one({"patient_id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found.")

    # Process scan telemetry
    telemetry = scan_req.model_dump()
    scan_result = ml_health_engine.process_ai_optical_scan(
        patient_id=patient_id,
        scan_telemetry=telemetry
    )

    # If valid and requested, persist both Heart Rate and HRV observations
    persisted_observations = []
    if scan_req.auto_persist_twin and scan_result["is_valid"]:
        try:
            hr_obs = ObservationService.add_observation(
                db=db,
                obs_in=ObservationCreate(
                    patient_id=patient_id,
                    measurement_type="heart_rate",
                    value=round(scan_req.heart_rate, 1),
                    unit="bpm",
                    source="ai_optical_rppg",
                    data_kind="measured",
                    notes="Automated optical photoplethysmography face scan"
                )
            )
            persisted_observations.append(hr_obs.get("observation_id"))

            hrv_obs = ObservationService.add_observation(
                db=db,
                obs_in=ObservationCreate(
                    patient_id=patient_id,
                    measurement_type="hrv_rmssd",
                    value=round(scan_req.hrv_rmssd, 1),
                    unit="ms",
                    source="ai_optical_rppg",
                    data_kind="measured",
                    notes="Automated optical photoplethysmography face scan"
                )
            )
            persisted_observations.append(hrv_obs.get("observation_id"))
        except Exception as e:
            logger.warning(f"Error persisting scan biometrics: {e}")

    scan_result["persisted_observation_ids"] = persisted_observations
    scan_result["twin_updated"] = len(persisted_observations) > 0
    return scan_result
