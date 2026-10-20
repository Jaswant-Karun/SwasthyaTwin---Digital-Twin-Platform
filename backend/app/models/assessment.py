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
    outlier_count: int = 0
    is_sufficient: bool = True
    iqr_lower_fence: Optional[float] = None
    iqr_upper_fence: Optional[float] = None
    calculated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    includes_simulated: bool = False
    data_tier: str = "measured"

class MeasurementAssessment(BaseModel):
    patient_id: str
    measurement_type: str
    observed_value: float
    personal_baseline: float
    unit: str
    absolute_deviation: float
    relative_deviation_percent: Optional[float] = None
    trend_direction: Optional[str] = None
    data_quality: Dict[str, Any] = Field(default_factory=dict)
    data_freshness: Dict[str, Any] = Field(default_factory=dict)
    rule_id: Optional[str] = None
    rule_version: Optional[str] = None
    explanation: str
    data_source: str = "wearable_continuous"
    assessed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    limitations: str = "Heuristic demonstration comparison against personal median; not a diagnostic clinical standard."

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
    iqr_distance: Optional[float] = None
    freshness_hours: Optional[float] = None
    is_stale: bool = False
    contributing_observation_id: Optional[str] = None
    # Requirement F fields and aliases
    observed_value: Optional[float] = None
    personal_baseline: Optional[float] = None
    absolute_deviation: Optional[float] = None
    relative_deviation_percent: Optional[float] = None
    relative_deviation_meaningful: bool = True
    relative_deviation_note: Optional[str] = None
    trend_direction: Optional[str] = None
    data_quality: Dict[str, Any] = Field(default_factory=dict)
    data_freshness: Dict[str, Any] = Field(default_factory=dict)
    rule_id: Optional[str] = None
    rule_version: Optional[str] = None
    explanation: Optional[str] = None
    data_source: str = "wearable_continuous"
    assessed_at: Optional[datetime] = None
    limitations: str = "Heuristic demonstration comparison against personal median; not a diagnostic clinical standard."

class ExplainabilityFactor(BaseModel):
    metric_type: str
    impact_score: float
    rule_name: str
    rationale: str
    severity: str
    rule_version: str = "v1.3.0-heuristic"
    contributing_observation_id: Optional[str] = None

class HealthAssessmentRecord(BaseModel):
    assessment_id: str = Field(default_factory=lambda: f"asmt_{uuid.uuid4().hex[:12]}")
    patient_id: str
    assessed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    baseline_window: int = 30
    indicator_type: str = "vitality_stability_index"
    indicator_value: float = 100.0
    methodology: str = "Standardized baseline Euclidean distance deduction against personal historical distribution"
    evidence: Dict[str, Any] = Field(default_factory=dict)
    limitations: str = "Non-diagnostic heuristic research indicator; not calibrated for acute emergency triage"
    model_version: str = "v1.3.0"

class HealthAssessmentResponse(BaseModel):
    assessment_id: Optional[str] = None
    patient_id: str
    calculated_at: datetime
    vitality_index: float
    stability_status: str
    deviations: Dict[str, MetricDeviation]
    explainability_factors: List[ExplainabilityFactor]
    summary_message: str
    safety_disclaimer: str
    missing_inputs: List[str] = Field(default_factory=list)
    component_contributions: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    data_freshness: Dict[str, Any] = Field(default_factory=dict)
    model_version: str = "v1.3.0-heuristic"

    model_config = ConfigDict(populate_by_name=True, from_attributes=True)

class MetricTrendSummary(BaseModel):
    metric_type: str
    unit: str
    current_value: float
    baseline_median: float
    baseline_iqr: float
    delta_from_baseline: float
    slope_7d: float
    direction: str
    volatility: float
    sample_count_30d: int
    freshness_hours: float
    is_stale: bool

class DigitalTwinStateResponse(BaseModel):
    patient_id: str
    snapshot_time: datetime
    baseline_window_days: int
    metrics: Dict[str, MetricDeviation]
    baselines: Dict[str, MetricBaseline] = Field(default_factory=dict)
    trends: Dict[str, MetricTrendSummary] = Field(default_factory=dict)
    overall_vitality: float
    stability_status: str
    active_alert_count: int
    missing_inputs: List[str] = Field(default_factory=list)
    missing_data_warnings: List[str] = Field(default_factory=list)
    data_quality: Dict[str, Any] = Field(default_factory=dict)
    data_freshness_hours: Optional[float] = None
    is_data_stale: bool = False

    model_config = ConfigDict(from_attributes=True)
