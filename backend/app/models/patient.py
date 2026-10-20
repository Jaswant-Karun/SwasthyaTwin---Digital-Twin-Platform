from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict, field_validator

class LifestyleProfile(BaseModel):
    baseline_sleep_hours: float = Field(default=7.5, ge=3.0, le=14.0)
    baseline_daily_steps: int = Field(default=7000, ge=500, le=50000)
    activity_level: str = Field(default="moderate")
    diet_pattern: Optional[str] = Field(default="balanced")
    smoking_status: Optional[str] = Field(default="non_smoker")
    alcohol_consumption: Optional[str] = Field(default="occasional")
    stress_level: Optional[str] = Field(default="moderate")

class PatientBase(BaseModel):
    patient_id: str = Field(..., min_length=2, max_length=64, description="Unique alphanumeric identifier")
    display_name: str = Field(..., min_length=2, max_length=120, description="Patient display name")
    age: Optional[int] = Field(default=None, ge=1, le=125)
    gender: Optional[str] = Field(default="unspecified", pattern="^(male|female|other|unspecified)$")
    baseline_window_days: int = Field(default=30, ge=7, le=180)
    chronic_conditions: List[str] = Field(default_factory=list)
    primary_physician: Optional[str] = None
    lifestyle_profile: LifestyleProfile = Field(default_factory=LifestyleProfile)
    demo_data: bool = Field(default=False, description="Flag indicating synthetic demonstration record")
    is_synthetic: bool = Field(default=False, description="Explicit synthetic provenance indicator")

    # Compatibility alias so frontend reading 'full_name' or 'biological_sex' works cleanly
    @property
    def full_name(self) -> str:
        return self.display_name

    @property
    def biological_sex(self) -> str:
        return self.gender or "other"

class PatientCreate(BaseModel):
    patient_id: str = Field(..., min_length=2, max_length=64)
    display_name: Optional[str] = None
    full_name: Optional[str] = None # Support either field name
    age: Optional[int] = Field(default=None, ge=1, le=125)
    gender: Optional[str] = None
    biological_sex: Optional[str] = None
    baseline_window_days: int = Field(default=30, ge=7, le=180)
    chronic_conditions: List[str] = Field(default_factory=list)
    primary_physician: Optional[str] = None
    lifestyle_profile: Optional[LifestyleProfile] = Field(default_factory=LifestyleProfile)
    demo_data: bool = Field(default=False)
    is_synthetic: bool = Field(default=False)

    @field_validator("display_name", mode="before")
    @classmethod
    def resolve_name(cls, v, values):
        return v

    def to_patient_base(self) -> PatientBase:
        resolved_name = self.display_name or self.full_name or "Anonymous Patient"
        resolved_gender = self.gender or self.biological_sex or "unspecified"
        is_syn = self.is_synthetic or self.demo_data
        return PatientBase(
            patient_id=self.patient_id,
            display_name=resolved_name,
            age=self.age,
            gender=resolved_gender,
            baseline_window_days=self.baseline_window_days,
            chronic_conditions=self.chronic_conditions,
            primary_physician=self.primary_physician,
            lifestyle_profile=self.lifestyle_profile or LifestyleProfile(),
            demo_data=self.demo_data or is_syn,
            is_synthetic=is_syn
        )

class PatientUpdate(BaseModel):
    display_name: Optional[str] = None
    full_name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    biological_sex: Optional[str] = None
    baseline_window_days: Optional[int] = None
    chronic_conditions: Optional[List[str]] = None
    primary_physician: Optional[str] = None
    lifestyle_profile: Optional[LifestyleProfile] = None

class PatientResponse(PatientBase):
    full_name: str
    biological_sex: str
    is_synthetic: bool = False
    created_at: datetime
    updated_at: datetime
    active_alerts_count: int = 0
    total_observations_count: int = 0
    latest_vitality_index: Optional[float] = None
    stability_status: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
