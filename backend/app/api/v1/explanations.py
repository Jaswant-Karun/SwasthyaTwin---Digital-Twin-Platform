from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo.database import Database
from app.api.deps import get_database
from app.models.explanation import (
    CalculationExplanation,
    PatientExplanationsResponse,
    SimulationExplanationRequest
)
from app.services.explanation_service import ExplanationService

router = APIRouter(tags=["Explainability & Calculation Metadata"])

@router.get(
    "/patients/{patient_id}/explanations",
    response_model=PatientExplanationsResponse,
    summary="Get All Calculation Explanations for Patient"
)
@router.get(
    "/patients/{patient_id}/twin/explanations",
    response_model=PatientExplanationsResponse,
    include_in_schema=False
)
def get_patient_explanations(
    patient_id: str,
    db: Database = Depends(get_database)
):
    """
    Returns complete explainability calculation metadata and worked numerical examples
    for each health metric, personal baseline, trend indicator, active alert,
    and simulation output for the requested patient.
    """
    explanations = ExplanationService.get_patient_explanations(db, patient_id)
    if not explanations:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient '{patient_id}' not found or has no active twin state."
        )
    return explanations

@router.get(
    "/patients/{patient_id}/explanations/{category}/{item_id}",
    response_model=CalculationExplanation,
    summary="Get Specific Item Calculation Explanation"
)
def get_specific_explanation(
    patient_id: str,
    category: str,
    item_id: str,
    db: Database = Depends(get_database)
):
    """
    Returns the granular calculation explanation and worked numerical example
    for a specific item (metric, baseline, trend indicator, alert, or simulation).
    """
    explanations = ExplanationService.get_patient_explanations(db, patient_id)
    if not explanations:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Patient '{patient_id}' not found."
        )

    cat = category.lower()
    found: Optional[CalculationExplanation] = None

    if cat == "metric":
        found = explanations.metrics.get(item_id)
    elif cat == "baseline":
        found = explanations.baselines.get(item_id)
    elif cat == "trend":
        found = explanations.trends.get(item_id) or explanations.trends.get("vitality_index")
    elif cat == "alert":
        found = explanations.alerts.get(item_id)
    elif cat == "simulation":
        found = explanations.simulation

    if not found:
        # Fallback search across all categories
        for pool in [explanations.metrics, explanations.baselines, explanations.trends, explanations.alerts]:
            if item_id in pool:
                found = pool[item_id]
                break

    if not found:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Explanation for category '{category}' and item '{item_id}' not found."
        )

    return found

@router.post(
    "/patients/{patient_id}/explanations/simulation",
    response_model=CalculationExplanation,
    summary="Generate Dynamic What-If Simulation Explanation"
)
def get_simulation_explanation(
    patient_id: str,
    payload: SimulationExplanationRequest,
    db: Database = Depends(get_database)
):
    """
    Generates dynamic calculation metadata and worked mathematical examples
    for a custom What-If simulation run with user-adjusted intervention levers.
    """
    return ExplanationService.get_simulation_explanation(db, patient_id, payload)
