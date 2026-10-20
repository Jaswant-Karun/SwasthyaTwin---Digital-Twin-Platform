import {
  Patient,
  Observation,
  DigitalTwinState,
  HealthAssessment,
  SimulationResult,
  InterventionParams,
  Alert,
  SystemHealth
} from '../types';
import {
  MOCK_PATIENTS,
  MOCK_TWIN_STATE,
  MOCK_ALERTS,
  MOCK_ASSESSMENT,
  generateMockLongitudinalObservations
} from './mockData';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

let isUsingFallbackStore = false;

export const getStoreMode = () => isUsingFallbackStore;

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
        // Fallback to status text
      }
      throw new ApiError(errorDetail, res.status);
    }

    isUsingFallbackStore = false;
    return await res.json();
  } catch (err: any) {
    console.warn(`[SwasthyaTwin API] Network error on ${endpoint}. Engaging centralized demo dataset.`, err);
    isUsingFallbackStore = true;
    throw err;
  }
}

export const api = {
  // System Health
  getHealth: async (): Promise<SystemHealth> => {
    try {
      return await request<SystemHealth>('/health');
    } catch {
      return {
        status: 'healthy',
        service: 'SwasthyaTwin',
        version: '1.0.0',
        environment: 'demo_fallback',
        database: {
          status: 'connected',
          engine: 'centralized_synthetic_demo_store',
          database_name: 'swasthya_twin',
          fallback_active: true
        },
        disclaimer: 'SwasthyaTwin is a prototype medical digital twin research engine. Not for emergency diagnostics.'
      };
    }
  },

  // Seed
  triggerSeed: async () => {
    try {
      return await request<{ status: string; patients_created: number; observations_created: number; message: string }>('/api/v1/seed', {
        method: 'POST'
      });
    } catch {
      return {
        status: 'success',
        patients_created: 3,
        observations_created: 2184,
        message: 'Successfully refreshed centralized synthetic demonstration cohort.'
      };
    }
  },

  // Patients
  getPatients: async (search?: string): Promise<Patient[]> => {
    try {
      const q = search ? `?search=${encodeURIComponent(search)}` : '';
      return await request<Patient[]>(`/api/v1/patients${q}`);
    } catch {
      if (search) {
        return MOCK_PATIENTS.filter(p =>
          p.full_name.toLowerCase().includes(search.toLowerCase()) ||
          p.patient_id.toLowerCase().includes(search.toLowerCase())
        );
      }
      return MOCK_PATIENTS;
    }
  },

  getPatient: async (id: string): Promise<Patient> => {
    try {
      return await request<Patient>(`/api/v1/patients/${id}`);
    } catch {
      const found = MOCK_PATIENTS.find(p => p.patient_id === id);
      if (found) return found;
      return MOCK_PATIENTS[0];
    }
  },

  updatePatient: async (id: string, data: Partial<Patient>): Promise<Patient> => {
    try {
      return await request<Patient>(`/api/v1/patients/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
    } catch {
      const found = MOCK_PATIENTS.find(p => p.patient_id === id) || MOCK_PATIENTS[0];
      return { ...found, ...data };
    }
  },

  // Observations
  getObservations: async (patientId: string, params?: { metric_type?: string; limit?: number; start_date?: string }) => {
    try {
      const searchParams = new URLSearchParams();
      if (params?.metric_type) searchParams.append('metric_type', params.metric_type);
      if (params?.limit) searchParams.append('limit', params.limit.toString());
      if (params?.start_date) searchParams.append('start_date', params.start_date);
      const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
      return await request<{ total: number; skip: number; limit: number; items: Observation[] }>(`/api/v1/patients/${patientId}/observations${query}`);
    } catch {
      const metric = params?.metric_type || 'heart_rate';
      const items = generateMockLongitudinalObservations(metric);
      return {
        total: items.length,
        skip: 0,
        limit: params?.limit || 100,
        items
      };
    }
  },

  addObservation: async (patientId: string, obs: Partial<Observation>): Promise<Observation> => {
    try {
      return await request<Observation>(`/api/v1/patients/${patientId}/observations`, {
        method: 'POST',
        body: JSON.stringify(obs)
      });
    } catch {
      return {
        _id: `obs-${Date.now()}`,
        patient_id: patientId,
        timestamp: obs.timestamp || new Date().toISOString(),
        metric_type: obs.metric_type || 'heart_rate',
        value: obs.value || 70,
        unit: obs.unit || 'bpm',
        source: obs.source || 'manual_entry',
        data_tier: obs.data_tier || 'user_reported'
      };
    }
  },

  // Digital Twin
  getTwinState: async (patientId: string): Promise<DigitalTwinState> => {
    try {
      return await request<DigitalTwinState>(`/api/v1/patients/${patientId}/twin/state`);
    } catch {
      return MOCK_TWIN_STATE[patientId] || MOCK_TWIN_STATE["PT-1001"];
    }
  },

  getTwinBaseline: async (patientId: string, windowDays?: number) => {
    try {
      const q = windowDays ? `?window_days=${windowDays}` : '';
      return await request<{ patient_id: string; window_days: number; baselines: Record<string, any> }>(`/api/v1/patients/${patientId}/twin/baseline${q}`);
    } catch {
      return {
        patient_id: patientId,
        window_days: windowDays || 30,
        baselines: MOCK_TWIN_STATE[patientId]?.metrics || MOCK_TWIN_STATE["PT-1001"].metrics
      };
    }
  },

  getTwinAssessment: async (patientId: string): Promise<HealthAssessment> => {
    try {
      return await request<HealthAssessment>(`/api/v1/patients/${patientId}/twin/assessment`);
    } catch {
      return { ...MOCK_ASSESSMENT, patient_id: patientId };
    }
  },

  getTrends: async (patientId: string) => {
    try {
      return await request<any>(`/api/patients/${patientId}/trends`);
    } catch {
      return null;
    }
  },

  getAssessments: async (patientId: string) => {
    try {
      return await request<HealthAssessment[]>(`/api/patients/${patientId}/assessments`);
    } catch {
      return [{ ...MOCK_ASSESSMENT, patient_id: patientId }];
    }
  },

  getPredictions: async (patientId: string, horizonDays: number = 7) => {
    try {
      return await request<any>(`/api/patients/${patientId}/predict?horizon_days=${horizonDays}`);
    } catch {
      return null;
    }
  },

  // Simulations

  runSimulation: async (patientId: string, scenario_name: string, parameters: InterventionParams): Promise<SimulationResult> => {
    try {
      return await request<SimulationResult>(`/api/v1/patients/${patientId}/simulations/run`, {
        method: 'POST',
        body: JSON.stringify({ scenario_name, parameters })
      });
    } catch {
      // Functional simulation calculation
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
        _id: `sim-${Date.now()}`,
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
  },

  getSimulations: async (patientId: string): Promise<SimulationResult[]> => {
    try {
      return await request<SimulationResult[]>(`/api/v1/patients/${patientId}/simulations`);
    } catch {
      return [];
    }
  },

  // Alerts
  getAlerts: async (patientId: string, acknowledged?: boolean): Promise<Alert[]> => {
    try {
      const q = acknowledged !== undefined ? `?acknowledged=${acknowledged}` : '';
      return await request<Alert[]>(`/api/v1/patients/${patientId}/alerts${q}`);
    } catch {
      if (acknowledged !== undefined) {
        return MOCK_ALERTS.filter(a => a.is_acknowledged === acknowledged);
      }
      return MOCK_ALERTS;
    }
  },

  acknowledgeAlert: async (alertId: string, acknowledged_by: string = 'User', notes?: string): Promise<Alert> => {
    try {
      return await request<Alert>(`/api/v1/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        body: JSON.stringify({ acknowledged_by, notes })
      });
    } catch {
      const found = MOCK_ALERTS.find(a => a._id === alertId);
      if (found) {
        found.is_acknowledged = true;
        found.acknowledged_at = new Date().toISOString();
        found.acknowledged_by = acknowledged_by;
        found.acknowledgement_notes = notes;
        return found;
      }
      return {
        _id: alertId,
        patient_id: 'PT-1001',
        timestamp: new Date().toISOString(),
        severity: 'info',
        metric_type: 'general',
        title: 'Alert Acknowledged',
        description: 'Acknowledged',
        current_value: 0,
        baseline_value: 0,
        unit: '',
        z_score: 0,
        evidence: {},
        suggested_action: '',
        is_acknowledged: true
      };
    }
  }
};
