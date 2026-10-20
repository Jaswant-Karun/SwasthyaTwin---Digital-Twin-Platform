from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo.database import Database
from app.api.deps import get_database
from app.models.alert import AlertResponse, AlertAcknowledgeRequest
from app.services.alert_service import AlertService

router = APIRouter(tags=["Alerts"])

@router.get("/patients/{patient_id}/alerts", response_model=List[AlertResponse])
def get_alerts(
    patient_id: str,
    acknowledged: Optional[bool] = Query(None, description="Filter by acknowledged status"),
    limit: int = Query(50, ge=1, le=100),
    db: Database = Depends(get_database)
):
    """Retrieve explainable deviation alerts for a patient."""
    return AlertService.get_patient_alerts(
        db=db,
        patient_id=patient_id,
        acknowledged=acknowledged,
        limit=limit
    )

@router.post("/alerts/{alert_id}/acknowledge", response_model=AlertResponse)
def acknowledge_alert(
    alert_id: str,
    ack_request: AlertAcknowledgeRequest,
    db: Database = Depends(get_database)
):
    """Mark an alert as acknowledged with clinician or patient notes."""
    updated = AlertService.acknowledge_alert(
        db=db,
        alert_id=alert_id,
        acknowledged_by=ack_request.acknowledged_by,
        notes=ack_request.notes
    )
    if not updated:
        raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found.")
    return updated
