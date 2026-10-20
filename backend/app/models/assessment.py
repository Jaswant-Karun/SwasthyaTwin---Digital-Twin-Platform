from datetime import datetime
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

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
    status: str # optimal, mild_deviation, moderate_drift, significant_deviation
    direction: str # elevated, suppressed, normal
    data_tier: str

class ExplainabilityFactor(BaseModel):
    metric_type: str
    impact_score: float # points deducted
    rule_name: str
    rationale: str
    severity: str

class HealthAssessmentResponse(BaseModel):
    patient_id: str
    calculated_at: datetime
    vitality_index: float # 0 - 100
    stability_status: str # optimal, mild_deviation, moderate_drift, significant_deviation
    deviations: Dict[str, MetricDeviation]
    explainability_factors: List[ExplainabilityFactor]
    summary_message: str
    safety_disclaimer: str

class DigitalTwinStateResponse(BaseModel):
    patient_id: str
    snapshot_time: datetime
    baseline_window_days: int
    metrics: Dict[str, MetricDeviation]
    overall_vitality: float
    stability_status: str
    active_alert_count: int
