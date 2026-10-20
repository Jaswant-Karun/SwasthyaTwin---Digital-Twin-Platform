from typing import Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, Query, HTTPException, status
from pymongo.database import Database
from app.api.deps import get_database
from app.database.seed import (
    seed_synthetic_patients,
    reset_demo_data,
    inject_live_observation
)

router = APIRouter(tags=["Seed & Demo"])

class LiveObservationRequest(BaseModel):
    patient_id: str = Field(default="PT-1001", description="Target synthetic patient ID")
    metric_type: str = Field(default="heart_rate", description="Measurement type to inject (e.g. heart_rate, blood_pressure_systolic)")
    value: Optional[float] = Field(default=None, description="Observed numeric value. If omitted, uses realistic acute deviation preset")
    source: str = Field(default="wearable_continuous_live", description="Source identifier")

@router.post("/seed", status_code=200)
def trigger_seed(
    force: bool = Query(False, description="Force re-seeding of synthetic demo patients without removing user records"),
    db: Database = Depends(get_database)
):
    """
    Populates synthetic demonstration cohorts with 90 days of continuous physiological telemetry
    for 5 diverse synthetic profiles.
    Safe, repeatable, and non-destructive for hackathon demonstrations.
    """
    result = seed_synthetic_patients(db=db, force=force)
    return result

@router.post("/seed/reset", status_code=200)
def trigger_reset(
    confirm: bool = Query(False, description="Explicit confirmation to remove demo data (confirm=True)"),
    db: Database = Depends(get_database)
):
    """
    Safely resets synthetic demonstration records.
    Requires explicit invocation with confirm=True.
    Protects all real user data by filtering strictly on demo_data: True.
    """
    if not confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Resetting demo data requires explicit confirmation. Pass confirm=true to proceed."
        )
    return reset_demo_data(db=db, confirm=confirm)

@router.post("/seed/live-observation", status_code=201)
def trigger_live_observation(
    payload: LiveObservationRequest,
    db: Database = Depends(get_database)
):
    """
    Live Demonstration Mode:
    Simulates real-time arrival of a new telemetry packet for the selected patient.
    Immediately recalculates the affected digital twin state, baselines, and alerts.
    """
    return inject_live_observation(
        db=db,
        patient_id=payload.patient_id,
        metric_type=payload.metric_type,
        value=payload.value,
        source=payload.source
    )
