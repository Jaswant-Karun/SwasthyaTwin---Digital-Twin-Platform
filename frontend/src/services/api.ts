import {
  Patient,
  Observation,
  DigitalTwinState,
  HealthAssessment,
  SimulationResult,
  InterventionParams,
  Alert,
  SystemHealth,
  CalculationExplanation,
  PatientExplanationsResponse,
  SimulationExplanationRequest,
  PatientCreateInput,
  PatientUpdateInput,
  ObservationCreateInput,
  ObservationUpdateInput,
  CSVValidationResult,
  InputPlausibilityResult,
  MLPredictionResult,
  AIScanResult
} from '../types';
import {
  MOCK_PATIENTS,
  MOCK_TWIN_STATE,
  MOCK_ALERTS,
  MOCK_ASSESSMENT,
  generateMockLongitudinalObservations
} from './mockData';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export class ApiError extends Error {
  status: number;
  endpoint: string;
  detail?: string;

  constructor(message: string, status: number, endpoint: string, detail?: string) {
    super(message);
    this.status = status;
    this.endpoint = endpoint;
    this.detail = detail;
    this.name = 'ApiError';
  }
}

// Explicit Offline Demo Mode control (Never silently active)
let explicitOfflineDemo = false;

export const setOfflineDemoMode = (enabled: boolean): void => {
  explicitOfflineDemo = enabled;
};

export const isOfflineDemoMode = (): boolean => explicitOfflineDemo;

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {})
      }
    });

    if (!res.ok) {
      let errorDetail = `HTTP Error ${res.status}`;
      try {
        const errorJson = await res.json();
        errorDetail = errorJson.detail || errorDetail;
      } catch {
        // Fallback to HTTP status text
        errorDetail = res.statusText || errorDetail;
      }
      throw new ApiError(errorDetail, res.status, endpoint, errorDetail);
    }

    return await res.json();
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err;
    }
    const message = err?.message || 'Failed to communicate with SwasthyaTwin API backend.';
    throw new ApiError(message, 0, endpoint);
  }
}

