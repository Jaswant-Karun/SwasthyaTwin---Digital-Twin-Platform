from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, ConfigDict

class ObservationBase(BaseModel):
    patient_id: str
    timestamp: datetime
    metric_type: str = Field(
        ...,
        description="Metric code e.g. heart_rate, blood_pressure_systolic, blood_pressure_diastolic, hrv_rmssd, spo2, sleep_duration_hours, daily_steps, etc."
    )
    value: float
    secondary_value: Optional[float] = Field(
        default=None,
        description="Optional secondary value, e.g. diastolic for blood pressure or REM % for sleep"
    )
    unit: str
    source: str = Field(default="wearable_continuous") # wearable_continuous, clinical_lab, manual_entry, synthetic_stream
    data_tier: str = Field(default="measured") # measured, user_reported, simulated
    notes: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)

class ObservationCreate(ObservationBase):
    pass

class BatchObservationCreate(BaseModel):
    observations: List[ObservationCreate]

class ObservationResponse(ObservationBase):
    id: str = Field(alias="_id")

    model_config = ConfigDict(populate_by_name=True)


class ObservationFilterParams(BaseModel):
    metric_type: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    data_tier: Optional[str] = None
    limit: int = Field(default=200, ge=1, le=2000)
    skip: int = Field(default=0, ge=0)

class PaginatedObservationsResponse(BaseModel):
    total: int
    skip: int
    limit: int
    items: List[ObservationResponse]
