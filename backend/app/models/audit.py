import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

class AuditEventBase(BaseModel):
    event_id: str = Field(default_factory=lambda: f"aud_{uuid.uuid4().hex[:12]}")
    action: str = Field(..., description="Action performed, e.g., create, update, delete, acknowledge")
    resource_type: str = Field(..., description="e.g., patient, observation, alert, simulation")
    resource_id: str = Field(..., description="Public identifier of the resource")
    patient_id: Optional[str] = Field(default=None, description="Associated patient ID if applicable")
    actor: str = Field(default="system", description="Identifier of the actor or API client")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    details: Dict[str, Any] = Field(default_factory=dict, description="Non-sensitive metadata only")

class AuditEventCreate(BaseModel):
    action: str
    resource_type: str
    resource_id: str
    patient_id: Optional[str] = None
    actor: Optional[str] = "system"
    details: Optional[Dict[str, Any]] = None

class AuditEventResponse(AuditEventBase):
    id: str = Field(alias="event_id")

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)
