from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database
from app.api.deps import get_database
from app.models.simulation import SimulationRequest, SimulationResponse
from app.services.simulation_service import SimulationService

router = APIRouter(prefix="/patients/{patient_id}/simulations", tags=["Simulations"])

@router.post("", response_model=SimulationResponse, status_code=201)
@router.post("/run", response_model=SimulationResponse, status_code=201)
def run_simulation(
    patient_id: str,
    sim_request: SimulationRequest,
    db: Database = Depends(get_database)
):
    """
    Execute a hypothetical What-If simulation modeling the physiological response
    to alterations in sleep, daily steps, stress levels, or sodium intake.
    """
    patient = db.patients.find_one({"patient_id": patient_id})
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found.")

    return SimulationService.execute_simulation(db=db, patient_id=patient_id, sim_request=sim_request)

@router.get("", response_model=List[SimulationResponse])
def get_simulations(
    patient_id: str,
    limit: int = Query(10, ge=1, le=50),
    db: Database = Depends(get_database)
):
    """List historical simulation runs for this patient."""
    return SimulationService.get_patient_simulations(db=db, patient_id=patient_id, limit=limit)
