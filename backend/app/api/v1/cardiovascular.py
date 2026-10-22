"""
FastAPI Endpoints for Cardiovascular Anomaly Intelligence
Provides:
- GET /api/v1/patients/{patient_id}/cardiovascular/baseline
- GET /api/v1/patients/{patient_id}/cardiovascular/anomalies
- GET /api/v1/patients/{patient_id}/cardiovascular/anomalies/{observation_id}/explanation
"""

from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Path
from pymongo.database import Database

from app.api.deps import get_database
from app.analytics.hr_anomaly_engine import (
    HeartRateBaseline,
    HeartRateAnomalyExplanation,
    DEFAULT_WINDOW_DAYS,
    DEFAULT_MIN_OBSERVATIONS
)
from app.services.cardiovascular_service import CardiovascularService

router = APIRouter(prefix="/patients/{patient_id}/cardiovascular", tags=["Cardiovascular Intelligence"])


@router.get("/baseline", response_model=HeartRateBaseline)
def get_cardiovascular_baseline(
    patient_id: str = Path(..., description="Target patient identifier"),
    window_days: int = Query(DEFAULT_WINDOW_DAYS, ge=1, le=365, description="Historical baseline window in days"),
    min_observations: int = Query(DEFAULT_MIN_OBSERVATIONS, ge=3, le=100, description="Minimum required observations to establish baseline"),
    db: Database = Depends(get_database)
):
    """
    Retrieves the current personal heart-rate baseline.
    Computes robust median and Normalized Median Absolute Deviation (nMAD).
    Returns 'insufficient_data' if prior sample count is below min_observations.
    """
    try:
        baseline = CardiovascularService.get_patient_hr_baseline(
            db=db,
            patient_id=patient_id,
            window_days=window_days,
            min_observations=min_observations
        )
        return baseline
    except ValueError as e:
        err = str(e)
        if "does not exist" in err:
            raise HTTPException(status_code=404, detail=err)
        raise HTTPException(status_code=400, detail=err)


@router.get("/anomalies", response_model=Dict[str, Any])
def get_cardiovascular_anomalies(
    patient_id: str = Path(..., description="Target patient identifier"),
    window_days: int = Query(DEFAULT_WINDOW_DAYS, ge=1, le=365, description="Historical baseline window in days"),
    min_observations: int = Query(DEFAULT_MIN_OBSERVATIONS, ge=3, le=100, description="Minimum required observations to establish baseline"),
    limit: int = Query(200, ge=1, le=1000, description="Page size"),
    skip: int = Query(0, ge=0, description="Pagination skip offset"),
    status: Optional[str] = Query(None, description="Filter by anomaly status: unusual_high, unusual_low, within_personal_range, insufficient_data, review_data_quality"),
    source: Optional[str] = Query(None, description="Filter by data source: wearable, manual_entry, imported_file, all"),
    db: Database = Depends(get_database)
):
    """
    Runs chronological zero-leakage evaluation over the patient's heart-rate observations.
    Returns:
    - Current baseline summary
    - Operational evaluation metrics (total observations, flagged count, review count)
    - Full timeline series for visualization (including baseline and 2*nMAD corridor)
    - Paginated list of anomaly events
    """
    try:
        data = CardiovascularService.get_patient_hr_anomalies(
            db=db,
            patient_id=patient_id,
            window_days=window_days,
            min_observations=min_observations,
            limit=limit,
            skip=skip,
            status_filter=status,
            source_filter=source
        )
        return data
    except ValueError as e:
        err = str(e)
        if "does not exist" in err:
            raise HTTPException(status_code=404, detail=err)
        raise HTTPException(status_code=400, detail=err)


@router.get("/anomalies/{observation_id}/explanation", response_model=HeartRateAnomalyExplanation)
def get_cardiovascular_anomaly_explanation(
    patient_id: str = Path(..., description="Target patient identifier"),
    observation_id: str = Path(..., description="Target observation identifier"),
    window_days: int = Query(DEFAULT_WINDOW_DAYS, ge=1, le=365, description="Historical baseline window in days"),
    min_observations: int = Query(DEFAULT_MIN_OBSERVATIONS, ge=3, le=100, description="Minimum required observations to establish baseline"),
    db: Database = Depends(get_database)
):
    """
    Returns an explainable mathematical breakdown for a specific heart-rate observation,
    including formula, exact values, input sample count, and non-diagnostic disclaimers.
    """
    try:
        explanation = CardiovascularService.explain_observation(
            db=db,
            patient_id=patient_id,
            observation_id=observation_id,
            window_days=window_days,
            min_observations=min_observations
        )
        return explanation
    except ValueError as e:
        err = str(e)
        if "not exist" in err or "not found" in err:
            raise HTTPException(status_code=404, detail=err)
        raise HTTPException(status_code=400, detail=err)
