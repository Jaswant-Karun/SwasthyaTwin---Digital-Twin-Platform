from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from pymongo.database import Database
from app.api.deps import get_database
from app.models.audit import AuditEventResponse
from app.repositories.audit_repository import AuditRepository

router = APIRouter(prefix="/audit", tags=["Audit Events"])

@router.get("", response_model=List[AuditEventResponse])
def get_audit_trail(
    patient_id: Optional[str] = Query(None, description="Filter audit logs by patient ID"),
    resource_type: Optional[str] = Query(None, description="Filter by resource type (e.g. patient, observation, alert, simulation)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Database = Depends(get_database)
):
    """
    Retrieve minimal, non-sensitive audit event logs for compliance and data traceability.
    Excludes sensitive health information and credentials.
    """
    repo = AuditRepository(db)
    events, _ = repo.list_events(
        patient_id=patient_id,
        resource_type=resource_type,
        limit=limit,
        skip=skip
    )
    return events
