export type BiologicalSex = 'male' | 'female' | 'other';
export type StabilityStatus = 'optimal' | 'mild_deviation' | 'moderate_drift' | 'significant_deviation';
export type SeverityLevel = 'info' | 'warning' | 'critical';
export type DataTier = 'measured' | 'user_reported' | 'simulated';
export type DataClassification = 'user_entered' | 'wearable_imported' | 'synthetic_demo' | 'simulated' | 'measured';

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
  notes?: string;
  consent_confirmed?: boolean;
  demo_data?: boolean;
  is_synthetic?: boolean;
  created_at: string;
  updated_at: string;
  active_alerts_count: number;
  total_observations_count: number;
  latest_vitality_index?: number;
  stability_status?: StabilityStatus;
}

export interface BaselineSummary {
  mean: number;
  median: number;
  std_dev: number;
  iqr: number;
  sample_count: number;
  window_days: number;
  is_sufficient: boolean;
  unit: string;
}

export interface DeviationSummary {
  delta_absolute: number;
  delta_percentage: number;
  z_score: number;
  status: string;
  direction: string;
  relative_is_excluded?: boolean;
  exclusion_reason?: string;
}

export interface AssessmentUpdateMetadata {
  patient_id: string;
  metric_type: string;
  observed_value: number;
  unit: string;
  observed_at: string;
  is_first_observation: boolean;
  sufficiency_message?: string;
  previous_baseline?: BaselineSummary;
  updated_baseline?: BaselineSummary;
  deviation?: DeviationSummary;
  vitality_index?: number;
  previous_vitality_index?: number;
  stability_status?: string;
  triggered_alert?: {
    alert_id?: string;
    severity?: string;
    title?: string;
    description?: string;
    suggested_action?: string;
  };
  explanation?: string;
}

export interface Observation {
  _id: string;
  observation_id?: string;
  patient_id: string;
  timestamp: string;
  metric_type: string;
  value: number;
  secondary_value?: number;
  unit: string;
  source: string;
  data_tier: DataTier;
  data_classification?: DataClassification | string;
  notes?: string;
  metadata?: Record<string, any>;
  assessment_update?: AssessmentUpdateMetadata;
}

export interface PatientCreateInput {
  patient_id?: string;
  full_name: string;
  age?: number;
  biological_sex?: BiologicalSex;
  baseline_window_days?: number;
  chronic_conditions?: string[];
  primary_physician?: string;
  lifestyle_profile?: Partial<LifestyleProfile>;
  notes?: string;
  consent_confirmed?: boolean;
}

export interface PatientUpdateInput {
  full_name?: string;
  age?: number;
  biological_sex?: BiologicalSex;
  baseline_window_days?: number;
  chronic_conditions?: string[];
  primary_physician?: string;
  lifestyle_profile?: Partial<LifestyleProfile>;
  notes?: string;
}

export interface ObservationCreateInput {
  patient_id?: string;
  timestamp?: string;
  metric_type: string;
  value: number;
  secondary_value?: number;
  unit: string;
  source?: string;
  data_tier?: DataTier;
  data_classification?: DataClassification | string;
  notes?: string;
}

export interface ObservationUpdateInput {
  value?: number;
  unit?: string;
  reason_for_edit: string;
  notes?: string;
}

export interface CSVValidationRow {
  row_index: number;
  patient_id: string;
  metric_type: string;
  value: number;
  unit: string;
  timestamp: string;
  source?: string;
  notes?: string;
  is_valid: boolean;
  errors: string[];
  is_duplicate: boolean;
}

export interface CSVValidationResult {
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  rows: CSVValidationRow[];
  errors: string[];
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
  ml_vitality_projected?: number;
  ml_risk_tier?: string;
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
    ml_predicted_vitality_delta?: number;
    ml_baseline_risk_tier?: string;
    ml_projected_risk_tier?: string;
    ml_baseline_phenotype?: string;
    ml_projected_phenotype?: string;
    ml_risk_reduction_pct?: number;
    ml_confidence_pct?: number;
    ml_model_version?: string;
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

export interface WorkedExampleStep {
  step_number: number;
  title: string;
  description: string;
  formula?: string;
  calculation: string;
  result: string;
}

export interface CalculationExplanation {
  item_id: string;
  category: 'metric' | 'baseline' | 'trend' | 'alert' | 'simulation' | string;
  title: string;
  metric_type?: string;

  // 1. Current value and unit
  current_value?: number | null;
  current_value_formatted: string;
  unit: string;

  // 2. Patient baseline
  baseline_value?: number | null;
  baseline_formatted: string;

  // 3. Historical window
  historical_window: string;
  window_days: number;

  // 4. Number of observations
  observations_count: number;
  observations_sufficiency: string;
  is_sufficient: boolean;

  // 5. Formula applied
  formula_name: string;
  formula_latex_or_text: string;
  formula_explanation: string;

  // 6. Worked numerical example matching displayed data
  worked_example_steps: WorkedExampleStep[];
  worked_example_summary: string;

