from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database
from app.api.deps import get_database
from app.models.patient import PatientCreate, PatientUpdate, PatientResponse
from app.models.multi_signal import MultiSignalTimelineResponse
from app.services.patient_service import PatientService
from app.services.multi_signal_service import MultiSignalService

router = APIRouter(prefix="/patients", tags=["Patients"])

@router.get("", response_model=List[PatientResponse])
def get_patients(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search by name, ID, or chronic condition"),
    mode: Optional[str] = Query(None, description="Filter mode: 'demo' (synthetic only) or 'live' (real only)"),
    demo_data: Optional[bool] = Query(None, description="Explicit boolean filter for synthetic demo records"),
    db: Database = Depends(get_database)
):
    """Retrieve list of patients with search, pagination, and demo vs live provenance filtering."""
    resolved_demo: Optional[bool] = demo_data
    if mode == "demo":
        resolved_demo = True
    elif mode == "live":
        resolved_demo = False

    return PatientService.list_patients(
        db=db,
        skip=skip,
        limit=limit,
        search=search,
        demo_data=resolved_demo
    )

@router.post("", response_model=PatientResponse, status_code=201)
def create_patient(
    patient_in: PatientCreate,
    db: Database = Depends(get_database)
):
    """Register a new patient digital twin profile."""
    try:
        return PatientService.create_patient(db=db, patient_in=patient_in)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{patient_id}", response_model=PatientResponse)
def get_patient(
    patient_id: str,
    db: Database = Depends(get_database)
):
    """Fetch patient profile, baseline settings, and current alert status."""
    patient = PatientService.get_patient(db=db, patient_id=patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found.")
    return patient

@router.put("/{patient_id}", response_model=PatientResponse)
def update_patient(
    patient_id: str,
    update_in: PatientUpdate,
    db: Database = Depends(get_database)
):
    """Update patient demographic, baseline window, or lifestyle configuration."""
    patient = PatientService.update_patient(db=db, patient_id=patient_id, update_in=update_in)
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found.")
    return patient

@router.delete("/{patient_id}", status_code=200)
def delete_patient(
    patient_id: str,
    delete_associated_data: bool = Query(True, description="Cascade delete observations, assessments, and alerts"),
    db: Database = Depends(get_database)
):
    """Safely delete patient record and optionally cascade associated biometric data."""
    deleted = PatientService.delete_patient(db=db, patient_id=patient_id, delete_associated_data=delete_associated_data)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found.")
    return {
        "status": "success",
        "deleted_patient_id": patient_id,
        "cascade_deleted_data": delete_associated_data
    }


@router.get("/{patient_id}/timeline/multi-signal", response_model=MultiSignalTimelineResponse)
def get_patient_multi_signal_timeline(
    patient_id: str,
    signal_filter: str = Query("all", description="Filter by signal: 'all', 'sleep', 'cardio', 'blood_pressure', 'steps', 'respiratory', 'observations'"),
    start_date: Optional[str] = Query(None, description="ISO format start date filter"),
    end_date: Optional[str] = Query(None, description="ISO format end date filter"),
    source: Optional[str] = Query(None, description="Filter by device or origin source"),
    status: Optional[str] = Query(None, description="Filter by status level e.g. 'elevated', 'low', 'normal', 'review'"),
    data_kind: Optional[str] = Query(None, description="Filter by provenance: 'measured', 'derived', 'model_predicted', 'simulated', 'synthetic'"),
    limit: int = Query(150, ge=1, le=500, description="Maximum items to return"),
    skip: int = Query(0, ge=0, description="Offset for pagination"),
    db: Database = Depends(get_database)
):
    """
    Returns an integrated multi-signal timeline synthesizing:
    1. BiDSleep Wearable Sleep-Stage ML Model predictions (5-class AASM)
    2. Cardiovascular nMAD Statistical Anomaly flags (Non-parametric robust median corridor)
    3. Physiological Telemetry Observations (BP, Steps, Respiration, etc.)

    Maintains strict separation, distinct badges, and independent audit trails
    between probabilistic AI inferences, deterministic statistical corridors, and measured telemetry.
    """
    try:
        return MultiSignalService.get_multi_signal_timeline(
            db=db,
            patient_id=patient_id,
            signal_filter=signal_filter,
            start_date=start_date,
            end_date=end_date,
            source=source,
            status=status,
            data_kind=data_kind,
            limit=limit,
            skip=skip
        )
    except ValueError as e:
        err = str(e)
        if "not found" in err:
            raise HTTPException(status_code=404, detail=err)
        raise HTTPException(status_code=400, detail=err)

