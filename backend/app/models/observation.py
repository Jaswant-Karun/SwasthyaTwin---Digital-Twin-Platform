import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List, Literal
from pydantic import BaseModel, Field, ConfigDict, field_validator

DataKind = Literal[
    "measured",
    "user_entered",
    "manual_entry",
    "wearable_imported",
    "imported_file",
    "device_measurement",
    "public_research_dataset",
    "synthetic_demo",
    "simulated"
]

VALID_UNITS = {
    "heart_rate": ["bpm"],
    "blood_pressure_systolic": ["mmHg"],
    "blood_pressure_diastolic": ["mmHg"],
    "hrv_rmssd": ["ms"],
    "sleep_duration_hours": ["hours", "hrs", "h"],
    "daily_steps": ["steps", "count"],
    "spo2": ["%"],
    "fasting_blood_glucose": ["mg/dL", "mmol/L"],
    "respiratory_rate": ["breaths/min", "rpm"],
    "body_weight": ["kg", "lbs", "lb"],
    "body_temperature": ["Celsius", "C", "F", "Fahrenheit"]
}

PHYSIOLOGICAL_BOUNDS = {
    "heart_rate": (25.0, 260.0, "bpm", "Resting Heart Rate"),
    "blood_pressure_systolic": (45.0, 300.0, "mmHg", "Systolic Blood Pressure"),
    "blood_pressure_diastolic": (25.0, 180.0, "mmHg", "Diastolic Blood Pressure"),
    "hrv_rmssd": (2.0, 350.0, "ms", "Heart Rate Variability (RMSSD)"),
    "sleep_duration_hours": (0.0, 24.0, "hours", "Sleep Duration"),
    "daily_steps": (0.0, 120000.0, "steps", "Daily Steps"),
    "spo2": (40.0, 100.0, "%", "Blood Oxygen (SpO2)"),
    "fasting_blood_glucose": (15.0, 800.0, "mg/dL", "Fasting Blood Glucose"),
    "respiratory_rate": (4.0, 70.0, "breaths/min", "Respiratory Rate"),
    "body_weight": (15.0, 450.0, "kg", "Body Weight"),
    "body_temperature": (28.0, 44.0, "Celsius", "Body Temperature")
}

def validate_and_normalize_measurement(m_type: str, val: float, unit: str) -> tuple[float, str]:
    """Validate physiological plausibility and auto-normalize units without false alarm disease labeling."""
    from app.analytics.unit_converter import convert_to_canonical_unit
    try:
        val, canon_unit, _, _ = convert_to_canonical_unit(m_type, val, unit)
        return val, canon_unit
    except Exception:
        clean_type = m_type.strip().lower()
        clean_unit = unit.strip()

        # Supported Unit Conversions
        if clean_type == "fasting_blood_glucose" and clean_unit.lower() == "mmol/l":
            val = round(val * 18.0182, 1)
            clean_unit = "mg/dL"
        elif clean_type == "sleep_duration_hours" and clean_unit.lower() in ["hrs", "h"]:
            clean_unit = "hours"
        elif clean_type == "daily_steps" and clean_unit.lower() == "count":
            clean_unit = "steps"
        elif clean_type == "respiratory_rate" and clean_unit.lower() == "rpm":
            clean_unit = "breaths/min"

        return val, clean_unit