  // 7. Data source and latest observation timestamp
  data_source: string;
  latest_timestamp?: string | null;
  latest_timestamp_formatted: string;

  // 8. Reason trend flag or alert generated
  reason_flag_or_alert?: string | null;
  flag_severity?: string | null;

  // 9. Missing-data or freshness warnings
  warnings: string[];
  is_stale: boolean;
  is_missing_data: boolean;

  // 10. Limitations and result type
  result_type: 'Rule-Based Indicator' | 'Statistical Estimate' | 'Model Prediction' | string;
  limitations: string;
  metadata?: Record<string, any>;
}

export interface SimulationExplanationRequest {
  patient_id?: string;
  scenario_name?: string;
  parameters?: Record<string, any>;
  projected_outcomes?: Record<string, any>;
  baseline_summary?: Record<string, any>;
  metric_focus?: string;
}

export interface PatientExplanationsResponse {
  patient_id: string;
  generated_at: string;
  metrics: Record<string, CalculationExplanation>;
  baselines: Record<string, CalculationExplanation>;
  trends: Record<string, CalculationExplanation>;
  alerts: Record<string, CalculationExplanation>;
  simulation?: CalculationExplanation | null;
}

export interface InputPlausibilityResult {
  is_plausible: boolean;
  plausibility_score: number;
  confidence_weight: number;
  warnings: string[];
  suggested_value?: number | null;
  evaluated_metric: string;
  evaluated_value: number;
}

export interface MLPredictionResult {
  status?: string;
  warnings?: string[];
  limitations?: string[];
  model_version?: string;
  units?: Record<string, string>;
  data_provenance?: {
    patient_id: string;
    is_synthetic: boolean;
    feature_sources?: Record<string, string>;
    features_evaluated?: string[];
    missing_features?: string[];
    stale_features?: string[];
  };
  patient_id: string;
  patient_name: string;
  predicted_risk_tier?: string;
  risk_probabilities?: {
    low_resilient: number;
    moderate_drift: number;
    elevated_strain: number;
  };
  predicted_14d_vitality_delta?: number;
  health_phenotype?: string;
  phenotype_description?: string;
  top_driving_factors?: Array<{
    feature: string;
    importance_pct: number;
    current_value: number;
  }>;
  radar_scores?: {
    cardiovascular_stability: number;
    autonomic_reserve: number;
    circadian_alignment: number;
    metabolic_vitality: number;
    input_credibility: number;
  };
  model_metadata?: {
    algorithm: string;
    training_samples: number;
    confidence_score: number;
    evaluated_at: string;
    version?: string;
  };
}

export interface AIScanResult {
  patient_id: string;
  scan_timestamp: string;
  scan_source: string;
  is_valid: boolean;
  overall_credibility_score: number;
  signal_quality_pct: number;
  extracted_biometrics: {
    heart_rate: { value: number; unit: string; valid: boolean };
    hrv_rmssd: { value: number; unit: string; valid: boolean };
    respiratory_rate: { value: number; unit: string; valid: boolean };
  };
  plausibility_audit: {
    heart_rate_warnings: string[];
    hrv_warnings: string[];
  };
  ml_prediction: MLPredictionResult;
  persisted_observation_ids: string[];
  twin_updated: boolean;
  clinical_disclaimer: string;
}

export interface MLClusterSummary {
  cluster_id: number;
  name: string;
  archetype: string;
  summary: string;
  color: string;
  profile: {
    heart_rate: number;
    systolic_bp: number;
    diastolic_bp: number;
    pulse_pressure: number;
    hrv_rmssd: number;
    sleep_duration: number;
    daily_steps: number;
  };
}

export interface MLFeatureImportanceItem {
  feature: string;
  display_name: string;
  importance_pct: number;
}

export interface MLModelManifest {
  version: string;
  trained_at: string;
  training_duration_seconds: number;
  dataset_summary: {
    total_samples: number;
    train_samples: number;
    test_samples: number;
    features_count: number;
    feature_names: string[];
  };
  classification_metrics: {
    algorithm: string;
    test_accuracy: number;
    test_precision: number;
    test_recall: number;
    test_f1_score: number;
    roc_auc_ovr: number;
    cross_validation_5fold: {
      fold_scores: number[];
      mean_score: number;
      std_score: number;
    };
    confusion_matrix: number[][];
    class_labels: string[];
  };
  baseline_comparison: {
    algorithm: string;
    test_accuracy: number;
    test_f1_score: number;
    accuracy_improvement_pct: number;
  };
  regression_metrics: {
    algorithm: string;
    mae: number;
    rmse: number;
    r2_score: number;
    target: string;
  };
  unsupervised_phenotypes: {
    algorithm: string;
    clusters: MLClusterSummary[];
  };
  dimensionality_reduction: {
    algorithm: string;
    explained_variance_ratio: number[];
    total_explained_variance_pct: number;
    sample_scatter_points: Array<{
      x: number;
      y: number;
      cluster: number;
      risk_class: number;
    }>;
  };
  feature_importance: MLFeatureImportanceItem[];
}


