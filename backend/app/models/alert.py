from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

class AlertBase(BaseModel):
    alert_id: Optional[str] = None
    patient_id: str
    timestamp: datetime
    severity: str = Field(..., pattern="^(info|warning|critical)$")
    metric_type: str
    title: str
    description: str
    current_value: float
    baseline_value: float
    unit: str
    z_score: float
    evidence: Dict[str, Any]
    suggested_action: str
    is_acknowledged: bool = False
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[str] = None
    acknowledgement_notes: Optional[str] = None

class AlertCreate(AlertBase):
    pass

class AlertAcknowledgeRequest(BaseModel):
    acknowledged_by: str = Field(default="Patient")
    notes: Optional[str] = None

class AlertResponse(AlertBase):
    alert_id: str
    id: str

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)
