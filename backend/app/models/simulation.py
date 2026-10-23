import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, ConfigDict, model_validator

class InterventionParams(BaseModel):
    delta_sleep_hours: float = Field(default=0.0, ge=-4.0, le=4.0, description="Hypothetical change in nocturnal sleep duration (hours/night)")
    delta_daily_steps: int = Field(default=0, ge=-8000, le=15000, description="Hypothetical change in daily physical step count (steps/day)")
    delta_stress_level: float = Field(default=0.0, ge=-50.0, le=50.0, description="Hypothetical shift in subjective distress/arousal (%)")
    sodium_reduction_pct: float = Field(default=0.0, ge=0.0, le=50.0, description="Hypothetical dietary sodium reduction percentage (%)")
    duration_days: int = Field(default=30, ge=7, le=90, description="Hypothetical simulation evaluation window (days)")

    @model_validator(mode="after")
    def validate_contradictions(self) -> "InterventionParams":
        """Rejects contradictory or biologically implausible combinations."""
        # e.g., Extreme sleep deprivation with extreme endurance load increase
        if self.delta_sleep_hours <= -3.0 and self.delta_daily_steps >= 10000:
            raise ValueError(
                "Contradictory scenario parameters: Severe sleep restriction (-3.0h) combined with high-volume step increase (+10k) exceeds biological adaptive capacity."
            )
        return self

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
    data_tier: str = Field(default="simulated", description="Always marked 'simulated' to protect real measured data")

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
    model_version: str = "v2.1.0"
    data_tier: str = "simulated"
    trajectories: List[TrajectoryPoint] = Field(default_factory=list)

class SimulationResponse(BaseModel):
    simulation_id: str
    id: str = Field(alias="simulation_id")
    patient_id: str
    scenario_name: str
    created_at: datetime
    parameters: InterventionParams
    baseline_summary: Dict[str, float]
    baseline_scenario: Optional[Dict[str, Any]] = None
    hypothetical_scenario: Optional[Dict[str, Any]] = None
    projected_outcomes: Dict[str, Any]
    trajectories: List[TrajectoryPoint]
    model_assumptions: List[str]
    limitations: Optional[str] = None
    disclaimer: str
    data_tier: str = Field(default="simulated", description="Always labeled 'simulated'")
    model_version: str = Field(default="v2.1.0", description="Simulation model version")
    output_classifications: Dict[str, str] = Field(
        default_factory=lambda: {
            "resting_hr": "deterministic_calculation",
            "systolic_bp": "deterministic_calculation",
            "hrv_rmssd": "deterministic_calculation",
            "vitality_index": "hybrid_calculation",
            "ml_risk_tier": "model_prediction",
            "lifestyle_adherence": "illustrative_assumption"
        }
    )

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)
