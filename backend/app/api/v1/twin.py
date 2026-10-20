from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database
from app.api.deps import get_database
from app.models.assessment import DigitalTwinStateResponse, HealthAssessmentResponse
from app.services.assessment_service import AssessmentService

router = APIRouter(prefix="/patients/{patient_id}/twin", tags=["Digital Twin"])

@router.get("/state", response_model=DigitalTwinStateResponse)
def get_twin_state(
    patient_id: str,
    db: Database = Depends(get_database)
):
    """
    Returns the real-time dynamic digital twin state:
    Current vital signs evaluated strictly against the patient's personal baseline with Z-scores.
    """
    state = AssessmentService.evaluate_twin_state(db=db, patient_id=patient_id)
    if not state:
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found.")
    return state

@router.get("/baseline")
def get_twin_baseline(
    patient_id: str,
    window_days: Optional[int] = Query(None, ge=7, le=180, description="Custom rolling baseline window in days"),
    db: Database = Depends(get_database)
):
    """
    Fetches the calculated personalized statistical baseline profiles:
    Mean, StdDev, Median, IQR, and distribution bounds for each metric.
    """
    baselines = AssessmentService.get_patient_baselines(db=db, patient_id=patient_id, window_days=window_days)
    return {
        "patient_id": patient_id,
        "window_days": window_days or 30,
        "baselines": baselines
    }

@router.get("/assessment", response_model=HealthAssessmentResponse)
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
