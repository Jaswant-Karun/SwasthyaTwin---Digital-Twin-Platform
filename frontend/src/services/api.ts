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
  SimulationExplanationRequest
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

  addObservation: async (patientId: string, obs: Partial<Observation>): Promise<Observation> => {
    if (explicitOfflineDemo) {
      return {
        _id: `obs_mock_${Date.now()}`,
        patient_id: patientId,
        timestamp: obs.timestamp || new Date().toISOString(),
        metric_type: obs.metric_type || 'heart_rate',
        value: obs.value || 70,
        unit: obs.unit || 'bpm',
        source: obs.source || 'manual_entry',
        data_tier: obs.data_tier || 'user_reported'
      };
    }
    return await request<Observation>(`/api/v1/patients/${patientId}/observations`, {
      method: 'POST',
      body: JSON.stringify(obs)
    });
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
    return await request<Alert[]>(`/api/v1/patients/${patientId}/alerts${q}`);
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
  }
};
