from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database
from app.api.deps import get_database
from app.models.assessment import DigitalTwinStateResponse, HealthAssessmentResponse
from app.services.assessment_service import AssessmentService
from app.repositories.assessment_repository import AssessmentRepository

router = APIRouter(tags=["Digital Twin & Analytics"])

@router.get("/patients/{patient_id}/twin", response_model=DigitalTwinStateResponse)
@router.get("/patients/{patient_id}/twin/state", response_model=DigitalTwinStateResponse)
def get_twin_state(
    patient_id: str,
    db: Database = Depends(get_database)
):
    """
    Returns the dynamic digital twin state:
    Combines latest observations, personalized baselines, trend slopes,
    data freshness/quality, and missing-data warnings.
    """
    state = AssessmentService.evaluate_twin_state(db=db, patient_id=patient_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found.")
    return state

@router.get("/patients/{patient_id}/twin/baseline")
def get_twin_baseline(
    patient_id: str,
    window_days: Optional[int] = Query(None, ge=7, le=180, description="Custom rolling baseline window in days"),
    include_simulated: bool = Query(False, description="Whether to include simulated observations in the baseline calculation"),
    db: Database = Depends(get_database)
):
    """
    Fetches the calculated personalized statistical baseline profiles:
    Median, IQR, Mean, StdDev, and distribution bounds for each metric.
    Simulated observations are excluded by default unless include_simulated=True is explicitly requested.
    """
    baselines = AssessmentService.get_patient_baselines(
        db=db,
        patient_id=patient_id,
        window_days=window_days,
        include_simulated=include_simulated
    )
    return {
        "patient_id": patient_id,
        "window_days": window_days or 30,
        "includes_simulated": include_simulated,
        "baselines": baselines
    }

@router.get("/patients/{patient_id}/twin/assessments/measurements")
def get_measurement_assessments(
    patient_id: str,
    window_days: Optional[int] = Query(None, ge=7, le=180, description="Baseline window in days"),
    include_simulated: bool = Query(False, description="Include simulated telemetry"),
    db: Database = Depends(get_database)
):
    """
    Comprehensive per-measurement assessment adhering to Requirement F:
    Returns patient_id, measurement_type, observed_value, personal_baseline, unit,
    absolute_deviation, relative_deviation_percent, trend_direction, data_quality,
    data_freshness, rule_id, rule_version, explanation, data_source, assessed_at, limitations.
    """
    assessments = AssessmentService.get_measurement_assessments(
        db=db,
        patient_id=patient_id,
        window_days=window_days,
        include_simulated=include_simulated
    )
    return {
        "patient_id": patient_id,
        "assessments": assessments
    }

@router.get("/patients/{patient_id}/twin/assessment", response_model=HealthAssessmentResponse)
def get_twin_assessment(
    patient_id: str,
    db: Database = Depends(get_database)
):
    """
    Returns the latest explainable Health Stability Index (0-100),
    vitality breakdown, rule justifications, and safety disclaimers.
    """
    assess = AssessmentService.get_latest_assessment(db=db, patient_id=patient_id)
    if not assess:
        raise HTTPException(status_code=404, detail=f"No assessment available for patient '{patient_id}'.")
    return assess

@router.get("/patients/{patient_id}/trends")
def get_patient_trends(
    patient_id: str,
    db: Database = Depends(get_database)
):
    """
    Returns longitudinal trends, 7-day slopes, volatility metrics,
    and baseline bounds for visualization and clinical review.
    """
    trends = AssessmentService.get_patient_trends(db=db, patient_id=patient_id)
    if not trends:
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found.")
    return trends

@router.get("/patients/{patient_id}/assessments")
def list_patient_assessments(
    patient_id: str,
    limit: int = Query(20, ge=1, le=100),
    db: Database = Depends(get_database)
):
    """
    Retrieves chronological history of computed health assessments for a patient.
    """
    repo = AssessmentRepository(db)
    history = repo.list_history(patient_id=patient_id, limit=limit)
    return history

@router.get("/patients/{patient_id}/predict")
def predict_patient_trends(
    patient_id: str,
    horizon_days: int = Query(7, ge=1, le=30, description="Forecast horizon in days"),
    db: Database = Depends(get_database)
):
    """
    Time-series trend forecasting with temporal leakage prevention and held-out validation.
    Reports MAE/RMSE comparisons against simple persistence baselines.
    """
    forecasts = AssessmentService.get_patient_predictions(db=db, patient_id=patient_id, horizon_days=horizon_days)
    return forecasts

@router.get("/patients/{patient_id}/twin/modules")
def get_patient_health_modules(
    patient_id: str,
    db: Database = Depends(get_database)
):
    """
    Evaluates all six health modules:
    - Module A: Sleep Intelligence
    - Module B: Cardiovascular Trend Analysis
    - Module C: Activity Intelligence
    - Module D: Blood Pressure Trend Tracking
    - Module E: Personalized Anomaly Detection
    - Module F: Future Trend Forecasting
    """
    patient = db.patients.find_one({"patient_id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found.")
    return AssessmentService.get_patient_health_modules(db=db, patient_id=patient_id)

@router.get("/patients/{patient_id}/twin/layers")
def get_patient_active_layers(
    patient_id: str,
    db: Database = Depends(get_database)
):
    """
    Returns active data layers available for a patient based on verified observations.
    Used by the Spatial Digital Twin to only enable layers when relevant measurements exist.
    """
    patient = db.patients.find_one({"patient_id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found.")
    return AssessmentService.get_patient_active_layers(db=db, patient_id=patient_id)

