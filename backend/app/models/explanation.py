from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field, ConfigDict

class WorkedExampleStep(BaseModel):
    step_number: int
    title: str
    description: str
    formula: Optional[str] = None
    calculation: str
    result: str

class CalculationExplanation(BaseModel):
    item_id: str
    category: str  # "metric" | "baseline" | "trend" | "alert" | "simulation"
    title: str
    metric_type: Optional[str] = None
    
    # 1. Current value and unit
    current_value: Optional[float] = None
    current_value_formatted: str
    unit: str
    
    # 2. Patient's baseline
    baseline_value: Optional[float] = None
    baseline_formatted: str
    
    # 3. Historical window used
    historical_window: str
    window_days: int
    
    # 4. Number of observations used
    observations_count: int
    observations_sufficiency: str
    is_sufficient: bool = True
    
    # 5. Formula applied
    formula_name: str
    formula_latex_or_text: str
    formula_explanation: str
    
    # 6. Worked numerical example using actual displayed data
    worked_example_steps: List[WorkedExampleStep] = Field(default_factory=list)
    worked_example_summary: str
    
    # 7. Data source and latest observation timestamp
    data_source: str
    latest_timestamp: Optional[str] = None
    latest_timestamp_formatted: str
    
    # 8. Reason a trend flag or alert was generated, if applicable
    reason_flag_or_alert: Optional[str] = None
    flag_severity: Optional[str] = None
    
    # 9. Missing-data or freshness warnings
    warnings: List[str] = Field(default_factory=list)
    is_stale: bool = False
    is_missing_data: bool = False
    
    # 10. Limitations and result type
    result_type: str  # "Rule-Based Indicator" | "Statistical Estimate" | "Model Prediction"
    limitations: str
    metadata: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(populate_by_name=True)

class SimulationExplanationRequest(BaseModel):
    patient_id: Optional[str] = None
    scenario_name: Optional[str] = "What-If Simulation"
    parameters: Optional[Dict[str, Any]] = None
    projected_outcomes: Optional[Dict[str, Any]] = None
    baseline_summary: Optional[Dict[str, Any]] = None
    metric_focus: Optional[str] = None

class PatientExplanationsResponse(BaseModel):
    patient_id: str
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    metrics: Dict[str, CalculationExplanation] = Field(default_factory=dict)
    baselines: Dict[str, CalculationExplanation] = Field(default_factory=dict)
    trends: Dict[str, CalculationExplanation] = Field(default_factory=dict)
    alerts: Dict[str, CalculationExplanation] = Field(default_factory=dict)
    simulation: Optional[CalculationExplanation] = None

    model_config = ConfigDict(populate_by_name=True)
