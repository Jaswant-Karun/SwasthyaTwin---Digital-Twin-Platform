import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Literal
from pydantic import BaseModel, Field, ConfigDict, field_validator

DataKind = Literal["measured", "user_entered", "simulated"]

VALID_UNITS = {
    "heart_rate": ["bpm"],
    "blood_pressure_systolic": ["mmHg"],
    "blood_pressure_diastolic": ["mmHg"],
    "hrv_rmssd": ["ms"],
    "sleep_duration_hours": ["hours", "hrs", "h"],
    "daily_steps": ["steps", "count"],
    "spo2": ["%"],
    "fasting_blood_glucose": ["mg/dL", "mmol/L"],
    "respiratory_rate": ["breaths/min", "rpm"]
}

class ObservationBase(BaseModel):
    observation_id: str = Field(default_factory=lambda: f"obs_{uuid.uuid4().hex[:12]}")
    patient_id: str = Field(..., min_length=2, max_length=64)
    measurement_type: str = Field(..., description="e.g. heart_rate, blood_pressure_systolic, sleep_duration_hours")
    value: float
    unit: str
    observed_at: datetime
    source: str = Field(default="wearable_continuous")
    data_kind: DataKind = Field(default="measured")
    demo_data: bool = Field(default=False, description="Flag indicating synthetic demonstration record")
    is_synthetic: bool = Field(default=False, description="Explicit synthetic provenance indicator")
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @field_validator("observed_at", mode="before")
    @classmethod
    def ensure_timezone_aware(cls, v):
        if isinstance(v, str):
            v = datetime.fromisoformat(v.replace("Z", "+00:00"))
        if isinstance(v, datetime) and v.tzinfo is None:
            v = v.replace(tzinfo=timezone.utc)
        return v

    @field_validator("unit")
    @classmethod
    def validate_unit(cls, v, info):
        # Normalize unit string
        v_clean = v.strip()
        m_type = info.data.get("measurement_type")
        if m_type and m_type in VALID_UNITS:
            allowed = VALID_UNITS[m_type]
            if v_clean not in allowed and not any(v_clean.lower() == a.lower() for a in allowed):
                raise ValueError(f"Invalid unit '{v_clean}' for measurement_type '{m_type}'. Expected one of: {allowed}")
        return v_clean

    # Compatibility properties for frontend & legacy queries
    @property
    def metric_type(self) -> str:
        return self.measurement_type

    @property
    def timestamp(self) -> datetime:
        return self.observed_at

    @property
    def data_tier(self) -> str:
        # map user_entered to user_reported for frontend compatibility
        if self.data_kind == "user_entered":
            return "user_reported"
        return self.data_kind

class ObservationCreate(BaseModel):
    patient_id: str
    measurement_type: Optional[str] = None
    metric_type: Optional[str] = None # Support either field name
    value: float
    unit: str
    observed_at: Optional[datetime] = None
    timestamp: Optional[datetime] = None # Support either field name
    source: str = "wearable_continuous"
    data_kind: Optional[DataKind] = None
    data_tier: Optional[str] = None # Support either field name
    metadata: Optional[Dict[str, Any]] = None

    def to_observation_base(self, observation_id: Optional[str] = None) -> ObservationBase:
        m_type = self.measurement_type or self.metric_type or "general"
        obs_time = self.observed_at or self.timestamp or datetime.now(timezone.utc)
        
        # Map data_tier to data_kind
        kind = self.data_kind
        if not kind:
            if self.data_tier == "user_reported":
                kind = "user_entered"
            elif self.data_tier in ["measured", "simulated"]:
                kind = self.data_tier
            else:
                kind = "measured"

        return ObservationBase(
            observation_id=observation_id or f"obs_{uuid.uuid4().hex[:12]}",
            patient_id=self.patient_id,
            measurement_type=m_type,
            value=self.value,
            unit=self.unit,
            observed_at=obs_time,
            source=self.source,
            data_kind=kind,
            metadata=self.metadata or {}
        )

class BatchObservationCreate(BaseModel):
    observations: List[ObservationCreate]

class ObservationResponse(ObservationBase):
    id: str = Field(alias="observation_id")
    metric_type: str
    timestamp: datetime
    data_tier: str

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

class ObservationFilterParams(BaseModel):
    measurement_type: Optional[str] = None
    metric_type: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    data_kind: Optional[DataKind] = None
    data_tier: Optional[str] = None
    limit: int = Field(default=200, ge=1, le=2000)
    skip: int = Field(default=0, ge=0)

class PaginatedObservationsResponse(BaseModel):
    total: int
    skip: int
    limit: int
    items: List[ObservationResponse]
