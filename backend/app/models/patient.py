from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class LifestyleProfile(BaseModel):
    baseline_sleep_hours: float = Field(default=7.5, ge=3.0, le=14.0)
    baseline_daily_steps: int = Field(default=7000, ge=500, le=50000)
    activity_level: str = Field(default="moderate") # sedentary, light, moderate, active, very_active
    diet_pattern: Optional[str] = Field(default="balanced")
    smoking_status: Optional[str] = Field(default="non_smoker")
    alcohol_consumption: Optional[str] = Field(default="occasional")
    stress_level: Optional[str] = Field(default="moderate")

class PatientBase(BaseModel):
    patient_id: str = Field(..., description="Unique alphanumeric identifier")
    full_name: str = Field(..., min_length=2, max_length=120)
    age: int = Field(..., ge=1, le=120)
    biological_sex: str = Field(..., pattern="^(male|female|other)$")
    baseline_window_days: int = Field(default=30, ge=7, le=180)
    chronic_conditions: List[str] = Field(default_factory=list)
    primary_physician: Optional[str] = None
    lifestyle_profile: LifestyleProfile = Field(default_factory=LifestyleProfile)

class PatientCreate(PatientBase):
    pass

class PatientUpdate(BaseModel):
    full_name: Optional[str] = None
    age: Optional[int] = None
    baseline_window_days: Optional[int] = None
    chronic_conditions: Optional[List[str]] = None
    lifestyle_profile: Optional[LifestyleProfile] = None

class PatientResponse(PatientBase):
    created_at: datetime
    updated_at: datetime
    active_alerts_count: int = 0
    total_observations_count: int = 0
    latest_vitality_index: Optional[float] = None
    stability_status: Optional[str] = None

    class Config:
        from_attributes = True