class ObservationBase(BaseModel):
    observation_id: str = Field(default_factory=lambda: f"obs_{uuid.uuid4().hex[:12]}")
    patient_id: str = Field(..., min_length=2, max_length=64)
    measurement_type: str = Field(..., description="e.g. heart_rate, blood_pressure_systolic, sleep_duration_hours")
    value: float
    unit: str
    observed_at: datetime
    source: str = Field(default="wearable_continuous")
    source_type: Optional[str] = Field(default=None, description="manual_entry, imported_file, device_measurement, synthetic_demo")
    device_id: Optional[str] = Field(default=None, description="Identifier of device or import batch")
    data_kind: DataKind = Field(default="measured")
    notes: Optional[str] = Field(default=None, max_length=500)
    validation_status: str = Field(default="valid", description="valid, confirmed_unusual, valid_with_warnings, flagged, rejected")
    validation_warnings: List[str] = Field(default_factory=list)
    requires_confirmation: bool = Field(default=False)
    confirmed_by_user: bool = Field(default=False)
    edit_history: List[Dict[str, Any]] = Field(default_factory=list)
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
        v_clean = v.strip()
        m_type = info.data.get("measurement_type")
        if m_type and m_type in VALID_UNITS:
            allowed = VALID_UNITS[m_type]
            if not any(v_clean.lower() == a.lower() for a in allowed):
                raise ValueError(f"Invalid unit '{v_clean}' for measurement_type '{m_type}'. Expected one of: {allowed}")
        return v_clean

    @property
    def metric_type(self) -> str:
        return self.measurement_type

    @property
    def timestamp(self) -> datetime:
        return self.observed_at

    @property
    def data_tier(self) -> str:
        if self.data_kind in ["user_entered", "user_reported"]:
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
    source: str = "manual_entry"
    source_type: Optional[str] = None
    device_id: Optional[str] = None
    confirm_unusual: bool = False
    paired_measurements: Optional[Dict[str, float]] = None
    data_kind: Optional[DataKind] = None
    data_tier: Optional[str] = None # Support either field name
    notes: Optional[str] = Field(default=None, max_length=500)
    metadata: Optional[Dict[str, Any]] = None

    def to_observation_base(self, observation_id: Optional[str] = None) -> ObservationBase:
        m_type = self.measurement_type or self.metric_type or "general"
        obs_time = self.observed_at or self.timestamp or datetime.now(timezone.utc)
        
        # Physiological range and unit validation & normalization
        normalized_val, normalized_unit = validate_and_normalize_measurement(m_type, self.value, self.unit)
        
        # Map data_tier to data_kind
        kind = self.data_kind
        if not kind:
            if self.data_tier in ["user_reported", "user_entered", "manual_entry"]:
                kind = "user_entered"
            elif self.data_tier in ["wearable_imported", "imported_measured", "imported_file"]:
                kind = "wearable_imported"
            elif self.data_tier in ["measured", "simulated", "synthetic_demo", "device_measurement"]:
                kind = self.data_tier
            else:
                kind = "user_entered"

        return ObservationBase(
            observation_id=observation_id or f"obs_{uuid.uuid4().hex[:12]}",
            patient_id=self.patient_id,
            measurement_type=m_type,
            value=normalized_val,
            unit=normalized_unit,
            observed_at=obs_time,
            source=self.source,
            source_type=self.source_type or (self.source if self.source in ["manual_entry", "imported_file", "device_measurement", "synthetic_demo"] else "manual_entry"),
            device_id=self.device_id,
            data_kind=kind,
            notes=self.notes,
            metadata=self.metadata or {}
        )

class ObservationUpdate(BaseModel):
    value: Optional[float] = None
    unit: Optional[str] = None
    observed_at: Optional[datetime] = None
    notes: Optional[str] = None
    correction_reason: Optional[str] = Field(default=None, description="Audit reason for modifying historical telemetry")

class BatchObservationCreate(BaseModel):
    observations: List[ObservationCreate]

class BaselineSummary(BaseModel):
    mean: float
    median: float
    std_dev: float
    iqr: float
    sample_count: int
    window_days: int
    is_sufficient: bool
    unit: str

class DeviationSummary(BaseModel):
    delta_absolute: float
    delta_percentage: float
    z_score: float
    status: str
    direction: str
    relative_is_excluded: bool = False
    exclusion_reason: Optional[str] = None

class AssessmentUpdateMetadata(BaseModel):
    patient_id: str
    metric_type: str
    observed_value: float
    unit: str
    observed_at: datetime
    is_first_observation: bool = False
    sufficiency_message: Optional[str] = None
    previous_baseline: Optional[BaselineSummary] = None
    updated_baseline: Optional[BaselineSummary] = None
    deviation: Optional[DeviationSummary] = None
    vitality_index: Optional[float] = None
    previous_vitality_index: Optional[float] = None
    stability_status: Optional[str] = None
    triggered_alert: Optional[Dict[str, Any]] = None
    explanation: Optional[str] = None

class ObservationResponse(ObservationBase):
    id: str = Field(default="")
    observation_id: str
    metric_type: str
    timestamp: datetime
    data_tier: str
    notes: Optional[str] = None
    demo_data: bool = False
    is_synthetic: bool = False
    assessment_update: Optional[AssessmentUpdateMetadata] = None

    @field_validator("id", mode="before")
    @classmethod
    def resolve_id(cls, v, info):
        if not v and "observation_id" in info.data:
            return info.data["observation_id"]
        return v or ""

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

class CSVValidationRow(BaseModel):
    row_number: int
    patient_id: str
    measurement_type: str
    value: Optional[float]
    unit: str
    observed_at: Optional[str]
    source: str
    data_kind: str
    notes: Optional[str] = None
    is_valid: bool
    errors: List[str] = Field(default_factory=list)
    is_duplicate: bool = False

class CSVValidationResponse(BaseModel):
    total_rows: int
    valid_rows_count: int
    invalid_rows_count: int
    duplicate_rows_count: int
    rows: List[CSVValidationRow]
    can_import: bool

class CSVImportRequest(BaseModel):
    rows: List[Dict[str, Any]]
    skip_duplicates: bool = True
