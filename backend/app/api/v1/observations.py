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
        err_msg = str(e)
        if "does not exist" in err_msg:
            raise HTTPException(status_code=404, detail=err_msg)
        raise HTTPException(status_code=400, detail=err_msg)

    # Trigger twin state re-assessment
    try:
        AssessmentService.evaluate_twin_state(db=db, patient_id=patient_id)
    except Exception:
        pass
    return result

@router.put("/{observation_id}", response_model=ObservationResponse)
def update_observation(
    patient_id: str,
    observation_id: str,
    update_in: dict,
    db: Database = Depends(get_database)
):
    """Correct or update an existing observation with an audit trail."""
    try:
        updated = ObservationService.update_observation(
            db=db,
            patient_id=patient_id,
            observation_id=observation_id,
            val=update_in.get("value"),
            unit=update_in.get("unit"),
            observed_at=update_in.get("observed_at"),
            notes=update_in.get("notes"),
            correction_reason=update_in.get("correction_reason")
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not updated:
        raise HTTPException(status_code=404, detail=f"Observation '{observation_id}' for patient '{patient_id}' not found.")

    try:
        AssessmentService.evaluate_twin_state(db=db, patient_id=patient_id)
    except Exception:
        pass

    return updated

@router.delete("/{observation_id}", status_code=200)
def delete_observation(
    patient_id: str,
    observation_id: str,
    db: Database = Depends(get_database)
):
    """Delete a single observation record safely."""
    deleted = ObservationService.delete_observation(
        db=db,
        patient_id=patient_id,
        observation_id=observation_id
    )
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Observation '{observation_id}' for patient '{patient_id}' not found.")

    try:
        AssessmentService.evaluate_twin_state(db=db, patient_id=patient_id)
    except Exception:
        pass

    return {"status": "success", "deleted_observation_id": observation_id}

@router.post("/batch", status_code=201)
def batch_add_observations(
    patient_id: str,
    batch: BatchObservationCreate,
    db: Database = Depends(get_database)
):
    """Ingest a batch of wearable or telemetry observations."""
    for obs in batch.observations:
        obs.patient_id = patient_id

    try:
        count = ObservationService.batch_add_observations(db=db, observations=batch.observations)
    except ValueError as e:
        err_msg = str(e)
        if "does not exist" in err_msg:
            raise HTTPException(status_code=404, detail=err_msg)
        raise HTTPException(status_code=400, detail=err_msg)

    try:
        AssessmentService.evaluate_twin_state(db=db, patient_id=patient_id)
    except Exception:
        pass
    return {"status": "success", "inserted_count": count}

@router.post("/csv/validate")
def validate_csv(
    patient_id: str,
    payload: dict,
    db: Database = Depends(get_database)
):
    """Preview and validate CSV rows before import."""
    rows = payload.get("rows", [])
    if not rows:
        raise HTTPException(status_code=400, detail="No rows provided for CSV validation.")
    return ObservationService.validate_csv_rows(db=db, patient_id=patient_id, raw_rows=rows)

@router.post("/csv/import", status_code=201)
def import_csv(
    patient_id: str,
    payload: dict,
    db: Database = Depends(get_database)
):
    """Import validated CSV rows into MongoDB."""
    rows = payload.get("rows", [])
    if not rows:
        raise HTTPException(status_code=400, detail="No rows provided for CSV import.")

    # Convert to ObservationCreate objects
    obs_list = []
    for r in rows:
        obs_list.append(ObservationCreate(
            patient_id=patient_id,
            measurement_type=r["measurement_type"],
            value=float(r["value"]),
            unit=r["unit"],
            observed_at=datetime.fromisoformat(r["observed_at"].replace("Z", "+00:00")),
            source=r.get("source", "wearable_csv_import"),
            data_kind=r.get("data_kind", "wearable_imported"),
            notes=r.get("notes")
        ))

    try:
        count = ObservationService.batch_add_observations(db=db, observations=obs_list)
    except ValueError as e:
        err_msg = str(e)
        if "does not exist" in err_msg:
            raise HTTPException(status_code=404, detail=err_msg)
        raise HTTPException(status_code=400, detail=err_msg)

    try:
        AssessmentService.evaluate_twin_state(db=db, patient_id=patient_id)
    except Exception:
        pass

    return {"status": "success", "imported_count": count}
