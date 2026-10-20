import {
  Patient,
  DigitalTwinState,
  HealthAssessment,
  Alert,
  Observation,
  SimulationResult,
  SystemHealth
} from '../types';

export const MOCK_PATIENTS: Patient[] = [
  {
    patient_id: "PT-1001",
    full_name: "Aarav Mehta",
    age: 38,
    biological_sex: "male",
    baseline_window_days: 30,
    chronic_conditions: ["Work-Related Autonomic Fatigue"],
    primary_physician: "Dr. Ananya Sen, MD (Preventive Cardiology)",
    lifestyle_profile: {
      baseline_sleep_hours: 7.5,
      baseline_daily_steps: 7500,
      activity_level: "moderate",
      diet_pattern: "Mediterranean / Vegetarian",
      smoking_status: "non_smoker",
      alcohol_consumption: "occasional",
      stress_level: "elevated"
    },
    created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    active_alerts_count: 3,
    total_observations_count: 720,
    latest_vitality_index: 84.5,
    stability_status: "mild_deviation"
  },
  {
    patient_id: "PT-1002",
    full_name: "Priya Sharma",
    age: 54,
    biological_sex: "female",
    baseline_window_days: 30,
    chronic_conditions: ["Essential Hypertension (Stage 1)"],
    primary_physician: "Dr. Rajesh Kulkarni, MD",
    lifestyle_profile: {
      baseline_sleep_hours: 6.8,
      baseline_daily_steps: 4200,
      activity_level: "light",
      diet_pattern: "Low Sodium DASH",
      smoking_status: "non_smoker",
      alcohol_consumption: "none",
      stress_level: "moderate"
    },
    created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    active_alerts_count: 1,
    total_observations_count: 720,
    latest_vitality_index: 92.0,
    stability_status: "optimal"
  },
  {
    patient_id: "PT-1003",
    full_name: "Devan Nair",
    age: 28,
    biological_sex: "male",
    baseline_window_days: 30,
    chronic_conditions: ["High-Performance Endurance Athlete"],
    primary_physician: "Dr. Marcus Vance, Sports Medicine",
    lifestyle_profile: {
      baseline_sleep_hours: 8.2,
      baseline_daily_steps: 14000,
      activity_level: "very_active",
      diet_pattern: "High-Protein Endurance",
      smoking_status: "non_smoker",
      alcohol_consumption: "none",
      stress_level: "moderate"
    },
    created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    active_alerts_count: 2,
    total_observations_count: 720,
    latest_vitality_index: 76.2,
    stability_status: "moderate_drift"
  }
];

