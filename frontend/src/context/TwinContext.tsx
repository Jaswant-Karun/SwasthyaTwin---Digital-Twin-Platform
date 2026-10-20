import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  Patient,
  DigitalTwinState,
  HealthAssessment,
  Alert,
  Observation,
  SystemHealth
} from '../types';
import { api, setOfflineDemoMode, isOfflineDemoMode } from '../services/api';

interface DbReadiness {
  ready: boolean;
  database: string;
  ping_ms: number;
}

interface TwinContextType {
  // Offline Demo Mode
  isOfflineDemo: boolean;
  setOfflineDemo: (enabled: boolean) => void;

  // System & Database Connectivity
  systemHealth: SystemHealth | null;
  dbReadiness: DbReadiness | null;
  isHealthChecking: boolean;
  healthError: string | null;
  checkHealth: () => Promise<void>;

  // Patient Cohort
  patients: Patient[];
  currentPatient: Patient | null;
  setCurrentPatientId: (id: string) => void;

  // Real-time Digital Twin State
  twinState: DigitalTwinState | null;
  assessment: HealthAssessment | null;
  alerts: Alert[];

  // Global Time Window Filter
  selectedRangeDays: number;
  setSelectedRangeDays: (days: number) => void;

  // Loading, Skeletons & Errors
  isLoading: boolean;
  isLoadingPatientData: boolean;
  patientDataError: string | null;
  errorMessage: string | null;
  retryLoadPatient: () => Promise<void>;

  // Demo Controls & Live Injection
  isSeeding: boolean;
  isLiveInjecting: boolean;
  newlyAddedObservationId: string | null;
  latestUpdateInfo: {
    time: string;
    source: string;
    metric: string;
    value: number;
    unit: string;
  } | null;

  // Actions
  refreshData: () => Promise<void>;
  logObservation: (obs: Partial<Observation>) => Promise<Observation | null>;
  acknowledgeAlert: (alertId: string, notes?: string) => Promise<void>;
  seedDemoData: (force?: boolean | any) => Promise<void>;
  resetDemoCohort: () => Promise<void>;
  injectLiveDemoObservation: (metricType?: string, value?: number) => Promise<any>;

