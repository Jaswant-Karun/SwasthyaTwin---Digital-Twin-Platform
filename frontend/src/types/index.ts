export type BiologicalSex = 'male' | 'female' | 'other';
export type StabilityStatus = 'optimal' | 'mild_deviation' | 'moderate_drift' | 'significant_deviation';
export type SeverityLevel = 'info' | 'warning' | 'critical';
export type DataTier = 'measured' | 'user_reported' | 'simulated';

export interface LifestyleProfile {
  baseline_sleep_hours: number;
  baseline_daily_steps: number;
  activity_level: string;
  diet_pattern?: string;
  smoking_status?: string;
  alcohol_consumption?: string;
  stress_level?: string;
}

export interface Patient {
  patient_id: string;
  full_name: string;
  age: number;
  biological_sex: BiologicalSex;
  baseline_window_days: number;
  chronic_conditions: string[];
  primary_physician?: string;
  lifestyle_profile: LifestyleProfile;
  created_at: string;
  updated_at: string;
  active_alerts_count: number;
  total_observations_count: number;
  latest_vitality_index?: number;
  stability_status?: StabilityStatus;
}

export interface Observation {
  _id: string;
  patient_id: string;
  timestamp: string;
  metric_type: string;
  value: number;
  secondary_value?: number;
  unit: string;
  source: string;
  data_tier: DataTier;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface MetricBaseline {
  metric_type: string;
  unit: string;
  mean: number;
  std_dev: number;
  median: number;
  iqr: number;
  q1: number;
  q3: number;
  min_val: number;
  max_val: number;
  sample_count: number;
  window_days: number;
  window_start: string;
  window_end: string;
}

export interface MetricDeviation {
  metric_type: string;
  unit: string;
  current_value: number;
  baseline_mean: number;
  baseline_std: number;
  delta_absolute: number;
  delta_percentage: number;
  z_score: number;
  status: StabilityStatus;
  direction: 'elevated' | 'suppressed' | 'normal';
  data_tier: DataTier;
}

export interface DigitalTwinState {
  patient_id: string;
  snapshot_time: string;
  baseline_window_days: number;
  metrics: Record<string, MetricDeviation>;
  baselines?: Record<string, MetricBaseline>;
  trends?: Record<string, any>;
  overall_vitality: number;
  stability_status: StabilityStatus;
  active_alert_count: number;
  missing_inputs?: string[];
  missing_data_warnings?: string[];
  data_quality?: Record<string, any>;
  data_freshness_hours?: number;
  is_data_stale?: boolean;
}

export interface ExplainabilityFactor {
  metric_type: string;
  impact_score: number;
  rule_name: string;
  rationale: string;
  severity: SeverityLevel;
}

export interface HealthAssessment {
  _id?: string;
  assessment_id?: string;
  patient_id: string;
  calculated_at: string;
  vitality_index: number;
  stability_status: StabilityStatus;
  deviations: Record<string, MetricDeviation>;
  explainability_factors: ExplainabilityFactor[];
  summary_message: string;
  safety_disclaimer: string;
  missing_inputs?: string[];
  component_contributions?: Record<string, any>;
}


export interface InterventionParams {
  delta_sleep_hours: number;
  delta_daily_steps: number;
  delta_stress_level: number;
  sodium_reduction_pct: number;
  duration_days: number;
}

export interface TrajectoryPoint {
  day: number;
  date: string;
  resting_hr: number;
  resting_hr_upper: number;
  resting_hr_lower: number;
  systolic_bp: number;
  systolic_bp_upper: number;
  systolic_bp_lower: number;
  hrv_rmssd: number;
  hrv_rmssd_upper: number;
  hrv_rmssd_lower: number;
  vitality_projected: number;
}

export interface SimulationResult {
  _id: string;
  patient_id: string;
  scenario_name: string;
  created_at: string;
  parameters: InterventionParams;
  baseline_summary: Record<string, number>;
  projected_outcomes: {
    final_resting_hr: number;
    delta_resting_hr: number;
    final_systolic_bp: number;
    delta_systolic_bp: number;
    final_hrv_rmssd: number;
    delta_hrv_rmssd: number;
    final_vitality: number;
  };
  trajectories: TrajectoryPoint[];
  model_assumptions: string[];
  disclaimer: string;
}

export interface Alert {
  _id: string;
  patient_id: string;
  timestamp: string;
  severity: SeverityLevel;
  metric_type: string;
  title: string;
  description: string;
  current_value: number;
  baseline_value: number;
  unit: string;
  z_score: number;
  evidence: Record<string, any>;
  suggested_action: string;
  is_acknowledged: boolean;
  acknowledged_at?: string;
  acknowledged_by?: string;
  acknowledgement_notes?: string;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded';
  service: string;
  version: string;
  environment: string;
  database: {
    status: string;
    engine: string;
    database_name: string;
    fallback_active: boolean;
    connection_error?: string;
  };
  disclaimer: string;
}
