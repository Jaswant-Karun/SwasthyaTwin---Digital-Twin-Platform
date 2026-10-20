import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field, ConfigDict

class MetricBaseline(BaseModel):
    metric_type: str
    unit: str
    mean: float
    std_dev: float
    median: float
    iqr: float
    q1: float
    q3: float
    min_val: float
    max_val: float
    sample_count: int
    window_days: int
    window_start: datetime
    window_end: datetime

class MetricDeviation(BaseModel):
    metric_type: str
    unit: str
    current_value: float
    baseline_mean: float
    baseline_std: float
    delta_absolute: float
    delta_percentage: float
    z_score: float
    status: str
    direction: str
    data_tier: str

class ExplainabilityFactor(BaseModel):
    metric_type: str
    impact_score: float
    rule_name: str
    rationale: str
    severity: str

class HealthAssessmentRecord(BaseModel):
    assessment_id: str = Field(default_factory=lambda: f"asmt_{uuid.uuid4().hex[:12]}")
    patient_id: str
    assessed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    baseline_window: int = 30
    indicator_type: str = "vitality_stability_index"
    indicator_value: float = 100.0
    methodology: str = "Z-Score distance deduction against personal historical baseline distribution"
    evidence: Dict[str, Any] = Field(default_factory=dict)
    limitations: str = "Non-diagnostic heuristic research indicator; not calibrated for acute emergency triage"
    model_version: str = "v1.2.0"

class HealthAssessmentResponse(BaseModel):
    assessment_id: Optional[str] = None
    _id: Optional[str] = None
    patient_id: str
    calculated_at: datetime
    vitality_index: float
    stability_status: str
    deviations: Dict[str, MetricDeviation]
    explainability_factors: List[ExplainabilityFactor]
    summary_message: str
    safety_disclaimer: str

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

class DigitalTwinStateResponse(BaseModel):
    patient_id: str
    snapshot_time: datetime
    baseline_window_days: int
    metrics: Dict[str, MetricDeviation]
    overall_vitality: float
    stability_status: str
    active_alert_count: int

    model_config = ConfigDict(from_attributes=True)
