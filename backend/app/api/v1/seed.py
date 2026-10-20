from fastapi import APIRouter, Depends
from pymongo.database import Database
from app.api.deps import get_database
from app.database.seed import seed_synthetic_patients

router = APIRouter(tags=["Seed & Demo"])

@router.post("/seed", status_code=200)
def trigger_seed(db: Database = Depends(get_database)):
    """
    Populates synthetic demonstration cohorts with 90 days of continuous physiological telemetry.
    Safe and deterministic for hackathon demonstrations.
    """
    result = seed_synthetic_patients(db=db)
    return result