  // Appearance
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const TwinContext = createContext<TwinContextType | undefined>(undefined);

export const TwinProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOfflineDemo, setIsOfflineDemoState] = useState<boolean>(isOfflineDemoMode());
  const [patients, setPatients] = useState<Patient[]>([]);
  const [currentPatient, setCurrentPatient] = useState<Patient | null>(null);
  const [twinState, setTwinState] = useState<DigitalTwinState | null>(null);
  const [assessment, setAssessment] = useState<HealthAssessment | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedRangeDays, setSelectedRangeDays] = useState<number>(30);

  // Health and Readiness
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [dbReadiness, setDbReadiness] = useState<DbReadiness | null>(null);
  const [isHealthChecking, setIsHealthChecking] = useState<boolean>(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  // Loading & Error States
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingPatientData, setIsLoadingPatientData] = useState<boolean>(false);
  const [patientDataError, setPatientDataError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Demo Ingest & Highlight tracking
  const [isSeeding, setIsSeeding] = useState<boolean>(false);
  const [isLiveInjecting, setIsLiveInjecting] = useState<boolean>(false);
  const [newlyAddedObservationId, setNewlyAddedObservationId] = useState<string | null>(null);
  const [latestUpdateInfo, setLatestUpdateInfo] = useState<{
    time: string;
    source: string;
    metric: string;
    value: number;
    unit: string;
  } | null>(null);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  // Race condition token to discard superseded asynchronous responses
  const activeRequestIdRef = useRef<number>(0);

  // Toggle Dark Mode
  const toggleDarkMode = () => {
    setIsDarkMode(prev => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  };

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // Explicit Offline Demo Switch
  const setOfflineDemo = (enabled: boolean) => {
    setOfflineDemoMode(enabled);
    setIsOfflineDemoState(enabled);
    initApp();
  };

  // Real Health & Readiness Probe
  const checkHealth = useCallback(async () => {
    setIsHealthChecking(true);
    setHealthError(null);
    try {
      const [h, r] = await Promise.all([
        api.getHealth(),
        api.getReadiness().catch(() => ({ ready: false, database: 'disconnected', ping_ms: -1 }))
      ]);
      setSystemHealth(h);
      setDbReadiness(r);
    } catch (err: any) {
      setHealthError(err.message || 'Health probe failed.');
      setSystemHealth({
        status: 'degraded',
        service: 'SwasthyaTwin',
        version: '1.0.0',
        environment: 'unreachable',
        database: {
          status: 'disconnected',
          engine: 'unknown',
          database_name: 'swasthyatwin',
          fallback_active: false,
          connection_error: err.message
        },
        disclaimer: 'Live API backend is currently unreachable.'
      });
      setDbReadiness({ ready: false, database: 'disconnected', ping_ms: -1 });
    } finally {
      setIsHealthChecking(false);
    }
  }, []);

  // Load telemetry & digital twin state with race condition protection
  const loadPatientData = useCallback(async (patientId: string) => {
    const requestId = ++activeRequestIdRef.current;
    setIsLoadingPatientData(true);
    setPatientDataError(null);

    try {
      const [stateRes, assessRes, alertsRes] = await Promise.all([
        api.getTwinState(patientId),
        api.getTwinAssessment(patientId),
        api.getAlerts(patientId)
      ]);

      // Check if this request is still the active one
      if (requestId === activeRequestIdRef.current) {
        setTwinState(stateRes);
        setAssessment(assessRes);
        setAlerts(alertsRes);
      }
    } catch (err: any) {
      if (requestId === activeRequestIdRef.current) {
        console.error(`Error loading telemetry for patient ${patientId}:`, err);
        setPatientDataError(err.message || `Unable to load digital twin state for ${patientId}.`);
      }
    } finally {
      if (requestId === activeRequestIdRef.current) {
        setIsLoadingPatientData(false);
      }
    }
  }, []);

  // Initialize application
  const initApp = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await checkHealth();
      const patientList = await api.getPatients();
      setPatients(patientList);

      if (patientList.length > 0) {
        // Keep current patient if still exists in list, otherwise select first
        setCurrentPatient(prev => {
          if (prev && patientList.some(p => p.patient_id === prev.patient_id)) {
            return prev;
          }
          return patientList[0];
        });
      }
    } catch (err: any) {
      console.error('Initialization error:', err);
      setErrorMessage(
        err.message || 'Unable to connect to live SwasthyaTwin API backend. Check if backend is running on port 8000.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [checkHealth]);

  useEffect(() => {
    initApp();
  }, [initApp]);

  useEffect(() => {
    if (currentPatient) {
      loadPatientData(currentPatient.patient_id);
    }
  }, [currentPatient, loadPatientData]);

  const setCurrentPatientId = (id: string) => {
    const found = patients.find(p => p.patient_id === id);
    if (found) {
      setCurrentPatient(found);
    }
  };

  const retryLoadPatient = async () => {
    if (currentPatient) {
      await loadPatientData(currentPatient.patient_id);
    }
  };

  const refreshData = async () => {
    setIsLoading(true);
    try {
      await checkHealth();
      const patientList = await api.getPatients();
      setPatients(patientList);
      if (currentPatient) {
        await loadPatientData(currentPatient.patient_id);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Refresh failed.');
    } finally {
      setIsLoading(false);
    }
  };

  // Immediate in-place update after adding an observation (no page reload)
  const logObservation = async (obs: Partial<Observation>): Promise<Observation | null> => {
    if (!currentPatient) return null;
    try {
      const created = await api.addObservation(currentPatient.patient_id, obs);
      setNewlyAddedObservationId(created._id || (created as any).observation_id);
      setLatestUpdateInfo({
        time: created.timestamp || new Date().toISOString(),
        source: created.source || 'manual_entry',
        metric: created.metric_type,
        value: created.value,
        unit: created.unit
      });

      // Instantly refresh twin state and alerts without page reload
      await loadPatientData(currentPatient.patient_id);
      return created;
    } catch (err: any) {
      console.error('Failed to log observation:', err);
      throw err;
    }
  };

  const acknowledgeAlert = async (alertId: string, notes?: string) => {
    try {
      await api.acknowledgeAlert(alertId, 'User/Clinician', notes);
      setAlerts(prev => prev.map(a => a._id === alertId ? { ...a, is_acknowledged: true } : a));
      if (currentPatient) {
        setPatients(prev => prev.map(p =>
          p.patient_id === currentPatient.patient_id
            ? { ...p, active_alerts_count: Math.max(0, p.active_alerts_count - 1) }
            : p
        ));
      }
    } catch (err: any) {
      console.error('Failed to acknowledge alert:', err);
      throw err;
    }
  };

  const seedDemoData = async (force?: boolean | any) => {
    const isForce = typeof force === 'boolean' ? force : true;
    setIsSeeding(true);
    setErrorMessage(null);
    try {
      await api.triggerSeed(isForce);
      await initApp();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to seed synthetic demo records.');
    } finally {
      setIsSeeding(false);
    }
  };

  const resetDemoCohort = async () => {
    setIsSeeding(true);
    setErrorMessage(null);
    try {
      await api.resetDemoData();
      await initApp();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to reset synthetic demo data.');
    } finally {
      setIsSeeding(false);
    }
  };

  const injectLiveDemoObservation = async (metricType?: string, value?: number) => {
    if (!currentPatient) return;
    setIsLiveInjecting(true);
    setErrorMessage(null);
    try {
      const res = await api.injectLiveObservation(
        currentPatient.patient_id,
        metricType || 'heart_rate',
        value
      );

      if (res && res.observation) {
        setNewlyAddedObservationId(res.observation.observation_id);
        setLatestUpdateInfo({
          time: res.observation.timestamp || new Date().toISOString(),
          source: res.observation.source || 'wearable_continuous_live',
          metric: res.observation.metric_type,
          value: res.observation.value,
          unit: res.observation.unit
        });
      }

      await loadPatientData(currentPatient.patient_id);
      const patientList = await api.getPatients();
      setPatients(patientList);
      return res;
    } catch (err: any) {
      console.error('Error during live telemetry injection:', err);
      setErrorMessage(err.message || 'Failed to simulate live telemetry packet.');
      throw err;
    } finally {
      setIsLiveInjecting(false);
    }
  };

  return (
    <TwinContext.Provider
      value={{
        isOfflineDemo,
        setOfflineDemo,
        systemHealth,
        dbReadiness,
        isHealthChecking,
        healthError,
        checkHealth,
        patients,
        currentPatient,
        setCurrentPatientId,
        twinState,
        assessment,
        alerts,
        selectedRangeDays,
        setSelectedRangeDays,
        isLoading,
        isLoadingPatientData,
        patientDataError,
        errorMessage,
        retryLoadPatient,
        isSeeding,
        isLiveInjecting,
        newlyAddedObservationId,
        latestUpdateInfo,
        refreshData,
        logObservation,
        acknowledgeAlert,
        seedDemoData,
        resetDemoCohort,
        injectLiveDemoObservation,
        isDarkMode,
        toggleDarkMode
      }}
    >
      {children}
    </TwinContext.Provider>
  );
};

export const useTwin = () => {
  const context = useContext(TwinContext);
  if (!context) throw new Error('useTwin must be used within a TwinProvider');
  return context;
};