export const api = {
  // System Health & Database Readiness
  getHealth: async (): Promise<SystemHealth> => {
    if (explicitOfflineDemo) {
      return {
        status: 'healthy',
        service: 'SwasthyaTwin (Offline Demo)',
        version: '1.0.0',
        environment: 'offline_demo',
        database: {
          status: 'offline_demo',
          engine: 'browser_cached_store',
          database_name: 'swasthya_twin_offline',
          fallback_active: true
        },
        disclaimer: 'Explicit Offline Demo Mode Active. Not connected to live MongoDB.'
      };
    }
    return await request<SystemHealth>('/health');
  },

  getReadiness: async (): Promise<{ ready: boolean; database: string; ping_ms: number }> => {
    if (explicitOfflineDemo) {
      return { ready: true, database: 'offline_demo', ping_ms: 0.1 };
    }
    return await request<{ ready: boolean; database: string; ping_ms: number }>('/health/ready');
  },

  // Patients
  getPatients: async (search?: string): Promise<Patient[]> => {
    if (explicitOfflineDemo) {
      if (search) {
        return MOCK_PATIENTS.filter(p =>
          p.full_name.toLowerCase().includes(search.toLowerCase()) ||
          p.patient_id.toLowerCase().includes(search.toLowerCase())
        );
      }
      return MOCK_PATIENTS;
    }
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return await request<Patient[]>(`/api/v1/patients${q}`);
  },

  getPatient: async (id: string): Promise<Patient> => {
    if (explicitOfflineDemo) {
      const found = MOCK_PATIENTS.find(p => p.patient_id === id);
      if (!found) throw new ApiError(`Patient '${id}' not found in offline store`, 404, `/patients/${id}`);
      return found;
    }
    return await request<Patient>(`/api/v1/patients/${id}`);
  },

  createPatient: async (data: PatientCreateInput): Promise<Patient> => {
    if (explicitOfflineDemo) {
      const newId = data.patient_id || `PT-${1000 + MOCK_PATIENTS.length + 1}`;
      const newPatient: Patient = {
        patient_id: newId,
        full_name: data.full_name,
        age: data.age ?? 45,
        biological_sex: data.biological_sex || 'male',
        baseline_window_days: data.baseline_window_days || 30,
        chronic_conditions: data.chronic_conditions || [],
        primary_physician: data.primary_physician || 'Dr. Self-Reported',
        lifestyle_profile: {
          baseline_sleep_hours: data.lifestyle_profile?.baseline_sleep_hours ?? 7.0,
          baseline_daily_steps: data.lifestyle_profile?.baseline_daily_steps ?? 6000,
          activity_level: data.lifestyle_profile?.activity_level || 'moderate'
        },
        notes: data.notes,
        consent_confirmed: data.consent_confirmed ?? true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        active_alerts_count: 0,
        total_observations_count: 0,
        latest_vitality_index: 85,
        stability_status: 'optimal'
      };
      MOCK_PATIENTS.unshift(newPatient);
      return newPatient;
    }
    return await request<Patient>('/api/v1/patients', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  deletePatient: async (
    id: string,
    deleteAssociatedData = true
  ): Promise<{ success: boolean; message: string; deleted_associated_data: boolean }> => {
    if (explicitOfflineDemo) {
      const idx = MOCK_PATIENTS.findIndex(p => p.patient_id === id);
      if (idx !== -1) MOCK_PATIENTS.splice(idx, 1);
      return { success: true, message: `Patient ${id} deleted (offline demo)`, deleted_associated_data: deleteAssociatedData };
    }
    return await request<{ success: boolean; message: string; deleted_associated_data: boolean }>(
      `/api/v1/patients/${id}?delete_associated_data=${deleteAssociatedData}`,
      { method: 'DELETE' }
    );
  },

  updatePatient: async (id: string, data: Partial<Patient>): Promise<Patient> => {
    if (explicitOfflineDemo) {
      const found = MOCK_PATIENTS.find(p => p.patient_id === id) || MOCK_PATIENTS[0];
      return { ...found, ...data };
    }
    return await request<Patient>(`/api/v1/patients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // Observations
  getObservations: async (
    patientId: string,
    params?: {
      metric_type?: string;
      limit?: number;
      skip?: number;
      start_date?: string;
      end_date?: string;
      data_tier?: string;
    }
  ): Promise<{ total: number; skip: number; limit: number; items: Observation[] }> => {
    if (explicitOfflineDemo) {
      const metric = params?.metric_type || 'heart_rate';
      const items = generateMockLongitudinalObservations(metric);
      return {
        total: items.length,
        skip: 0,
        limit: params?.limit || 100,
        items
      };
    }
    const searchParams = new URLSearchParams();
    if (params?.metric_type) searchParams.append('metric_type', params.metric_type);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.skip) searchParams.append('skip', params.skip.toString());
    if (params?.start_date) searchParams.append('start_date', params.start_date);
    if (params?.end_date) searchParams.append('end_date', params.end_date);
    if (params?.data_tier) searchParams.append('data_tier', params.data_tier);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return await request<{ total: number; skip: number; limit: number; items: Observation[] }>(
      `/api/v1/patients/${patientId}/observations${query}`
    );
  },

  addObservation: async (patientId: string, obs: ObservationCreateInput | Partial<Observation>): Promise<Observation> => {
    if (explicitOfflineDemo) {
      return {
        _id: `obs_mock_${Date.now()}`,
        patient_id: patientId,
        timestamp: obs.timestamp || new Date().toISOString(),
        metric_type: obs.metric_type || 'heart_rate',
        value: obs.value || 70,
        unit: obs.unit || 'bpm',
        source: obs.source || 'manual_entry',
        data_tier: obs.data_tier || 'user_reported',
        data_classification: (obs as any).data_classification || 'user_entered'
      };
    }
    return await request<Observation>(`/api/v1/patients/${patientId}/observations`, {
      method: 'POST',
      body: JSON.stringify(obs)
    });
  },

  updateObservation: async (
    patientId: string,
    observationId: string,
    data: ObservationUpdateInput
  ): Promise<Observation> => {
    if (explicitOfflineDemo) {
      return {
        _id: observationId,
        patient_id: patientId,
        timestamp: new Date().toISOString(),
        metric_type: 'heart_rate',
        value: data.value ?? 72,
        unit: data.unit ?? 'bpm',
        source: 'manual_entry',
        data_tier: 'user_reported'
      };
    }
    return await request<Observation>(`/api/v1/patients/${patientId}/observations/${observationId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  deleteObservation: async (
    patientId: string,
    observationId: string
  ): Promise<{ success: boolean; message: string }> => {
    if (explicitOfflineDemo) {
      return { success: true, message: `Observation ${observationId} deleted (offline demo)` };
    }
    return await request<{ success: boolean; message: string }>(
      `/api/v1/patients/${patientId}/observations/${observationId}`,
      { method: 'DELETE' }
    );
  },

  validateCSV: async (patientId: string, rows: any[]): Promise<CSVValidationResult> => {
    if (explicitOfflineDemo) {
      return {
        total_rows: rows.length,
        valid_rows: rows.length,
        invalid_rows: 0,
        duplicate_rows: 0,
        rows: rows.map((r, i) => ({
          row_index: i + 1,
          patient_id: patientId,
          metric_type: r.metric_type || 'resting_heart_rate',
          value: Number(r.value) || 72,
          unit: r.unit || 'bpm',
          timestamp: r.timestamp || new Date().toISOString(),
          is_valid: true,
          errors: [],
          is_duplicate: false
        })),
        errors: []
      };
    }
    return await request<CSVValidationResult>(`/api/v1/patients/${patientId}/observations/csv/validate`, {
      method: 'POST',
      body: JSON.stringify({ patient_id: patientId, rows })
    });
  },

  importCSV: async (
    patientId: string,
    rows: any[]
  ): Promise<{ success: boolean; imported_count: number; message: string; errors: string[] }> => {
    if (explicitOfflineDemo) {
      return {
        success: true,
        imported_count: rows.length,
        message: `Successfully imported ${rows.length} rows (offline demo)`,
        errors: []
      };
    }
    return await request<{ success: boolean; imported_count: number; message: string; errors: string[] }>(
      `/api/v1/patients/${patientId}/observations/csv/import`,
      {
        method: 'POST',
        body: JSON.stringify({ patient_id: patientId, rows })
      }
    );
  },

  // Digital Twin & Baselines
  getTwinState: async (patientId: string): Promise<DigitalTwinState> => {
    if (explicitOfflineDemo) {
      return MOCK_TWIN_STATE[patientId] || MOCK_TWIN_STATE["PT-1001"];
    }
    return await request<DigitalTwinState>(`/api/v1/patients/${patientId}/twin/state`);
  },

  getTwinBaseline: async (
    patientId: string,
    windowDays?: number
  ): Promise<{ patient_id: string; window_days: number; baselines: Record<string, any> }> => {
    if (explicitOfflineDemo) {
      return {
        patient_id: patientId,
        window_days: windowDays || 30,
        baselines: MOCK_TWIN_STATE[patientId]?.metrics || MOCK_TWIN_STATE["PT-1001"].metrics
      };
    }
    const q = windowDays ? `?window_days=${windowDays}` : '';
    return await request<{ patient_id: string; window_days: number; baselines: Record<string, any> }>(
      `/api/v1/patients/${patientId}/twin/baseline${q}`
    );
  },

  getTwinAssessment: async (patientId: string): Promise<HealthAssessment> => {
    if (explicitOfflineDemo) {
      return { ...MOCK_ASSESSMENT, patient_id: patientId };
    }
    return await request<HealthAssessment>(`/api/v1/patients/${patientId}/twin/assessment`);
  },

  getTrends: async (patientId: string): Promise<any> => {
    if (explicitOfflineDemo) {
      return null;
    }
    return await request<any>(`/api/v1/patients/${patientId}/trends`);
  },

  getPredictions: async (patientId: string, horizonDays: number = 7): Promise<any> => {
    if (explicitOfflineDemo) {
      return null;
    }
    return await request<any>(`/api/v1/patients/${patientId}/predict?horizon_days=${horizonDays}`);
  },

  // What-If Simulations
  runSimulation: async (
    patientId: string,
    scenario_name: string,
    parameters: InterventionParams
  ): Promise<SimulationResult> => {
    if (explicitOfflineDemo) {
      const trajectories = [];
      const baseRhr = 76.0;
      const baseSbp = 126.0;
      const baseHrv = 34.0;
      for (let day = 1; day <= parameters.duration_days; day++) {
        const respSleep = 1.0 - Math.exp(-day / 4.0);
        const respAct = 1.0 - Math.exp(-day / 12.0);
        const rhr = baseRhr - (parameters.delta_sleep_hours * 1.6 * respSleep) - (parameters.delta_daily_steps / 4000.0 * 1.2 * respAct);
        const sbp = baseSbp - (parameters.delta_daily_steps * 0.0008 * respAct) - (parameters.sodium_reduction_pct * 0.12);
        const hrv = baseHrv + (parameters.delta_sleep_hours * 3.2 * respSleep) + (parameters.delta_daily_steps / 5000.0 * 2.5 * respAct);
        trajectories.push({
          day,
          date: new Date(Date.now() + day * 86400000).toISOString().split('T')[0],
          resting_hr: Number(rhr.toFixed(1)),
          resting_hr_upper: Number((rhr + 2.5).toFixed(1)),
          resting_hr_lower: Number((rhr - 2.5).toFixed(1)),
          systolic_bp: Number(sbp.toFixed(1)),
          systolic_bp_upper: Number((sbp + 3.8).toFixed(1)),
          systolic_bp_lower: Number((sbp - 3.8).toFixed(1)),
          hrv_rmssd: Number(hrv.toFixed(1)),
          hrv_rmssd_upper: Number((hrv + 4.2).toFixed(1)),
          hrv_rmssd_lower: Number((hrv - 4.2).toFixed(1)),
          vitality_projected: Number(Math.min(100, 84.5 + day * 0.25).toFixed(1))
        });
      }
      return {
        _id: `sim_offline_${Date.now()}`,
        patient_id: patientId,
        scenario_name,
        created_at: new Date().toISOString(),
        parameters,
        baseline_summary: { resting_hr: baseRhr, systolic_bp: baseSbp, hrv_rmssd: baseHrv },
        projected_outcomes: {
          final_resting_hr: trajectories[trajectories.length - 1].resting_hr,
          delta_resting_hr: Number((trajectories[trajectories.length - 1].resting_hr - baseRhr).toFixed(1)),
          final_systolic_bp: trajectories[trajectories.length - 1].systolic_bp,
          delta_systolic_bp: Number((trajectories[trajectories.length - 1].systolic_bp - baseSbp).toFixed(1)),
          final_hrv_rmssd: trajectories[trajectories.length - 1].hrv_rmssd,
          delta_hrv_rmssd: Number((trajectories[trajectories.length - 1].hrv_rmssd - baseHrv).toFixed(1)),
          final_vitality: trajectories[trajectories.length - 1].vitality_projected
        },
        trajectories,
        model_assumptions: [
          "Cardiovascular response follows an exponential adaptation curve with empirical saturation.",
          "Sleep interventions are assumed to be consistent on consecutive nights.",
          "Activity interventions assume moderate aerobic intensity."
        ],
        disclaimer: "Simulated data generated by mathematical digital twin model. For lifestyle exploration only."
      };
    }

    return await request<SimulationResult>(`/api/v1/patients/${patientId}/simulations/run`, {
      method: 'POST',
      body: JSON.stringify({ scenario_name, parameters })
    });
  },

  getSimulations: async (patientId: string): Promise<SimulationResult[]> => {
    if (explicitOfflineDemo) {
      return [];
    }
    return await request<SimulationResult[]>(`/api/v1/patients/${patientId}/simulations`);
  },

  // Surveillance Alerts & Deviations
  getAlerts: async (patientId: string, acknowledged?: boolean): Promise<Alert[]> => {
    if (explicitOfflineDemo) {
      if (acknowledged !== undefined) {
        return MOCK_ALERTS.filter(a => a.is_acknowledged === acknowledged);
      }
      return MOCK_ALERTS;
    }
    const q = acknowledged !== undefined ? `?acknowledged=${acknowledged}` : '';
    const res = await request<Alert[]>(`/api/v1/patients/${patientId}/alerts${q}`);
    return (res || []).map(a => ({
      ...a,
      _id: a._id || (a as any).alert_id || (a as any).id || ''
    }));
  },

  acknowledgeAlert: async (
    alertId: string,
    acknowledged_by: string = 'User',
    notes?: string
  ): Promise<Alert> => {
    if (explicitOfflineDemo) {
      const found = MOCK_ALERTS.find(a => a._id === alertId);
      if (found) {
        found.is_acknowledged = true;
        found.acknowledged_at = new Date().toISOString();
        found.acknowledged_by = acknowledged_by;
        found.acknowledgement_notes = notes;
        return found;
      }
      throw new ApiError(`Alert '${alertId}' not found in offline store`, 404, `/alerts/${alertId}/acknowledge`);
    }
    return await request<Alert>(`/api/v1/alerts/${alertId}/acknowledge`, {
      method: 'PATCH',
      body: JSON.stringify({ acknowledged_by, notes })
    });
  },

  // Seed & Synthetic Demo Workflow
  triggerSeed: async (force: boolean = false): Promise<{
    status: string;
    patients_created: number;
    observations_created: number;
    message: string;
  }> => {
    return await request<{
      status: string;
      patients_created: number;
      observations_created: number;
      message: string;
    }>(`/api/v1/seed?force=${force}`, {
      method: 'POST'
    });
  },

  resetDemoData: async (): Promise<{ status: string; message: string; deleted_counts: any }> => {
    return await request<{ status: string; message: string; deleted_counts: any }>(
      '/api/v1/seed/reset?confirm=true',
      { method: 'POST' }
    );
  },

  injectLiveObservation: async (
    patientId: string,
    metricType: string = 'heart_rate',
    value?: number
  ): Promise<{
    status: string;
    message: string;
    observation: any;
    recalculated_vitality_index: number;
    twin_state: any;
  }> => {
    return await request<{
      status: string;
      message: string;
      observation: any;
      recalculated_vitality_index: number;
      twin_state: any;
    }>('/api/v1/seed/live-observation', {
      method: 'POST',
      body: JSON.stringify({
        patient_id: patientId,
        metric_type: metricType,
        value: value,
        source: 'wearable_continuous_live'
      })
    });
  },

  // Explainability & Calculation Metadata
  getExplanations: async (patientId: string): Promise<PatientExplanationsResponse> => {
    if (explicitOfflineDemo) {
      const twin = MOCK_TWIN_STATE[patientId] || MOCK_TWIN_STATE["PT-1001"];
      const metrics: Record<string, CalculationExplanation> = {};
      const baselines: Record<string, CalculationExplanation> = {};

      Object.entries(twin.metrics).forEach(([m, dev]) => {
        const isOpt = dev.status === 'optimal';
        metrics[m] = {
          item_id: `metric_${m}`,
          category: 'metric',
          title: `${m.replace(/_/g, ' ').toUpperCase()} Calculation`,
          metric_type: m,
          current_value: dev.current_value,
          current_value_formatted: `${dev.current_value.toFixed(1)} ${dev.unit}`,
          unit: dev.unit,
          baseline_value: dev.baseline_mean,
          baseline_formatted: `${dev.baseline_mean.toFixed(1)} ${dev.unit} (Personal Mean)`,
          historical_window: '30-day rolling baseline window',
          window_days: 30,
          observations_count: 28,
          observations_sufficiency: 'Sufficient (28 observations ≥ 14 minimum)',
          is_sufficient: true,
          formula_name: 'Standardized Z-Score & Personal Median Delta',
          formula_latex_or_text: 'Z = (Observed - Baseline_Mean) / Baseline_StdDev; Δ_abs = Observed - Baseline_Median',
          formula_explanation: 'Standardizes the difference between the observed reading and the personal baseline distribution.',
          worked_example_steps: [
            {
              step_number: 1,
              title: 'Extract Observed Telemetry & Baseline',
              description: 'Retrieve latest observation and historical statistical baseline.',
              calculation: `Observed = ${dev.current_value.toFixed(1)} ${dev.unit}, Baseline = ${dev.baseline_mean.toFixed(1)} ${dev.unit}, StdDev = ${dev.baseline_std.toFixed(2)} ${dev.unit}`,
              result: 'Inputs established'
            },
            {
              step_number: 2,
              title: 'Calculate Absolute & Relative Deviation',
              description: 'Compute raw delta and percentage deviation.',
              formula: 'Δ_abs = Observed - Baseline; Δ_pct = 100 * Δ_abs / Baseline',
              calculation: `${dev.current_value.toFixed(1)} - ${dev.baseline_mean.toFixed(1)} = ${dev.delta_absolute > 0 ? '+' : ''}${dev.delta_absolute.toFixed(1)} ${dev.unit} (${dev.delta_percentage > 0 ? '+' : ''}${dev.delta_percentage.toFixed(1)}%)`,
              result: `${dev.delta_percentage > 0 ? '+' : ''}${dev.delta_percentage.toFixed(1)}%`
            },
            {
              step_number: 3,
              title: 'Standardize via Z-Score',
              description: 'Standardize deviation in units of personal historical standard deviation.',
              formula: 'Z = (Observed - Baseline_Mean) / Baseline_StdDev',
              calculation: `(${dev.current_value.toFixed(1)} - ${dev.baseline_mean.toFixed(1)}) / ${dev.baseline_std.toFixed(2)} = ${dev.z_score > 0 ? '+' : ''}${dev.z_score.toFixed(2)}σ`,
              result: `${dev.z_score > 0 ? '+' : ''}${dev.z_score.toFixed(2)}σ`
            },
            {
              step_number: 4,
              title: 'Classify Stability Status',
              description: 'Map standardized score to clinical stability tier.',
              calculation: `|Z| = ${Math.abs(dev.z_score).toFixed(2)}σ -> ${dev.status.replace(/_/g, ' ')}`,
              result: dev.status
            }
          ],
          worked_example_summary: `Observed ${dev.current_value.toFixed(1)} ${dev.unit} deviates by ${dev.delta_absolute > 0 ? '+' : ''}${dev.delta_absolute.toFixed(1)} ${dev.unit} (${dev.delta_percentage > 0 ? '+' : ''}${dev.delta_percentage.toFixed(1)}%) from personal baseline (${dev.baseline_mean.toFixed(1)} ${dev.unit}).`,
          data_source: 'wearable_continuous',
          latest_timestamp_formatted: 'Recent continuous telemetry (< 2h ago)',
          reason_flag_or_alert: isOpt ? 'Within normal 1.0σ baseline tolerance corridor.' : `Divergence of ${dev.z_score > 0 ? '+' : ''}${dev.z_score.toFixed(2)}σ exceeds baseline variance tolerance.`,
          flag_severity: isOpt ? 'optimal' : 'warning',
          warnings: ['Telemetry is fresh and actively synchronized.'],
          is_stale: false,
          is_missing_data: false,
          result_type: 'Statistical Estimate',
          limitations: 'Non-diagnostic demonstration research indicator.'
        };

        baselines[m] = {
          item_id: `baseline_${m}`,
          category: 'baseline',
          title: `${m.replace(/_/g, ' ').toUpperCase()} Personal Baseline`,
          metric_type: m,
          current_value: dev.baseline_mean,
          current_value_formatted: `${dev.baseline_mean.toFixed(1)} ${dev.unit}`,
          unit: dev.unit,
          baseline_value: dev.baseline_mean,
          baseline_formatted: `${dev.baseline_mean.toFixed(1)} ${dev.unit}`,
          historical_window: '30-day rolling window',
          window_days: 30,
          observations_count: 28,
          observations_sufficiency: 'Sufficient (28 observations ≥ 14 threshold)',
          is_sufficient: true,
          formula_name: 'Robust Median with Tukey Outlier Filtering',
          formula_latex_or_text: 'Median = P_50(X); IQR = Q_3 - Q_1; Fences = [Q_1 - 1.5*IQR, Q_3 + 1.5*IQR]',
          formula_explanation: 'Filters transient outliers and computes central tendency.',
          worked_example_steps: [
            {
              step_number: 1,
              title: 'Collect Window Telemetry',
              description: 'Retrieve observations across rolling 30-day window.',
              calculation: 'Sample count n = 28 observations',
              result: '28 samples'
            },
            {
              step_number: 2,
              title: 'Compute Median & IQR',
              description: 'Calculate distribution quartiles and interquartile range.',
              calculation: `Median = ${dev.baseline_mean.toFixed(1)} ${dev.unit}, StdDev = ${dev.baseline_std.toFixed(2)} ${dev.unit}`,
              result: `Baseline = ${dev.baseline_mean.toFixed(1)} ${dev.unit}`
            }
          ],
          worked_example_summary: `Personal baseline calibrated to ${dev.baseline_mean.toFixed(1)} ${dev.unit} from 28 historical readings.`,
          data_source: 'historical_telemetry',
          latest_timestamp_formatted: 'Within active 30-day window',
          warnings: [],
          is_stale: false,
          is_missing_data: false,
          result_type: 'Statistical Estimate',
          limitations: 'Individualized longitudinal baseline. Not a clinical reference standard.'
        };
      });

      const trends: Record<string, CalculationExplanation> = {
        vitality_index: {
          item_id: 'trend_vitality_index',
          category: 'trend',
          title: 'Health Stability Index (Vitality Trend)',
          metric_type: 'vitality_index',
          current_value: twin.overall_vitality,
          current_value_formatted: `${twin.overall_vitality.toFixed(1)} / 100`,
          unit: 'pts',
          baseline_value: 100.0,
          baseline_formatted: '100.0 (Personal Alignment Anchor)',
          historical_window: '30-day rolling baseline window',
          window_days: 30,
          observations_count: 140,
          observations_sufficiency: 'Sufficient (140 observations across biometrics)',
          is_sufficient: true,
          formula_name: 'Personal Baseline Normalized Excess Deviation Index',
          formula_latex_or_text: 'Vitality = 100.0 - [ sum(w_i * min(30.0, max(0, |Z_i| - 1.0) * 12.0)) / sum(w_active) ]',
          formula_explanation: 'Starts at 100 with transparent weighted deductions for excess standardized deviation (|Z| > 1.0) from personal norms.',
          worked_example_steps: [
            {
              step_number: 1,
              title: 'Base Score Initialization',
              description: 'Score starts at 100.0 pts for optimal self-alignment.',
              calculation: 'Base Score = 100.0 pts',
              result: '100.0 pts'
            },
            {
              step_number: 2,
              title: 'Evaluate Excess Drift (|Z| > 1.0σ)',
              description: 'Points deducted proportionally for biometrics exceeding 1.0σ.',
              calculation: `Normalized point deductions = ${(100 - twin.overall_vitality).toFixed(1)} pts`,
              result: `-${(100 - twin.overall_vitality).toFixed(1)} pts`
            },
            {
              step_number: 3,
              title: 'Compute Final Vitality Index',
              description: '100.0 minus normalized deductions.',
              calculation: `100.0 - ${(100 - twin.overall_vitality).toFixed(1)} = ${twin.overall_vitality.toFixed(1)} pts`,
              result: `${twin.overall_vitality.toFixed(1)} / 100`
            }
          ],
          worked_example_summary: `Vitality index evaluated as ${twin.overall_vitality.toFixed(1)} / 100 (${twin.stability_status.replace(/_/g, ' ')}).`,
          data_source: 'multi_stream_telemetry',
          latest_timestamp_formatted: 'Recent continuous telemetry (< 2h ago)',
          reason_flag_or_alert: `Stability Status: ${twin.stability_status.replace(/_/g, ' ')}`,
          flag_severity: twin.overall_vitality < 75 ? 'warning' : 'optimal',
          warnings: [],
          is_stale: false,
          is_missing_data: false,
          result_type: 'Rule-Based Indicator',
          limitations: 'Experimental research trend indicator. Not a clinical risk score or emergency triage tool.'
        }
      };

      const alerts: Record<string, CalculationExplanation> = {};
      MOCK_ALERTS.forEach((al) => {
        alerts[al._id] = {
          item_id: `alert_${al._id}`,
          category: 'alert',
          title: `Alert Explanation: ${al.title}`,
          metric_type: al.metric_type,
          current_value: al.current_value,
          current_value_formatted: `${al.current_value} ${al.unit}`,
          unit: al.unit,
          baseline_value: al.baseline_value,
          baseline_formatted: `${al.baseline_value} ${al.unit} (Personal Baseline)`,
          historical_window: '30-day baseline window',
          window_days: 30,
          observations_count: 28,
          observations_sufficiency: 'Sufficient',
          is_sufficient: true,
          formula_name: 'Configurable Baseline Surveillance Rule',
          formula_latex_or_text: 'Condition: |Z| ≥ 1.8σ with temporal persistence',
          formula_explanation: 'Alerts trigger strictly when telemetry breaches personalized statistical thresholds.',
          worked_example_steps: [
            {
              step_number: 1,
              title: 'Observed Telemetry vs Baseline',
              description: 'Compare reading against personal baseline.',
              calculation: `Observed = ${al.current_value} ${al.unit}, Baseline = ${al.baseline_value} ${al.unit}`,
              result: `Z = ${al.z_score > 0 ? '+' : ''}${al.z_score.toFixed(2)}σ`
            },
            {
              step_number: 2,
              title: 'Threshold Evaluation',
              description: 'Check rule condition |Z| >= 1.8σ.',
              calculation: `|Z| = ${Math.abs(al.z_score).toFixed(2)}σ ≥ 1.8σ -> TRIGGERED`,
              result: 'Condition met'
            }
          ],
          worked_example_summary: `Alert '${al.title}' was triggered by ${al.z_score > 0 ? '+' : ''}${al.z_score.toFixed(2)}σ deviation from personal baseline.`,
          data_source: 'wearable_telemetry',
          latest_timestamp_formatted: new Date(al.timestamp).toLocaleString(),
          reason_flag_or_alert: al.description,
          flag_severity: al.severity,
          warnings: ['Non-emergency surveillance flag.'],
          is_stale: false,
          is_missing_data: false,
          result_type: 'Rule-Based Indicator',
          limitations: 'Configurable research demonstration heuristic. Not a clinical diagnostic dispatch.'
        };
      });

      return {
        patient_id: patientId,
        generated_at: new Date().toISOString(),
        metrics,
        baselines,
        trends,
        alerts,
        simulation: null
      };
    }

    return await request<PatientExplanationsResponse>(`/api/v1/patients/${patientId}/explanations`);
  },

  getSpecificExplanation: async (
    patientId: string,
    category: string,
    itemId: string
  ): Promise<CalculationExplanation> => {
    if (explicitOfflineDemo) {
      const all = await api.getExplanations(patientId);
      const cat = category.toLowerCase();
      if (cat === 'metric' && all.metrics[itemId]) return all.metrics[itemId];
      if (cat === 'baseline' && all.baselines[itemId]) return all.baselines[itemId];
      if (cat === 'trend' && (all.trends[itemId] || all.trends.vitality_index)) return all.trends[itemId] || all.trends.vitality_index;
      if (cat === 'alert' && all.alerts[itemId]) return all.alerts[itemId];
      if (cat === 'simulation' && all.simulation) return all.simulation;
      const anyMatch = all.metrics[itemId] || all.baselines[itemId] || all.trends[itemId] || all.alerts[itemId];
      if (anyMatch) return anyMatch;
      throw new ApiError(`Explanation not found for ${category}/${itemId}`, 404, `/explanations/${category}/${itemId}`);
    }

    return await request<CalculationExplanation>(`/api/v1/patients/${patientId}/explanations/${category}/${itemId}`);
  },

  getSimulationExplanation: async (
    patientId: string,
    payload: SimulationExplanationRequest
  ): Promise<CalculationExplanation> => {
    if (explicitOfflineDemo) {
      const params = payload.parameters || { duration_days: 30, delta_sleep_hours: 1.0, delta_daily_steps: 3000 };
      const duration = params.duration_days || 30;
      const baseRhr = payload.baseline_summary?.resting_hr || 72.0;
      const finalRhr = payload.projected_outcomes?.final_resting_hr || (baseRhr - 3.2);
      const deltaRhr = Number((finalRhr - baseRhr).toFixed(1));

      return {
        item_id: 'simulation_offline',
        category: 'simulation',
        title: `What-If Simulation Modeling: ${payload.scenario_name || 'Scenario'}`,
        metric_type: 'resting_hr',
        current_value: finalRhr,
        current_value_formatted: `${finalRhr} bpm (Projected)`,
        unit: 'bpm',
        baseline_value: baseRhr,
        baseline_formatted: `${baseRhr} bpm (Starting Baseline Anchor)`,
        historical_window: `${duration}-day forward projection horizon`,
        window_days: duration,
        observations_count: 3,
        observations_sufficiency: 'Anchored to measured personal baseline',
        is_sufficient: true,
        formula_name: 'Pharmacokinetic/Pharmacodynamic Exponential Saturation Model',
        formula_latex_or_text: 'Δy(t) = sum_j [ k_j * Δu_j * (1 - exp(-t / τ_j)) ]; CI(t) = base_ci * (1 + 0.8 * t / T)',
        formula_explanation: 'Models autonomic and cardiovascular adaptation over time using physiological time constants with exponential saturation.',
        worked_example_steps: [
          {
            step_number: 1,
            title: 'Baseline Anchors',
            description: 'Starting biometrics anchored to patient baseline.',
            calculation: `Resting HR = ${baseRhr} bpm`,
            result: `${baseRhr} bpm`
          },
          {
            step_number: 2,
            title: 'Compute Exponential Response Factors',
            description: 'Evaluate exponential saturation at horizon.',
            formula: 'resp = 1 - exp(-t / τ)',
            calculation: `Sleep response factor (τ=4d) = ${(1 - Math.exp(-duration / 4.0)).toFixed(3)}`,
            result: 'Adaptation factors evaluated'
          },
          {
            step_number: 3,
            title: 'Calculate Projected Outcome',
            description: 'Apply effect coefficients and sum deltas.',
            calculation: `Base ${baseRhr} bpm + (${deltaRhr} bpm) = ${finalRhr} bpm`,
            result: `${finalRhr} bpm`
          }
        ],
        worked_example_summary: `Simulated ${duration}-day projection: Resting HR projected to ${finalRhr} bpm (Δ ${deltaRhr > 0 ? '+' : ''}${deltaRhr.toFixed(1)} bpm from baseline ${baseRhr} bpm).`,
        data_source: 'in_silico_computational_twin_engine',
        latest_timestamp_formatted: new Date().toLocaleTimeString(),
        reason_flag_or_alert: 'Counterfactual Projection under assumed intervention adherence.',
        flag_severity: 'info',
        warnings: [
          'Counterfactual Model: Assumes consistent sleep timing and moderate-intensity activity.',
          'Historical observed telemetry remains completely immutable.'
        ],
        is_stale: false,
        is_missing_data: false,
        result_type: 'Model Prediction',
        limitations: 'Illustrative mathematical simulation only. Does not guarantee clinical prognosis or replace clinical trials.'
      };
    }

    return await request<CalculationExplanation>(`/api/v1/patients/${patientId}/explanations/simulation`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // Machine Learning Intelligence & AI Optical Scanning
  validateInputPlausibility: async (data: {
    measurement_type: string;
    value: number;
    unit: string;
    patient_id?: string;
    paired_measurements?: Record<string, number>;
  }): Promise<InputPlausibilityResult> => {
    if (explicitOfflineDemo) {
      return {
        is_plausible: true,
        plausibility_score: 95.0,
        confidence_weight: 1.0,
        warnings: [],
        suggested_value: null,
        evaluated_metric: data.measurement_type,
        evaluated_value: data.value
      };
    }
    return await request<InputPlausibilityResult>('/api/v1/ml/validate-input', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  getMLPrediction: async (patientId: string): Promise<MLPredictionResult> => {
    if (explicitOfflineDemo) {
      return {
        patient_id: patientId,
        patient_name: 'Synthetic Demo Patient',
        predicted_risk_tier: 'Low Risk (Resilient)',
        risk_probabilities: { low_resilient: 82.4, moderate_drift: 14.1, elevated_strain: 3.5 },
        predicted_14d_vitality_delta: 2.5,
        health_phenotype: 'Optimal Homeostasis',
        phenotype_description: 'Autonomic and cardiovascular metrics show balanced parasympathetic activity.',
        top_driving_factors: [
          { feature: 'HRV RMSSD', importance_pct: 34.2, current_value: 58.0 },
          { feature: 'Heart Rate', importance_pct: 26.8, current_value: 68.0 },
          { feature: 'Sleep Duration', importance_pct: 21.5, current_value: 7.8 }
        ],
        radar_scores: {
          cardiovascular_stability: 92.0,
          autonomic_reserve: 88.5,
          circadian_alignment: 85.0,
          metabolic_vitality: 90.0,
          input_credibility: 99.0
        },
        model_metadata: {
          algorithm: 'RandomForest + GradientBoosting Ensemble',
          training_samples: 1500,
          confidence_score: 82.4,
          evaluated_at: new Date().toISOString()
        }
      };
    }
    return await request<MLPredictionResult>(`/api/v1/patients/${patientId}/ml/prediction`);
  },

  processAIScan: async (
    patientId: string,
    data: {
      heart_rate: number;
      hrv_rmssd: number;
      respiratory_rate?: number;
      signal_quality_pct?: number;
      auto_persist_twin?: boolean;
    }
  ): Promise<AIScanResult> => {
    if (explicitOfflineDemo) {
      return {
        patient_id: patientId,
        scan_timestamp: new Date().toISOString(),
        scan_source: 'optical_rppg_camera_analyzer',
        is_valid: true,
        overall_credibility_score: 96.0,
        signal_quality_pct: data.signal_quality_pct || 95.0,
        extracted_biometrics: {
          heart_rate: { value: data.heart_rate, unit: 'bpm', valid: true },
          hrv_rmssd: { value: data.hrv_rmssd, unit: 'ms', valid: true },
          respiratory_rate: { value: data.respiratory_rate || 16.0, unit: 'breaths/min', valid: true }
        },
        plausibility_audit: { heart_rate_warnings: [], hrv_warnings: [] },
        ml_prediction: await api.getMLPrediction(patientId),
        persisted_observation_ids: ['obs_demo_ai_scan'],
        twin_updated: true,
        clinical_disclaimer: 'Optical bio-photoplethysmography is for health screening and biometric tracking.'
      };
    }
    return await request<AIScanResult>(`/api/v1/patients/${patientId}/ai-scan`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
};
