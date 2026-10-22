from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
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
from app.services.ingestion_service import IngestionService
from app.services.assessment_service import AssessmentService
from app.analytics.unit_converter import convert_to_canonical_unit, UnitConversionError
from app.analytics.plausibility_checker import audit_observation_plausibility

router = APIRouter(prefix="/patients/{patient_id}/observations", tags=["Observations"])

@router.get("", response_model=PaginatedObservationsResponse)
def get_patient_observations(
    patient_id: str,
    measurement_type: Optional[str] = Query(None, description="Filter by measurement type (e.g. heart_rate, hrv_rmssd)"),
    metric_type: Optional[str] = Query(None, description="Alias for measurement_type"),
    start_date: Optional[datetime] = Query(None, description="Start date ISO timestamp"),
    end_date: Optional[datetime] = Query(None, description="End date ISO timestamp"),
    data_kind: Optional[str] = Query(None, description="Filter by kind: measured, user_entered, simulated, imported_file, etc."),
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
    confirm_unusual: bool = Query(False, description="Set true to confirm and record unusual biometric readings"),
    db: Database = Depends(get_database)
):
    """
    Log a single biometric measurement through the common validated ingestion gateway.
    Applies explicit unit conversions, physiological plausibility audits, and duplicate prevention.
    If value is unusual and not confirmed, returns 409 Conflict with confirmation prompt.
    """
    if observation.patient_id != patient_id:
        observation.patient_id = patient_id

    confirmed = confirm_unusual or observation.confirm_unusual
    m_type = observation.measurement_type or observation.metric_type
    if not m_type:
        raise HTTPException(status_code=400, detail="measurement_type is required.")

    obs_time = observation.observed_at or observation.timestamp

    try:
        res = IngestionService.ingest_single_observation(
            db=db,
            patient_id=patient_id,
            measurement_type=m_type,
            value=observation.value,
            unit=observation.unit,
            observed_at=obs_time,
            source_type=observation.source_type or observation.source or "manual_entry",
            device_id=observation.device_id,
            notes=observation.notes,
            confirm_unusual=confirmed,
            paired_measurements=observation.paired_measurements
        )
    except ValueError as e:
        err_msg = str(e)
        if "does not exist" in err_msg:
            raise HTTPException(status_code=404, detail=err_msg)
        raise HTTPException(status_code=400, detail=err_msg)

    if res.get("status") == "requires_confirmation":
        raise HTTPException(
            status_code=409,
            detail=res
        )

    saved_obs = res.get("observation")
    saved_obs["id"] = saved_obs.get("observation_id")
    saved_obs["metric_type"] = saved_obs.get("measurement_type")
    saved_obs["timestamp"] = saved_obs.get("observed_at")
    saved_obs["data_tier"] = saved_obs.get("data_kind", "user_reported")
    return saved_obs

@router.post("/preview")
def preview_single_observation(
    patient_id: str,
    payload: dict,
    db: Database = Depends(get_database)
):
    """Audits a single observation for plausibility and proposed unit conversion without writing to MongoDB."""
    m_type = payload.get("measurement_type") or payload.get("metric_type")
    val = payload.get("value")
    unit = payload.get("unit")
    if not m_type or val is None or not unit:
        raise HTTPException(status_code=400, detail="measurement_type, value, and unit are required.")

    try:
        canon_val, canon_unit, was_converted, note = convert_to_canonical_unit(m_type, float(val), unit)
    except UnitConversionError as ue:
        raise HTTPException(status_code=400, detail=str(ue))

    obs_time = datetime.now(timezone.utc)
    raw_time = payload.get("observed_at") or payload.get("timestamp")
    if raw_time:
        try:
            obs_time = datetime.fromisoformat(str(raw_time).replace("Z", "+00:00"))
        except Exception:
            pass

    audit = audit_observation_plausibility(
        measurement_type=m_type,
        value=canon_val,
        unit=canon_unit,
        observed_at=obs_time,
        confirmed_by_user=False,
        paired_measurements=payload.get("paired_measurements")
    )

    return {
        "patient_id": patient_id,
        "measurement_type": m_type,
        "original_value": float(val),
        "original_unit": unit,
        "canonical_value": canon_val,
        "canonical_unit": canon_unit,
        "was_converted": was_converted,
        "conversion_note": note,
        "is_valid": audit.is_technically_valid,
        "is_unusual": audit.is_unusual,
        "requires_confirmation": audit.requires_confirmation,
        "warnings": audit.warnings,
        "errors": audit.errors,
        "suggested_correction": audit.suggested_correction
    }

@router.put("/{observation_id}", response_model=ObservationResponse)
def update_observation(
    patient_id: str,
    observation_id: str,
    update_in: dict,
    db: Database = Depends(get_database)
):
    """Correct or update an existing observation with an immutable audit trail."""
    try:
        updated = IngestionService.edit_observation(
            db=db,
            patient_id=patient_id,
            observation_id=observation_id,
            new_value=float(update_in["value"]) if update_in.get("value") is not None else None,
            new_unit=update_in.get("unit"),
            new_observed_at=datetime.fromisoformat(update_in["observed_at"].replace("Z", "+00:00")) if update_in.get("observed_at") else None,
            new_notes=update_in.get("notes"),
            edit_reason=update_in.get("correction_reason") or update_in.get("edit_reason") or "Patient correction"
        )
    except ValueError as e:
        err_msg = str(e)
        if "not found" in err_msg.lower():
            raise HTTPException(status_code=404, detail=err_msg)
        raise HTTPException(status_code=400, detail=err_msg)

    updated["id"] = updated.get("observation_id")
    updated["metric_type"] = updated.get("measurement_type")
    updated["timestamp"] = updated.get("observed_at")
    updated["data_tier"] = updated.get("data_kind", "user_reported")
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

@router.post("/csv/preview")
@router.post("/csv/validate")
def preview_and_validate_csv(
    patient_id: str,
    payload: dict,
    db: Database = Depends(get_database)
):
    """
    Preview and validate CSV rows before import.
    Returns detected columns, proposed unit conversions, valid rows,
    unusual rows requiring confirmation, and rejected rows with reasons.
    """
    rows = payload.get("rows", [])
    if not rows:
        raise HTTPException(status_code=400, detail="No rows provided for CSV validation.")
    return IngestionService.preview_and_validate_csv(db=db, patient_id=patient_id, raw_rows=rows)

@router.post("/csv/confirm", status_code=201)
@router.post("/csv/import", status_code=201)
def confirm_csv_import(
    patient_id: str,
    payload: dict,
    confirm_unusual_all: bool = Query(False, description="Confirm all unusual readings in batch"),
    db: Database = Depends(get_database)
):
    """
    Commit validated CSV rows into MongoDB with full provenance and audit tracking.
    """
    rows = payload.get("validated_rows") or payload.get("rows", [])
    if not rows:
        raise HTTPException(status_code=400, detail="No rows provided for CSV import.")

    # If raw rows passed, run preview_and_validate_csv first to ensure safety
    if rows and "is_valid" not in rows[0]:
        preview = IngestionService.preview_and_validate_csv(db=db, patient_id=patient_id, raw_rows=rows)
        rows = preview.get("all_rows", [])

    try:
        result = IngestionService.commit_csv_import(
            db=db,
            patient_id=patient_id,
            validated_rows=rows,
            confirm_unusual_all=confirm_unusual_all
        )
    except ValueError as e:
        err_msg = str(e)
        if "does not exist" in err_msg:
            raise HTTPException(status_code=404, detail=err_msg)
        raise HTTPException(status_code=400, detail=err_msg)

    return result

