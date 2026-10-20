from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, ConfigDict

class InterventionParams(BaseModel):
    delta_sleep_hours: float = Field(default=0.0, ge=-4.0, le=4.0, description="Change in sleep hours per night")
    delta_daily_steps: int = Field(default=0, ge=-8000, le=15000, description="Change in daily step count")
    delta_stress_level: float = Field(default=0.0, ge=-50.0, le=50.0, description="Stress reduction/increase percentage")
    sodium_reduction_pct: float = Field(default=0.0, ge=0.0, le=50.0, description="Dietary sodium reduction percentage")
    duration_days: int = Field(default=30, ge=7, le=90, description="Length of projection window")

class TrajectoryPoint(BaseModel):
    day: int
    date: str
    resting_hr: float
    resting_hr_upper: float
    resting_hr_lower: float
    systolic_bp: float
    systolic_bp_upper: float
    systolic_bp_lower: float
    hrv_rmssd: float
    hrv_rmssd_upper: float
    hrv_rmssd_lower: float
    vitality_projected: float

class SimulationRequest(BaseModel):
    scenario_name: str = Field(..., min_length=2, max_length=120)
    parameters: InterventionParams

class SimulationResponse(BaseModel):
    id: str = Field(alias="_id")
    patient_id: str
    scenario_name: str
    created_at: datetime
    parameters: InterventionParams
    baseline_summary: Dict[str, float]
    projected_outcomes: Dict[str, Any]
    trajectories: List[TrajectoryPoint]
    model_assumptions: List[str]
    disclaimer: str

    model_config = ConfigDict(populate_by_name=True)