export const MOCK_TWIN_STATE: Record<string, DigitalTwinState> = {
  "PT-1001": {
    patient_id: "PT-1001",
    snapshot_time: new Date().toISOString(),
    baseline_window_days: 30,
    overall_vitality: 84.5,
    stability_status: "mild_deviation",
    active_alert_count: 3,
    metrics: {
      heart_rate: {
        metric_type: "heart_rate",
        unit: "bpm",
        current_value: 76.0,
        baseline_mean: 64.2,
        baseline_std: 3.1,
        delta_absolute: 11.8,
        delta_percentage: 18.4,
        z_score: 3.81,
        status: "significant_deviation",
        direction: "elevated",
        data_tier: "measured"
      },
      blood_pressure_systolic: {
        metric_type: "blood_pressure_systolic",
        unit: "mmHg",
        current_value: 126.0,
        baseline_mean: 118.4,
        baseline_std: 4.2,
        delta_absolute: 7.6,
        delta_percentage: 6.4,
        z_score: 1.81,
        status: "mild_deviation",
        direction: "elevated",
        data_tier: "measured"
      },
      blood_pressure_diastolic: {
        metric_type: "blood_pressure_diastolic",
        unit: "mmHg",
        current_value: 82.0,
        baseline_mean: 76.5,
        baseline_std: 3.0,
        delta_absolute: 5.5,
        delta_percentage: 7.2,
        z_score: 1.83,
        status: "mild_deviation",
        direction: "elevated",
        data_tier: "measured"
      },
      hrv_rmssd: {
        metric_type: "hrv_rmssd",
        unit: "ms",
        current_value: 34.0,
        baseline_mean: 55.8,
        baseline_std: 5.4,
        delta_absolute: -21.8,
        delta_percentage: -39.1,
        z_score: -4.04,
        status: "significant_deviation",
        direction: "suppressed",
        data_tier: "measured"
      },
      sleep_duration_hours: {
        metric_type: "sleep_duration_hours",
        unit: "hours",
        current_value: 5.2,
        baseline_mean: 7.4,
        baseline_std: 0.6,
        delta_absolute: -2.2,
        delta_percentage: -29.7,
        z_score: -3.67,
        status: "significant_deviation",
        direction: "suppressed",
        data_tier: "measured"
      },
      daily_steps: {
        metric_type: "daily_steps",
        unit: "steps",
        current_value: 5200,
        baseline_mean: 7640,
        baseline_std: 950,
        delta_absolute: -2440,
        delta_percentage: -31.9,
        z_score: -2.57,
        status: "moderate_drift",
        direction: "suppressed",
        data_tier: "measured"
      },
      spo2: {
        metric_type: "spo2",
        unit: "%",
        current_value: 98.0,
        baseline_mean: 98.2,
        baseline_std: 0.4,
        delta_absolute: -0.2,
        delta_percentage: -0.2,
        z_score: -0.5,
        status: "optimal",
        direction: "normal",
        data_tier: "measured"
      },
      fasting_blood_glucose: {
        metric_type: "fasting_blood_glucose",
        unit: "mg/dL",
        current_value: 98.0,
        baseline_mean: 92.5,
        baseline_std: 3.5,
        delta_absolute: 5.5,
        delta_percentage: 5.9,
        z_score: 1.57,
        status: "mild_deviation",
        direction: "elevated",
        data_tier: "user_reported"
      }
    }
  }
};

export const MOCK_ALERTS: Alert[] = [
  {
    _id: "alt-001",
    patient_id: "PT-1001",
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
    severity: "critical",
    metric_type: "heart_rate",
    title: "Resting Heart Rate Elevated from Baseline",
    description: "Current resting heart rate of 76.0 bpm deviates by +11.8 bpm (+18.4%, Z-Score: +3.81σ) from your personalized 30-day baseline of 64.2 bpm.",
    current_value: 76.0,
    baseline_value: 64.2,
    unit: "bpm",
    z_score: 3.81,
    evidence: {
      consecutive_days_elevated: 4,
      coincident_sleep_deficit_hours: -2.2,
      sensor: "Continuous Optical PPG"
    },
    suggested_action: "Review recent sleep duration, caffeine intake, and physical fatigue. If accompanied by chest discomfort or palpitations, seek prompt medical attention.",
    is_acknowledged: false
  },
  {
    _id: "alt-002",
    patient_id: "PT-1001",
    timestamp: new Date(Date.now() - 14 * 3600000).toISOString(),
    severity: "critical",
    metric_type: "hrv_rmssd",
    title: "Heart Rate Variability (Autonomic) Suppressed",
    description: "Autonomic recovery index (RMSSD) dropped to 34.0 ms compared to personal baseline of 55.8 ms (|Z|=4.04σ), indicating high sympathetic dominance.",
    current_value: 34.0,
    baseline_value: 55.8,
    unit: "ms",
    z_score: -4.04,
    evidence: {
      consecutive_days_low: 3,
      baseline_iqr: "51.0 - 60.5 ms"
    },
    suggested_action: "Prioritize sleep hygiene and avoid intense late-night cognitive strain. Gentle restorative walking and hydration recommended today.",
    is_acknowledged: false
  },
  {
    _id: "alt-003",
    patient_id: "PT-1001",
    timestamp: new Date(Date.now() - 28 * 3600000).toISOString(),
    severity: "warning",
    metric_type: "sleep_duration_hours",
    title: "Cumulative Sleep Deficit Detected",
    description: "Average sleep duration has fallen below 5.5 hours for 3 consecutive nights compared to your personal baseline of 7.4 hours.",
    current_value: 5.2,
    baseline_value: 7.4,
    unit: "hours",
    z_score: -3.67,
    evidence: {
      deficit_total_hours: 6.6,
      rem_sleep_percentage: 16
    },
    suggested_action: "Establish a consistent bedtime window tonight and limit digital screen exposure 60 minutes before sleep.",
    is_acknowledged: true,
    acknowledged_at: new Date(Date.now() - 12 * 3600000).toISOString(),
    acknowledged_by: "Aarav Mehta",
    acknowledgement_notes: "Project deadline crunch ending this week. Will prioritize sleep."
  }
];

