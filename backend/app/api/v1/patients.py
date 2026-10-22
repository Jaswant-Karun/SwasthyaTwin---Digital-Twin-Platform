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
