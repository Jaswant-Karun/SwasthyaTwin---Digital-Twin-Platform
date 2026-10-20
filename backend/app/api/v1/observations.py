from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database
from app.api.deps import get_database
from app.models.observation import (
    ObservationCreate,
    BatchObservationCreate,
    ObservationResponse,
    PaginatedObservationsResponse
)
from app.services.observation_service import ObservationService
from app.services.assessment_service import AssessmentService

router = APIRouter(prefix="/patients/{patient_id}/observations", tags=["Observations"])

@router.get("", response_model=PaginatedObservationsResponse)
def get_patient_observations(
    patient_id: str,
    measurement_type: Optional[str] = Query(None, description="Filter by measurement type (e.g. heart_rate, hrv_rmssd)"),
    metric_type: Optional[str] = Query(None, description="Alias for measurement_type"),
    start_date: Optional[datetime] = Query(None, description="Start date ISO timestamp"),
    end_date: Optional[datetime] = Query(None, description="End date ISO timestamp"),
    data_kind: Optional[str] = Query(None, description="Filter by kind: measured, user_entered, simulated"),
    data_tier: Optional[str] = Query(None, description="Alias for data_kind"),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=2000),
    db: Database = Depends(get_database)
):
    """Retrieve historical observations with time-window, metric, and data kind filters."""
    m_type = measurement_type or metric_type
    kind = data_kind or data_tier
    return ObservationService.query_observations(
        db=db,
        patient_id=patient_id,
        metric_type=m_type,
        start_date=start_date,
        end_date=end_date,
        data_tier=kind,
        skip=skip,
        limit=limit
    )

@router.post("", response_model=ObservationResponse, status_code=201)
def add_observation(
    patient_id: str,
    observation: ObservationCreate,
    db: Database = Depends(get_database)
):
    """Log a single biometric measurement (wearable continuous, lab, or manual entry)."""
    if observation.patient_id != patient_id:
        observation.patient_id = patient_id

    try:
        result = ObservationService.add_observation(db=db, obs_in=observation)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Trigger twin state re-assessment
    try:
        AssessmentService.evaluate_twin_state(db=db, patient_id=patient_id)
    except Exception:
        pass
    return result


@router.post("/batch", status_code=201)
def batch_add_observations(
    patient_id: str,
    batch: BatchObservationCreate,
    db: Database = Depends(get_database)
):
    """Ingest a batch of wearable or telemetry observations."""
    for obs in batch.observations:
        obs.patient_id = patient_id

    count = ObservationService.batch_add_observations(db=db, observations=batch.observations)
    try:
        AssessmentService.evaluate_twin_state(db=db, patient_id=patient_id)
    except Exception:
        pass
    return {"status": "success", "inserted_count": count}
