import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, ConfigDict

class InterventionParams(BaseModel):
    delta_sleep_hours: float = Field(default=0.0, ge=-4.0, le=4.0)
    delta_daily_steps: int = Field(default=0, ge=-8000, le=15000)
    delta_stress_level: float = Field(default=0.0, ge=-50.0, le=50.0)
    sodium_reduction_pct: float = Field(default=0.0, ge=0.0, le=50.0)
    duration_days: int = Field(default=30, ge=7, le=90)

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
    ml_vitality_projected: Optional[float] = None
    ml_risk_tier: Optional[str] = None

class SimulationRequest(BaseModel):
    scenario_name: str = Field(..., min_length=2, max_length=120)
    parameters: InterventionParams

class SimulationRecord(BaseModel):
    simulation_id: str = Field(default_factory=lambda: f"sim_{uuid.uuid4().hex[:12]}")
    patient_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    scenario_inputs: Dict[str, Any]
    baseline_summary: Dict[str, float]
    simulated_summary: Dict[str, Any]
    assumptions: List[str]
    model_version: str = "v1.2.0"
    trajectories: List[TrajectoryPoint] = Field(default_factory=list)

class SimulationResponse(BaseModel):
    simulation_id: str
    id: str = Field(alias="simulation_id")
    patient_id: str
    scenario_name: str
    created_at: datetime
    parameters: InterventionParams
    baseline_summary: Dict[str, float]
    projected_outcomes: Dict[str, Any]
    trajectories: List[TrajectoryPoint]
    model_assumptions: List[str]
    disclaimer: str

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)