export const MOCK_ASSESSMENT: HealthAssessment = {
  patient_id: "PT-1001",
  calculated_at: new Date().toISOString(),
  vitality_index: 84.5,
  stability_status: "mild_deviation",
  deviations: MOCK_TWIN_STATE["PT-1001"].metrics,
  explainability_factors: [
    {
      metric_type: "heart_rate",
      impact_score: 6.2,
      rule_name: "Resting HR Elevation",
      rationale: "+11.8 bpm above personal baseline (|Z|=3.81σ) sustained across 4 days.",
      severity: "critical"
    },
    {
      metric_type: "hrv_rmssd",
      impact_score: 5.4,
      rule_name: "Autonomic Variability Suppression",
      rationale: "HRV RMSSD is 39.1% below individual baseline (|Z|=4.04σ).",
      severity: "critical"
    },
    {
      metric_type: "sleep_duration_hours",
      impact_score: 3.9,
      rule_name: "Sleep Architecture Deficit",
      rationale: "Sleep is -2.2 hours below 30-day baseline.",
      severity: "warning"
    }
  ],
  summary_message: "Moderate autonomic and cardiovascular drift detected from your personal baseline, strongly correlated with a 4-day sleep deficit.",
  safety_disclaimer: "SwasthyaTwin mathematical trend models track statistical distances from personal baselines. This is not a clinical diagnosis or medical device."
};

// Generate 30 days of realistic longitudinal data for charts
export function generateMockLongitudinalObservations(metricType: string): Observation[] {
  const result: Observation[] = [];
  const now = Date.now();
  
  const configMap: Record<string, { base: number; std: number; unit: string; trend?: number }> = {
    heart_rate: { base: 64, std: 2.5, unit: "bpm", trend: 0.35 },
    blood_pressure_systolic: { base: 118, std: 3.5, unit: "mmHg", trend: 0.2 },
    blood_pressure_diastolic: { base: 76, std: 2.2, unit: "mmHg", trend: 0.15 },
    hrv_rmssd: { base: 56, std: 4.0, unit: "ms", trend: -0.65 },
    sleep_duration_hours: { base: 7.4, std: 0.4, unit: "hours", trend: -0.07 },
    daily_steps: { base: 7600, std: 800, unit: "steps", trend: -70 },
    spo2: { base: 98.2, std: 0.4, unit: "%" },
    fasting_blood_glucose: { base: 92, std: 3.0, unit: "mg/dL", trend: 0.15 }
  };

  const cfg = configMap[metricType] || { base: 70, std: 5, unit: "" };

  for (let day = 30; day >= 0; day--) {
    const timestamp = new Date(now - day * 86400000).toISOString();
    // Simulate gradual drift in the last 12 days
    const driftDays = Math.max(0, 12 - day);
    const trendEffect = (cfg.trend || 0) * driftDays;
    const noise = (Math.random() - 0.5) * cfg.std * 1.5;
    const val = Number((cfg.base + trendEffect + noise).toFixed(1));

    result.push({
      _id: `obs-${metricType}-${day}`,
      patient_id: "PT-1001",
      timestamp,
      metric_type: metricType,
      value: val,
      unit: cfg.unit,
      source: "wearable_continuous",
      data_tier: "measured"
    });
  }

  return result;
}
