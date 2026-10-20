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

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

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

    return await res.json();
  } catch (err: any) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(err.message || 'Network error connecting to SwasthyaTwin API', 0);
  }
}

export const api = {
  // System Health
  getHealth: () => request<SystemHealth>('/health'),

  // Seed
  triggerSeed: () => request<{ status: string; patients_created: number; observations_created: number; message: string }>('/api/v1/seed', {
    method: 'POST'
  }),

  // Patients
  getPatients: (search?: string) => {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return request<Patient[]>(`/api/v1/patients${q}`);
  },
  getPatient: (id: string) => request<Patient>(`/api/v1/patients/${id}`),
  updatePatient: (id: string, data: Partial<Patient>) => request<Patient>(`/api/v1/patients/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),

  // Observations
  getObservations: (patientId: string, params?: { metric_type?: string; limit?: number; start_date?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.metric_type) searchParams.append('metric_type', params.metric_type);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.start_date) searchParams.append('start_date', params.start_date);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return request<{ total: number; skip: number; limit: number; items: Observation[] }>(`/api/v1/patients/${patientId}/observations${query}`);
  },
  addObservation: (patientId: string, obs: Partial<Observation>) => request<Observation>(`/api/v1/patients/${patientId}/observations`, {
    method: 'POST',
    body: JSON.stringify(obs)
  }),

  // Digital Twin
  getTwinState: (patientId: string) => request<DigitalTwinState>(`/api/v1/patients/${patientId}/twin/state`),
  getTwinBaseline: (patientId: string, windowDays?: number) => {
    const q = windowDays ? `?window_days=${windowDays}` : '';
    return request<{ patient_id: string; window_days: number; baselines: Record<string, any> }>(`/api/v1/patients/${patientId}/twin/baseline${q}`);
  },
  getTwinAssessment: (patientId: string) => request<HealthAssessment>(`/api/v1/patients/${patientId}/twin/assessment`),

  // Simulations
  runSimulation: (patientId: string, scenario_name: string, parameters: InterventionParams) => request<SimulationResult>(`/api/v1/patients/${patientId}/simulations/run`, {
    method: 'POST',
    body: JSON.stringify({ scenario_name, parameters })
  }),
  getSimulations: (patientId: string) => request<SimulationResult[]>(`/api/v1/patients/${patientId}/simulations`),

  // Alerts
  getAlerts: (patientId: string, acknowledged?: boolean) => {
    const q = acknowledged !== undefined ? `?acknowledged=${acknowledged}` : '';
    return request<Alert[]>(`/api/v1/patients/${patientId}/alerts${q}`);
  },
  acknowledgeAlert: (alertId: string, acknowledged_by: string = 'User', notes?: string) => request<Alert>(`/api/v1/alerts/${alertId}/acknowledge`, {
    method: 'POST',
    body: JSON.stringify({ acknowledged_by, notes })
  })
};
