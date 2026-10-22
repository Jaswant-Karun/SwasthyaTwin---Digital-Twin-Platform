"""
SwasthyaTwin AI — Multi-Signal Health Intelligence Models
Defines structured data contracts for the integrated multi-signal timeline,
guaranteeing explicit separation and labeling between:
1. Probabilistic BiDSleep wearable ML sleep-stage predictions
2. Non-parametric nMAD cardiovascular statistical anomaly flags
3. Direct physiological telemetry observations
"""

from datetime import datetime
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field


class SleepStageDetail(BaseModel):
    stage_5class: str = Field(..., description="5-stage AASM label: Wake, N1, N2, N3, REM")
    stage_3class: str = Field(..., description="3-stage clinical label: Wake, NREM, REM")
    stage_display_name: str
    confidence_pct: float = Field(..., description="Model classification confidence percentage [0-100]")
    probabilities: Dict[str, float] = Field(default_factory=dict, description="Softmax probabilities across all 5 AASM stages")
    epoch_index: Optional[int] = None
    time_elapsed_minutes: Optional[float] = None
    ppg_features: Dict[str, float] = Field(default_factory=dict, description="Input optical PPG features extracted from 30s wearable window")
    model_name: str = "BiDSleep LightGBM 5-Stage AASM v1.0.0"
    model_architecture: str = "Gradient Boosted Trees (LightGBM)"
    inference_source: str = "Apple Watch Optical PPG Heart Rate Dynamics"


class CardiovascularAnomalyDetail(BaseModel):
    measured_heart_rate: float
    unit: str = "bpm"
    baseline_median: Optional[float] = None
    baseline_unit: str = "bpm"
    variability_measure: str = "nMAD"
    variability_value: Optional[float] = None
    upper_corridor: Optional[float] = None
    lower_corridor: Optional[float] = None
    delta_absolute: Optional[float] = None
    robust_score: Optional[float] = None
    anomaly_status: str = Field(..., description="within_personal_range | unusual_high | unusual_low | review_data_quality | insufficient_data")
    algorithm_version: str = "v1.2.0-robust-mad"
    sample_count: int = 0
    window_days: int = 30


class PhysiologicalObservationDetail(BaseModel):
    metric_type: str
    value: float
    unit: str
    source_type: str
    data_tier: str
    is_synthetic: bool = False


class MultiSignalTimelineItem(BaseModel):
    id: str
    signal_type: str = Field(..., description="'sleep_stage_prediction' | 'heart_rate_statistical_flag' | 'physiological_observation'")
    signal_category: str = Field(..., description="Human-readable category, e.g. 'BiDSleep Wearable Sleep ML', 'Cardiovascular Anomaly Intelligence'")
    signal_badge: str = Field(..., description="Short badge text for UI tag, e.g. 'BiDSLEEP ML', 'nMAD STATS', 'TELEMETRY'")
    timestamp: datetime
    title: str
    summary: str
    status_level: str = Field("normal", description="'normal' | 'elevated' | 'low' | 'review' | 'info' | 'deep_sleep' | 'rem_sleep'")
    status_label: str
    primary_metric: Optional[str] = None
    primary_value: Optional[Union[str, float, int]] = None
    primary_unit: Optional[str] = None
    
    # Mutually exclusive detail objects for each signal modality
    sleep_details: Optional[SleepStageDetail] = None
    cardiovascular_details: Optional[CardiovascularAnomalyDetail] = None
    observation_details: Optional[PhysiologicalObservationDetail] = None
    
    disclaimer: str = Field(..., description="Mandatory non-diagnostic or research disclaimer specific to this signal type")


class MultiSignalSummary(BaseModel):
    sleep_intelligence: Dict[str, Any] = Field(default_factory=dict)
    cardiovascular_intelligence: Dict[str, Any] = Field(default_factory=dict)
    cross_signal_insight: Dict[str, Any] = Field(default_factory=dict)


# Alias for backward/forward compatibility
MultiSignalItem = MultiSignalTimelineItem


class MultiSignalTimelineResponse(BaseModel):
    patient_id: str
    patient_name: str
    generated_at: datetime
    total_items: int
    filter_applied: str
    summary: MultiSignalSummary
    items: List[MultiSignalTimelineItem]

