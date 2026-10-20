from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database
from app.api.deps import get_database
from app.models.patient import PatientCreate, PatientUpdate, PatientResponse
from app.services.patient_service import PatientService

router = APIRouter(prefix="/patients", tags=["Patients"])

@router.get("", response_model=List[PatientResponse])
def get_patients(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search by name, ID, or chronic condition"),
    db: Database = Depends(get_database)
):
    """Retrieve list of patients with search and pagination."""
    return PatientService.list_patients(db=db, skip=skip, limit=limit, search=search)

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
