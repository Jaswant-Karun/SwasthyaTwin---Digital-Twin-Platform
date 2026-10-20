import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  Patient,
  DigitalTwinState,
  HealthAssessment,
  Alert,
  SystemHealth
} from '../types';
import { api } from '../services/api';

interface TwinContextType {
  patients: Patient[];
  currentPatient: Patient | null;
  twinState: DigitalTwinState | null;
  assessment: HealthAssessment | null;
  alerts: Alert[];
  systemHealth: SystemHealth | null;
  isLoading: boolean;
  isSeeding: boolean;
  isLiveInjecting: boolean;
  newlyAddedObservationId: string | null;
  latestUpdateInfo: { time: string; source: string; metric: string; value: number; unit: string } | null;
  errorMessage: string | null;
  isDarkMode: boolean;
  setCurrentPatientId: (id: string) => void;
  refreshData: () => Promise<void>;
  acknowledgeAlert: (alertId: string, notes?: string) => Promise<void>;
  seedDemoData: (force?: boolean | any) => Promise<void>;
  resetDemoCohort: () => Promise<void>;
  injectLiveDemoObservation: (metricType?: string, value?: number) => Promise<any>;
  toggleDarkMode: () => void;
}

const TwinContext = createContext<TwinContextType | undefined>(undefined);

export const TwinProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [currentPatient, setCurrentPatient] = useState<Patient | null>(null);
  const [twinState, setTwinState] = useState<DigitalTwinState | null>(null);
  const [assessment, setAssessment] = useState<HealthAssessment | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

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

  // Fetch initial patient list and system health
  const initApp = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const health = await api.getHealth();
      setSystemHealth(health);

      const patientList = await api.getPatients();
      setPatients(patientList);

      if (patientList.length > 0) {
        setCurrentPatient(patientList[0]);
      }
    } catch (err: any) {
      console.error('Init error:', err);
      setErrorMessage(err.message || 'Unable to connect to SwasthyaTwin API server.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initApp();
  }, [initApp]);

  // Load telemetry & digital twin state whenever currentPatient changes
  const loadPatientData = useCallback(async (patientId: string) => {
    try {
      const [stateRes, assessRes, alertsRes] = await Promise.allSettled([
        api.getTwinState(patientId),
        api.getTwinAssessment(patientId),
        api.getAlerts(patientId)
      ]);

      if (stateRes.status === 'fulfilled') setTwinState(stateRes.value);
      if (assessRes.status === 'fulfilled') setAssessment(assessRes.value);
      if (alertsRes.status === 'fulfilled') setAlerts(alertsRes.value);
    } catch (err: any) {
      console.error('Error loading patient telemetry:', err);
    }
  }, []);

  useEffect(() => {
    if (currentPatient) {
      loadPatientData(currentPatient.patient_id);
    }
  }, [currentPatient, loadPatientData]);

  const setCurrentPatientId = (id: string) => {
    const found = patients.find(p => p.patient_id === id);
    if (found) setCurrentPatient(found);
  };

  const refreshData = async () => {
    if (currentPatient) {
      setIsLoading(true);
      await loadPatientData(currentPatient.patient_id);
      const patientList = await api.getPatients();
      setPatients(patientList);
      setIsLoading(false);
    }
  };

  const acknowledgeAlert = async (alertId: string, notes?: string) => {
    try {
      await api.acknowledgeAlert(alertId, 'User/Clinician', notes);
      setAlerts(prev => prev.map(a => a._id === alertId ? { ...a, is_acknowledged: true } : a));
      if (currentPatient) {
        // Refresh alert counts
        setPatients(prev => prev.map(p =>
          p.patient_id === currentPatient.patient_id
            ? { ...p, active_alerts_count: Math.max(0, p.active_alerts_count - 1) }
            : p
        ));
      }
    } catch (err: any) {
      console.error('Failed to acknowledge alert:', err);
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
      setErrorMessage(err.message || 'Failed to seed synthetic data.');
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

      // Immediately refresh the current patient's digital twin state & assessment
      await loadPatientData(currentPatient.patient_id);
      const patientList = await api.getPatients();
      setPatients(patientList);
      return res;
    } catch (err: any) {
      console.error('Error during live telemetry injection:', err);
      setErrorMessage(err.message || 'Failed to simulate live telemetry packet.');
    } finally {
      setIsLiveInjecting(false);
    }
  };

  return (
    <TwinContext.Provider
      value={{
        patients,
        currentPatient,
        twinState,
        assessment,
        alerts,
        systemHealth,
        isLoading,
        isSeeding,
        isLiveInjecting,
        newlyAddedObservationId,
        latestUpdateInfo,
        errorMessage,
        isDarkMode,
        setCurrentPatientId,
        refreshData,
        acknowledgeAlert,
        seedDemoData,
        resetDemoCohort,
        injectLiveDemoObservation,
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
