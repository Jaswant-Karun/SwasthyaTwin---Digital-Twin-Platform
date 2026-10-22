import React, { useState, useEffect } from 'react';
import { useTwin } from '../../context/TwinContext';
import {
  Observation,
  DataClassification,
  CSVValidationResult,
  CSVValidationRow,
  InputPlausibilityResult
} from '../../types';
import { api } from '../../services/api';
import { AIOpticalTwinScanner } from '../scanner/AIOpticalTwinScanner';
import {
  Activity,
  PlusCircle,
  FileSpreadsheet,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Download,
  Upload,
  Edit2,
  Trash2,
  Clock,
  Info,
  Shield,
  Layers,
  Sparkles,
  HelpCircle,
  ArrowRight,
  HeartPulse,
  Zap,
  X
} from 'lucide-react';

interface MetricMeta {
  type: string;
  label: string;
  defaultUnit: string;
  allowedUnits: string[];
  min: number;
  max: number;
  step: number;
  placeholder: string;
  help: string;
}

const SUPPORTED_METRICS: MetricMeta[] = [
  {
    type: 'resting_heart_rate',
    label: 'Resting Heart Rate',
    defaultUnit: 'bpm',
    allowedUnits: ['bpm'],
    min: 20,
    max: 300,
    step: 1,
    placeholder: 'e.g. 68',
    help: 'Normal adult resting range: 50-90 bpm (AHA standard).'
  },
  {
    type: 'systolic_blood_pressure',
    label: 'Systolic Blood Pressure',
    defaultUnit: 'mmHg',
    allowedUnits: ['mmHg', 'kPa'],
    min: 30,
    max: 300,
    step: 1,
    placeholder: 'e.g. 120',
    help: 'Normal adult resting range: 90-129 mmHg. Auto-converts kPa (1 kPa = 7.50062 mmHg).'
  },
  {
    type: 'diastolic_blood_pressure',
    label: 'Diastolic Blood Pressure',
    defaultUnit: 'mmHg',
    allowedUnits: ['mmHg', 'kPa'],
    min: 20,
    max: 200,
    step: 1,
    placeholder: 'e.g. 80',
    help: 'Normal adult resting range: 60-84 mmHg. Must be lower than systolic pressure.'
  },
  {
    type: 'sleep_duration',
    label: 'Sleep Duration',
    defaultUnit: 'hours',
    allowedUnits: ['hours', 'minutes', 'hrs', 'h', 'min'],
    min: 0,
    max: 24,
    step: 0.1,
    placeholder: 'e.g. 7.5',
    help: 'Normal nightly duration: 6-9 hours. Auto-converts minutes to hours.'
  },
  {
    type: 'daily_steps',
    label: 'Daily Steps',
    defaultUnit: 'steps',
    allowedUnits: ['steps', 'count'],
    min: 0,
    max: 100000,
    step: 100,
    placeholder: 'e.g. 8450',
    help: 'Standard daily physical activity volume.'
  },
  {
    type: 'respiratory_rate',
    label: 'Respiratory Rate',
    defaultUnit: 'breaths/min',
    allowedUnits: ['breaths/min', 'rpm'],
    min: 3,
    max: 80,
    step: 1,
    placeholder: 'e.g. 15',
    help: 'Normal resting breathing rate: 12-20 breaths/min (WHO / ATS).'
  },
  {
    type: 'hrv_rmssd',
    label: 'HRV (RMSSD)',
    defaultUnit: 'ms',
    allowedUnits: ['ms'],
    min: 1,
    max: 500,
    step: 1,
    placeholder: 'e.g. 42',
    help: 'Heart rate variability parasympathetic marker.'
  },
  {
    type: 'blood_glucose',
    label: 'Fasting Blood Glucose',
    defaultUnit: 'mg/dL',
    allowedUnits: ['mg/dL', 'mmol/L'],
    min: 10,
    max: 1500,
    step: 1,
    placeholder: 'e.g. 95',
    help: 'Normal fasting range: 70-99 mg/dL. Auto-converts mmol/L (1 mmol/L = 18.0182 mg/dL).'
  },
  {
    type: 'oxygen_saturation',
    label: 'Oxygen Saturation (SpO2)',
    defaultUnit: '%',
    allowedUnits: ['%'],
    min: 50,
    max: 100,
    step: 1,
    placeholder: 'e.g. 98',
    help: 'Normal room-air pulse oximetry: 95-100%.'
  },
  {
    type: 'body_temperature',
    label: 'Body Temperature',
    defaultUnit: 'C',
    allowedUnits: ['C', 'F'],
    min: 30,
    max: 45,
    step: 0.1,
    placeholder: 'e.g. 36.8',
    help: 'Normal body temp: 36.1-37.2°C (97.0-99.0°F). Auto-converts °F to °C.'
  },
  {
    type: 'weight',
    label: 'Body Weight',
    defaultUnit: 'kg',
    allowedUnits: ['kg', 'lbs'],
    min: 1,
    max: 500,
    step: 0.1,
    placeholder: 'e.g. 70',
    help: 'Normal adult weight in kg or lbs. Auto-converts lbs to kg (÷ 2.20462).'
  }
];


interface AddObservationPageProps {
  onNavigate?: (tab: string) => void;
}

export const AddObservationPage: React.FC<AddObservationPageProps> = ({ onNavigate }) => {
  const {
    patients,
    currentPatient,
    setCurrentPatientId,
    logObservation,
    updateObservation,
    deleteObservation,
    validateCSV,
    importCSV
  } = useTwin();

  // Navigation tab inside this page
  const [activeSubTab, setActiveSubTab] = useState<
    'ai_scan' | 'single' | 'lifestyle' | 'csv' | 'history' | 'data_quality'
  >('single');

  // Single Observation Form State
  const [selectedPatientId, setSelectedPatientId] = useState(
    currentPatient?.patient_id || ''
  );
  const [metricType, setMetricType] = useState('resting_heart_rate');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('bpm');
  const [obsTimestamp, setObsTimestamp] = useState(() => {
    const now = new Date();
    // format as YYYY-MM-DDTHH:mm
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  });
  const [source, setSource] = useState('manual_entry');
  const [dataClassification, setDataClassification] =
    useState<DataClassification>('user_entered');
  const [notes, setNotes] = useState('');
  const [isSingleSubmitting, setIsSingleSubmitting] = useState(false);
  const [singleSuccess, setSingleSuccess] = useState<Observation | null>(null);
  const [singleError, setSingleError] = useState<string | null>(null);

  // Suspicious Value Confirmation Modal State
  const [suspiciousModal, setSuspiciousModal] = useState<{
    isOpen: boolean;
    patientId: string;
    metricType: string;
    value: number;
    unit: string;
    timestamp: string;
    source: string;
    dataClassification: string;
    notes?: string;
    warnings: string[];
    suggestedCorrection?: number | null;
  } | null>(null);
  const [isConfirmingUnusual, setIsConfirmingUnusual] = useState(false);

  // AI Plausibility & Typo Guard State
  const [plausibilityResult, setPlausibilityResult] = useState<InputPlausibilityResult | null>(null);
  const [isValidatingPlausibility, setIsValidatingPlausibility] = useState(false);

  useEffect(() => {
    if (!value || isNaN(parseFloat(value))) {
      setPlausibilityResult(null);
      return;
    }
    const timer = setTimeout(async () => {
      setIsValidatingPlausibility(true);
      try {
        const res = await api.validateInputPlausibility({
          measurement_type: metricType,
          value: parseFloat(value),
          unit: unit,
          patient_id: selectedPatientId
        });
        setPlausibilityResult(res);
      } catch (err) {
        console.warn('Plausibility validation error:', err);
      } finally {
        setIsValidatingPlausibility(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [value, metricType, unit, selectedPatientId]);

  // Lifestyle Log Form State
  const [lifestyleSleep, setLifestyleSleep] = useState('7.5');
  const [lifestyleSteps, setLifestyleSteps] = useState('8000');
  const [lifestyleActivity, setLifestyleActivity] = useState('moderate');
  const [lifestyleNotes, setLifestyleNotes] = useState('');
  const [isLifestyleSubmitting, setIsLifestyleSubmitting] = useState(false);
  const [lifestyleSuccessMsg, setLifestyleSuccessMsg] = useState<string | null>(null);
  const [lifestyleError, setLifestyleError] = useState<string | null>(null);

  // CSV Import State with Ingestion Service Pre-Verification
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState('');
  const [validationResult, setValidationResult] =
    useState<CSVValidationResult | null>(null);
  const [csvPreviewResult, setCsvPreviewResult] = useState<any | null>(null);
  const [confirmUnusualAllCSV, setConfirmUnusualAllCSV] = useState(false);
  const [isValidatingCsv, setIsValidatingCsv] = useState(false);
  const [isImportingCsv, setIsImportingCsv] = useState(false);
  const [csvSuccessMsg, setCsvSuccessMsg] = useState<string | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);

  // History / Audit trail State
  const [historyObservations, setHistoryObservations] = useState<Observation[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [editingObs, setEditingObs] = useState<Observation | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editReason, setEditReason] = useState('');
  const [isUpdatingObs, setIsUpdatingObs] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Data Quality Review & Prediction Safeguards State
  const [mlSafeguardData, setMlSafeguardData] = useState<any | null>(null);
  const [isLoadingSafeguard, setIsLoadingSafeguard] = useState(false);

  // Sync selected patient
  useEffect(() => {
    if (currentPatient && currentPatient.patient_id !== selectedPatientId) {
      setSelectedPatientId(currentPatient.patient_id);
    }
  }, [currentPatient]);

  // Load history when tab is selected
  useEffect(() => {
    if (activeSubTab === 'history' && selectedPatientId) {
      loadHistory();
    }
    if (activeSubTab === 'data_quality' && selectedPatientId) {
      loadSafeguardData();
    }
  }, [activeSubTab, selectedPatientId]);

  const loadSafeguardData = async () => {
    if (!selectedPatientId) return;
    setIsLoadingSafeguard(true);
    try {
      const res = await api.getMLPrediction(selectedPatientId);
      setMlSafeguardData(res);
    } catch (err: any) {
      console.warn('Failed to load safeguard data:', err);
    } finally {
      setIsLoadingSafeguard(false);
    }
  };

  const loadHistory = async () => {
    if (!selectedPatientId) return;
    setIsLoadingHistory(true);
    try {
      const res = await api.getObservations(selectedPatientId, { limit: 50 });
      setHistoryObservations(res.items || []);
    } catch (err: any) {
      console.error('Failed to load observation history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // When metric type changes, update unit
  const handleMetricTypeChange = (newType: string) => {
    setMetricType(newType);
    const meta = SUPPORTED_METRICS.find(m => m.type === newType);
    if (meta) {
      setUnit(meta.defaultUnit);
    }
  };

  const currentMeta =
    SUPPORTED_METRICS.find(m => m.type === metricType) || SUPPORTED_METRICS[0];

  // Submit Single Observation
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSingleError(null);
    setSingleSuccess(null);

    if (!selectedPatientId) {
      setSingleError('Please select a valid patient.');
      return;
    }

    const numVal = parseFloat(value);
    if (isNaN(numVal)) {
      setSingleError('Please enter a valid numeric value.');
      return;
    }

    // Physiological bounds check (Data quality guidance)
    if (numVal < currentMeta.min || numVal > currentMeta.max) {
      setSingleError(
        `Value ${numVal} ${unit} is outside plausible physiological bounds (${currentMeta.min} - ${currentMeta.max} ${unit}) for ${currentMeta.label}. Please verify the measurement.`
      );
      return;
    }

    if (!obsTimestamp) {
      setSingleError('Timestamp is required.');
      return;
    }

    setIsSingleSubmitting(true);
    try {
      // Ensure global context selects this patient
      if (currentPatient?.patient_id !== selectedPatientId) {
        setCurrentPatientId(selectedPatientId);
      }

      const isoTime = new Date(obsTimestamp).toISOString();
      const payload = {
        patient_id: selectedPatientId,
        metric_type: metricType,
        value: numVal,
        unit: unit,
        timestamp: isoTime,
        source: source,
        data_tier: 'user_reported' as any,
        data_classification: dataClassification,
        notes: notes.trim() || undefined
      };

      try {
        const saved = await api.addObservation(selectedPatientId, payload, false);
        if (saved) {
          setSingleSuccess(saved);
          setValue('');
          setNotes('');
          if (activeSubTab === 'history') {
            loadHistory();
          }
        }
      } catch (err: any) {
        // Check for 409 Conflict / Unusual value requiring user confirmation
        if (
          err.status === 409 ||
          err.data?.requires_confirmation ||
          err.data?.detail?.requires_confirmation ||
          (typeof err.message === 'string' && err.message.includes('Unusual observation requires user confirmation'))
        ) {
          const detail = err.data?.detail || err.data || {};
          const warnings = Array.isArray(detail.warnings)
            ? detail.warnings
            : Array.isArray(err.data?.warnings)
            ? err.data.warnings
            : [err.message || 'Value is outside typical resting corridors, but technically plausible.'];
          const suggested = detail.suggested_correction ?? err.data?.suggested_correction ?? null;

          setSuspiciousModal({
            isOpen: true,
            patientId: selectedPatientId,
            metricType,
            value: numVal,
            unit,
            timestamp: isoTime,
            source,
            dataClassification,
            notes: notes.trim() || undefined,
            warnings,
            suggestedCorrection: suggested
          });
          return;
        } else {
          throw err;
        }
      }
    } catch (err: any) {
      setSingleError(err.message || 'Failed to persist observation to MongoDB.');
    } finally {
      setIsSingleSubmitting(false);
    }
  };

  // Confirm Suspicious / Unusual Value Action
  const handleConfirmSuspiciousValue = async () => {
    if (!suspiciousModal) return;
    setIsConfirmingUnusual(true);
    setSingleError(null);
    try {
      const payload = {
        patient_id: suspiciousModal.patientId,
        metric_type: suspiciousModal.metricType,
        value: suspiciousModal.value,
        unit: suspiciousModal.unit,
        timestamp: suspiciousModal.timestamp,
        source: suspiciousModal.source,
        data_tier: 'user_reported' as any,
        data_classification: suspiciousModal.dataClassification,
        notes: suspiciousModal.notes,
        confirmed_by_user: true
      };

      const saved = await api.addObservation(suspiciousModal.patientId, payload, true);
      if (saved) {
        setSingleSuccess(saved);
        setValue('');
        setNotes('');
        setSuspiciousModal(null);
        if (activeSubTab === 'history') {
          loadHistory();
        }
      }
    } catch (err: any) {
      setSingleError(err.message || 'Failed to confirm unusual value.');
      setSuspiciousModal(null);
    } finally {
      setIsConfirmingUnusual(false);
    }
  };

  // Submit Daily Lifestyle Log
  const handleLifestyleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLifestyleError(null);
    setLifestyleSuccessMsg(null);

    if (!selectedPatientId) {
      setLifestyleError('Please select a valid patient.');
      return;
    }

    const sleepNum = parseFloat(lifestyleSleep);
    const stepsNum = parseInt(lifestyleSteps, 10);

    if (isNaN(sleepNum) || sleepNum < 0 || sleepNum > 24) {
      setLifestyleError('Sleep duration must be between 0 and 24 hours.');
      return;
    }

    if (isNaN(stepsNum) || stepsNum < 0 || stepsNum > 100000) {
      setLifestyleError('Steps must be between 0 and 100,000.');
      return;
    }

    setIsLifestyleSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      // Add sleep duration
      await api.addObservation(selectedPatientId, {
        patient_id: selectedPatientId,
        metric_type: 'sleep_duration',
        value: sleepNum,
        unit: 'hours',
        timestamp: nowIso,
        source: 'manual_lifestyle_log',
        data_tier: 'user_reported' as any,
        data_classification: 'user_entered',
        notes: lifestyleNotes.trim() ? `[Lifestyle Log - ${lifestyleActivity}] ${lifestyleNotes}` : `[Lifestyle Log - ${lifestyleActivity}]`
      });

      // Add daily steps
      await api.addObservation(selectedPatientId, {
        patient_id: selectedPatientId,
        metric_type: 'daily_steps',
        value: stepsNum,
        unit: 'steps',
        timestamp: nowIso,
        source: 'manual_lifestyle_log',
        data_tier: 'user_reported' as any,
        data_classification: 'user_entered',
        notes: `Recorded with general activity level: ${lifestyleActivity}`
      });

      setLifestyleSuccessMsg(
        `Successfully logged ${sleepNum}h sleep and ${stepsNum.toLocaleString()} steps for ${selectedPatientId}. Digital twin baseline and vitality updated.`
      );
      setLifestyleNotes('');
    } catch (err: any) {
      setLifestyleError(err.message || 'Failed to save lifestyle log.');
    } finally {
      setIsLifestyleSubmitting(false);
    }
  };

  // CSV Template Generation
  const downloadCsvTemplate = () => {
    const templateContent =
      `patient_id,metric_type,value,unit,timestamp,source,notes\n` +
      `${selectedPatientId || 'PT-1001'},resting_heart_rate,72,bpm,${new Date().toISOString()},wearable_import,Morning resting sample\n` +
      `${selectedPatientId || 'PT-1001'},systolic_blood_pressure,122,mmHg,${new Date().toISOString()},manual_cuff,Clinician measurement\n` +
      `${selectedPatientId || 'PT-1001'},diastolic_blood_pressure,80,mmHg,${new Date().toISOString()},manual_cuff,Clinician measurement\n` +
      `${selectedPatientId || 'PT-1001'},sleep_duration,7.8,hours,${new Date().toISOString()},smartwatch,Sleep tracker sync\n` +
      `${selectedPatientId || 'PT-1001'},daily_steps,9420,steps,${new Date().toISOString()},fitness_tracker,Daily aggregate\n` +
      `${selectedPatientId || 'PT-1001'},blood_glucose,94,mg/dL,${new Date().toISOString()},glucometer,Fasting morning check\n`;

    const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `swasthyatwin_template_${selectedPatientId || 'patient'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV File Upload & Parsing
  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setValidationResult(null);
    setCsvPreviewResult(null);
    setCsvSuccessMsg(null);
    setCsvError(null);

    const reader = new FileReader();
    reader.onload = async event => {
      const text = event.target?.result as string;
      setCsvText(text);
      await parseAndValidateCsv(text);
    };
    reader.readAsText(file);
  };

  const parseAndValidateCsv = async (rawCsv: string) => {
    if (!selectedPatientId) {
      setCsvError('Please select a patient before validating CSV.');
      return;
    }

    setIsValidatingCsv(true);
    setCsvError(null);
    setCsvPreviewResult(null);
    try {
      const lines = rawCsv
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);

      if (lines.length < 2) {
        setCsvError('CSV file is empty or missing data rows.');
        setIsValidatingCsv(false);
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const pIdIdx = headers.indexOf('patient_id');
      const mTypeIdx = headers.indexOf('metric_type') !== -1 ? headers.indexOf('metric_type') : headers.indexOf('measurement_type');
      const valIdx = headers.indexOf('value');
      const unitIdx = headers.indexOf('unit');
      const timeIdx = headers.indexOf('timestamp') !== -1 ? headers.indexOf('timestamp') : headers.indexOf('observed_at');
      const srcIdx = headers.indexOf('source') !== -1 ? headers.indexOf('source') : headers.indexOf('source_type');
      const notesIdx = headers.indexOf('notes');

      if (valIdx === -1 || mTypeIdx === -1) {
        setCsvError('CSV must include at least "metric_type" (or "measurement_type") and "value" columns.');
        setIsValidatingCsv(false);
        return;
      }

      const parsedRows = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        if (cols.length < 2) continue;

        parsedRows.push({
          patient_id: pIdIdx !== -1 && cols[pIdIdx] ? cols[pIdIdx] : selectedPatientId,
          measurement_type: cols[mTypeIdx] || '',
          metric_type: cols[mTypeIdx] || '',
          value: parseFloat(cols[valIdx]),
          unit: unitIdx !== -1 && cols[unitIdx] ? cols[unitIdx] : '',
          observed_at: timeIdx !== -1 && cols[timeIdx] ? cols[timeIdx] : new Date().toISOString(),
          timestamp: timeIdx !== -1 && cols[timeIdx] ? cols[timeIdx] : new Date().toISOString(),
          source: srcIdx !== -1 && cols[srcIdx] ? cols[srcIdx] : 'wearable_csv_import',
          source_type: srcIdx !== -1 && cols[srcIdx] ? cols[srcIdx] : 'imported_file',
          notes: notesIdx !== -1 && cols[notesIdx] ? cols[notesIdx] : undefined
        });
      }

      // First try backend validated ingestion service preview
      try {
        const previewRes = await api.previewCSV(selectedPatientId, parsedRows);
        setCsvPreviewResult(previewRes);
      } catch (backendErr) {
        // Fallback to client verification
        const result = await validateCSV(parsedRows);
        setValidationResult(result);
      }
    } catch (err: any) {
      setCsvError(err.message || 'Failed to validate CSV with backend engine.');
    } finally {
      setIsValidatingCsv(false);
    }
  };

  const handleImportCsv = async () => {
    setIsImportingCsv(true);
    setCsvError(null);
    setCsvSuccessMsg(null);
    try {
      if (csvPreviewResult && csvPreviewResult.all_rows) {
        const res = await api.confirmCSV(selectedPatientId, csvPreviewResult.all_rows, confirmUnusualAllCSV);
        setCsvSuccessMsg(
          `Successfully persisted ${res.inserted_count || res.imported_count || csvPreviewResult.valid_rows_count} verified observations into MongoDB. Twin recalculated.`
        );
        setCsvPreviewResult(null);
        setCsvFile(null);
      } else if (validationResult && validationResult.valid_rows > 0) {
        const validRows = validationResult.rows
          .filter(r => r.is_valid && !r.is_duplicate)
          .map(r => ({
            patient_id: r.patient_id,
            metric_type: r.metric_type,
            value: r.value,
            unit: r.unit,
            timestamp: r.timestamp,
            source: r.source || 'wearable_csv_import',
            notes: r.notes
          }));

        const res = await importCSV(validRows);
        setCsvSuccessMsg(
          `Successfully persisted ${res.imported_count} observations into MongoDB. Twin recalculated.`
        );
    } catch (err: any) {
      setCsvError(err.message || 'Failed to import CSV rows.');
    } finally {
      setIsImportingCsv(false);
    }
  };


  // Observation Edit Modal (Audit Trail)
  const openEditObsModal = (obs: Observation) => {
    setEditingObs(obs);
    setEditValue(String(obs.value));
    setEditReason('');
    setUpdateError(null);
  };

  const handleUpdateObs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingObs) return;
    setUpdateError(null);

    const numVal = parseFloat(editValue);
    if (isNaN(numVal)) {
      setUpdateError('Please enter a valid numeric value.');
      return;
    }

    if (!editReason.trim()) {
      setUpdateError('A reason for editing is required to maintain the clinical audit trail.');
      return;
    }

    setIsUpdatingObs(true);
    try {
      const obsId = editingObs._id || editingObs.observation_id || '';
      await updateObservation(obsId, {
        value: numVal,
        unit: editingObs.unit,
        reason_for_edit: editReason.trim(),
        notes: `[Corrected: ${editReason.trim()}]`
      });
      setEditingObs(null);
      await loadHistory();
    } catch (err: any) {
      setUpdateError(err.message || 'Failed to update observation.');
    } finally {
      setIsUpdatingObs(false);
    }
  };

  const handleDeleteObs = async (obs: Observation) => {
    const obsId = obs._id || obs.observation_id || '';
    if (!window.confirm(`Delete observation ${obsId} (${obs.metric_type} = ${obs.value} ${obs.unit})?`)) {
      return;
    }
    try {
      await deleteObservation(obsId);
      await loadHistory();
    } catch (err: any) {
      alert(`Failed to delete observation: ${err.message}`);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-teal-500/10 text-teal-600 border border-teal-500/20">
              <PlusCircle className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Add Health Observation
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Submit verified biometric and lifestyle observations. All entries persist to MongoDB and immediately update twin baselines.
          </p>
        </div>

        {/* Global Patient Selector for this form */}
        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-2xs">
          <label className="text-xs font-semibold text-slate-600">Patient:</label>
          <select
            value={selectedPatientId}
            onChange={e => {
              setSelectedPatientId(e.target.value);
              setCurrentPatientId(e.target.value);
            }}
            className="text-xs font-bold text-slate-900 bg-transparent outline-hidden font-mono"
          >
            {patients.map(p => (
              <option key={p.patient_id} value={p.patient_id}>
                {p.patient_id} — {p.full_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. Sub-tab Navigation */}
      <div className="flex border-b border-slate-200 space-x-1 sm:space-x-3 overflow-x-auto">
        {[
          { id: 'ai_scan', label: 'AI Optical Bio-Scan', icon: Zap, badge: 'AUTO' },
          { id: 'single', label: 'Single Observation', icon: PlusCircle },
          { id: 'lifestyle', label: 'Daily Lifestyle Log', icon: Calendar },
          { id: 'csv', label: 'Wearable CSV Import', icon: FileSpreadsheet },
          { id: 'history', label: 'Data History & Corrections', icon: Clock },
          { id: 'data_quality', label: 'Review Data Quality', icon: Shield, badge: 'AUDIT' }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-2 py-3 px-3 sm:px-4 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? 'border-teal-600 text-teal-700 bg-teal-50/40 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-teal-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-teal-500 text-slate-950 font-mono tracking-wider">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 0: AI OPTICAL BIO-SCAN */}
      {activeSubTab === 'ai_scan' && (
        <div className="space-y-6">
          <AIOpticalTwinScanner />
        </div>
      )}

      {/* TAB 1: SINGLE OBSERVATION */}
      {activeSubTab === 'single' && (
        <div className="space-y-6">
          {/* Complete Digital Twin Pipeline Update Card */}
          {singleSuccess && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-xs space-y-4 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-200/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-emerald-950 flex items-center gap-2">
                      Observation Saved & Digital Twin Updated
                      <span className="font-mono text-[11px] font-semibold bg-emerald-200/70 text-emerald-900 px-2 py-0.5 rounded-full">
                        {singleSuccess.observation_id || singleSuccess._id}
                      </span>
                    </h3>
                    <p className="text-xs text-emerald-800">
                      Measurement: <strong className="font-semibold text-emerald-950">{singleSuccess.metric_type.replace('_', ' ').toUpperCase()} = {singleSuccess.value} {singleSuccess.unit}</strong> • Recorded at: {new Date(singleSuccess.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-white border border-emerald-300 text-emerald-800 shadow-2xs">
                    {(singleSuccess as any).data_classification || singleSuccess.data_tier || 'user_entered'}
                  </span>
                  <button
                    onClick={() => setSingleSuccess(null)}
                    className="p-1 rounded text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 transition-colors"
                    aria-label="Dismiss banner"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Assessment Update Details */}
              {singleSuccess.assessment_update && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  {/* Card 1: Baseline Transition */}
                  <div className="p-3.5 rounded-xl bg-white/90 border border-emerald-200/80 shadow-2xs space-y-1.5">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-teal-600" />
                      Personal Baseline Corridor
                    </div>
                    {singleSuccess.assessment_update.is_first_observation ? (
                      <div className="text-slate-700 text-xs">
                        <span className="inline-block px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold text-[10px] mb-1">
                          Initial Observation
                        </span>
                        <p className="text-[11px] text-slate-500">
                          First reading for this biometric ({singleSuccess.value} {singleSuccess.unit}). Minimum 3 historical readings needed for a locked baseline corridor.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-slate-600">
                          <span>Previous Median:</span>
                          <span className="font-mono font-semibold text-slate-800">
                            {singleSuccess.assessment_update.previous_baseline?.median ?? 'None'} {singleSuccess.unit}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-900 font-semibold">
                          <span>Recalculated Median:</span>
                          <span className="font-mono text-teal-700 font-bold">
                            {singleSuccess.assessment_update.updated_baseline?.median ?? singleSuccess.value} {singleSuccess.unit}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {singleSuccess.assessment_update.updated_baseline?.sample_count ?? 1} samples in {singleSuccess.assessment_update.updated_baseline?.window_days ?? 30}d window
                          {singleSuccess.assessment_update.updated_baseline?.is_sufficient === false && ' (Provisional)'}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card 2: Deviation Analysis */}
                  <div className="p-3.5 rounded-xl bg-white/90 border border-emerald-200/80 shadow-2xs space-y-1.5">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-teal-600" />
                      Baseline Deviation
                    </div>
                    {singleSuccess.assessment_update.deviation ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">Absolute Shift:</span>
                          <span className="font-mono font-bold text-slate-900">
                            {singleSuccess.assessment_update.deviation.delta_absolute > 0 ? `+${singleSuccess.assessment_update.deviation.delta_absolute}` : singleSuccess.assessment_update.deviation.delta_absolute} {singleSuccess.unit}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">Relative Delta:</span>
                          {singleSuccess.assessment_update.deviation.relative_is_excluded ? (
                            <span className="text-[10px] text-slate-400 italic" title={singleSuccess.assessment_update.deviation.exclusion_reason}>
                              Excluded (percentage scale)
                            </span>
                          ) : (
                            <span className="font-mono font-bold text-slate-900">
                              {singleSuccess.assessment_update.deviation.delta_percentage > 0 ? `+${singleSuccess.assessment_update.deviation.delta_percentage}%` : `${singleSuccess.assessment_update.deviation.delta_percentage}%`}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-500">Z-Score: <strong className="font-mono text-slate-700">{singleSuccess.assessment_update.deviation.z_score}</strong></span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            singleSuccess.assessment_update.deviation.status === 'optimal'
                              ? 'bg-emerald-100 text-emerald-800'
                              : singleSuccess.assessment_update.deviation.status === 'mild_deviation'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}>
                            {singleSuccess.assessment_update.deviation.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500">
                        Insufficient historical window to calculate baseline sigma deviation.
                      </p>
                    )}
                  </div>

                  {/* Card 3: Vitality & Alert Impact */}
                  <div className="p-3.5 rounded-xl bg-white/90 border border-emerald-200/80 shadow-2xs space-y-1.5">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                      <HeartPulse className="w-3.5 h-3.5 text-teal-600" />
                      Twin State Impact
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-600">Autonomic Vitality:</span>
                        <span className="font-mono font-bold text-teal-700 text-sm">
                          {singleSuccess.assessment_update.vitality_index ?? '—'} / 100
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Twin Stability:</span>
                        <span className="font-semibold text-slate-800 capitalize">
                          {singleSuccess.assessment_update.stability_status ? singleSuccess.assessment_update.stability_status.replace('_', ' ') : 'Stable'}
                        </span>
                      </div>
                      {singleSuccess.assessment_update.triggered_alert ? (
                        <div className="p-1.5 rounded bg-rose-50 border border-rose-200 text-rose-900 text-[10px] font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                          <span>Alert Triggered: {singleSuccess.assessment_update.triggered_alert.title}</span>
                        </div>
                      ) : (
                        <div className="text-[10px] text-emerald-700 font-medium">
                          ✓ No clinical safety alerts triggered
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Sufficiency Warning (if applicable) */}
              {singleSuccess.assessment_update?.sufficiency_message && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{singleSuccess.assessment_update.sufficiency_message}</span>
                </div>
              )}

              {/* Explanation Summary & Quick Links */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                <p className="text-xs text-slate-700 italic">
                  "{singleSuccess.assessment_update?.explanation || 'Observation successfully persisted into MongoDB and twin state updated.'}"
                </p>

                {onNavigate && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onNavigate('digital-twin')}
                      className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1"
                    >
                      <span>Digital Twin</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onNavigate('health-trends')}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold shadow-2xs transition-colors"
                    >
                      Trends & Corridors
                    </button>
                    <button
                      onClick={() => onNavigate('timeline')}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold shadow-2xs transition-colors"
                    >
                      Timeline
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Banner */}
          {singleError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 shadow-xs flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <div className="text-xs font-medium">{singleError}</div>
            </div>
          )}

          <form onSubmit={handleSingleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                <Activity className="w-4 h-4 text-teal-600" />
                Measurement Entry Details
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Select physiological signal, enter value, and verify units. Plausible boundaries prevent typos without clinical mislabeling.
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* Row 1: Patient & Metric Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Selected Patient <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedPatientId}
                    onChange={e => {
                      setSelectedPatientId(e.target.value);
                      setCurrentPatientId(e.target.value);
                    }}
                    required
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-xs text-slate-900 outline-hidden bg-white"
                  >
                    {patients.map(p => (
                      <option key={p.patient_id} value={p.patient_id}>
                        {p.patient_id} — {p.full_name} ({p.age}y, {p.biological_sex})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Measurement Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={metricType}
                    onChange={e => handleMetricTypeChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-xs text-slate-900 outline-hidden bg-white"
                  >
                    {SUPPORTED_METRICS.map(m => (
                      <option key={m.type} value={m.type}>
                        {m.label} ({m.defaultUnit})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Value, Unit, Timestamp */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Numeric Value <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step={currentMeta.step}
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    placeholder={currentMeta.placeholder}
                    required
                    className={`w-full px-3.5 py-2.5 rounded-lg border focus:ring-2 text-xs text-slate-900 font-mono transition-colors ${
                      plausibilityResult && !plausibilityResult.is_plausible
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-50/20'
                        : 'border-slate-300 focus:border-teal-500 focus:ring-teal-500/20'
                    }`}
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                    <span>Valid bounds: {currentMeta.min} – {currentMeta.max} {unit}</span>
                    {isValidatingPlausibility && (
                      <span className="text-teal-600 font-mono text-[10px] animate-pulse">AI Checking...</span>
                    )}
                  </div>

                  {/* Live ML Plausibility & Typo Guard Alert */}
                  {plausibilityResult && (
                    <div className={`mt-2 p-2.5 rounded-lg text-xs border transition-all ${
                      plausibilityResult.is_plausible
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border-rose-300 shadow-xs'
                    }`}>
                      <div className="flex items-center justify-between font-semibold">
                        <span className="flex items-center gap-1.5">
                          {plausibilityResult.is_plausible ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          )}
                          ML Plausibility: {plausibilityResult.plausibility_score}%
                        </span>
                        <span className="text-[10px] font-mono opacity-80">
                          Confidence Weight: {Math.round(plausibilityResult.confidence_weight * 100)}%
                        </span>
                      </div>
                      {plausibilityResult.warnings.length > 0 && (
                        <div className="mt-1 text-[11px] space-y-0.5 text-rose-700">
                          {plausibilityResult.warnings.map((w, i) => (
                            <div key={i}>⚠️ {w}</div>
                          ))}
                        </div>
                      )}
                      {plausibilityResult.suggested_value !== null && plausibilityResult.suggested_value !== undefined && (
                        <button
                          type="button"
                          onClick={() => setValue(String(plausibilityResult.suggested_value))}
                          className="mt-2 px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
                        >
                          <Zap className="w-3 h-3" />
                          Auto-correct typo to {plausibilityResult.suggested_value} {unit}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Unit <span className="text-slate-400 font-normal">(auto-selected)</span>
                  </label>
                  <select
                    value={unit}
                    onChange={e => setUnit(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-xs text-slate-900 bg-white"
                  >
                    {currentMeta.allowedUnits.map(u => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-teal-600 mt-1 block">
                    {currentMeta.help}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Observation Date & Time <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={obsTimestamp}
                    onChange={e => setObsTimestamp(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-xs text-slate-900"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Defaults to current local time.
                  </span>
                </div>
              </div>

              {/* Row 3: Source and Data Classification */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Origin Source
                  </label>
                  <select
                    value={source}
                    onChange={e => setSource(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-xs text-slate-900 bg-white"
                  >
                    <option value="manual_entry">Manual Patient Entry (App Form)</option>
                    <option value="wearable_continuous">Wearable Sensor Stream</option>
                    <option value="clinical_lab">Certified Clinical Laboratory / Clinic</option>
                    <option value="wearable_import">Wearable Historical CSV Export</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Data Classification <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={dataClassification}
                    onChange={e => setDataClassification(e.target.value as DataClassification)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-xs text-slate-900 bg-white"
                  >
                    <option value="user_entered">User-Entered (Self-Reported)</option>
                    <option value="wearable_imported">Wearable-Imported (Measured Device)</option>
                    <option value="synthetic_demo">Synthetic Demonstration Record</option>
                    <option value="simulated">Simulated Scenario Output</option>
                  </select>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Discloses clinical provenance. Persistence in MongoDB ≠ true clinical truth.
                  </span>
                </div>
              </div>

              {/* Row 4: Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Optional Measurement Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Taken post 10-minute rest before breakfast."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-xs text-slate-900 placeholder-slate-400"
                />
              </div>
            </div>

            {/* Submit Bar */}
            <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="submit"
                disabled={isSingleSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white text-xs font-bold shadow-xs transition-colors"
              >
                {isSingleSubmitting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Writing to MongoDB...</span>
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4" />
                    <span>Save Observation</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: DAILY LIFESTYLE LOG */}
      {activeSubTab === 'lifestyle' && (
        <div className="space-y-6">
          {lifestyleSuccessMsg && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{lifestyleSuccessMsg}</span>
            </div>
          )}

          {lifestyleError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{lifestyleError}</span>
            </div>
          )}

          {/* Calculation Engine Explanation Box */}
          <div className="p-5 rounded-2xl bg-teal-50/70 border border-teal-200 text-teal-950 space-y-3">
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wide text-teal-900">
              <Info className="w-4 h-4 text-teal-700" />
              How Lifestyle Inputs Contribute to the Calculation Engine
            </div>
            <p className="text-xs text-teal-800 leading-relaxed">
              SwasthyaTwin only stores and requests lifestyle fields that actually drive backend models. Here is how each parameter connects to the digital twin state:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white/80 rounded-xl border border-teal-200">
                <strong className="text-teal-900 block font-semibold mb-1">
                  1. Sleep Duration (hours):
                </strong>
                Directly feeds rolling 30-day baseline mean and standard deviation. Sleep debt (&lt; 6.0h) triggers an autonomic recovery penalty of up to 15 vitality points and modulates HRV expectation.
              </div>
              <div className="p-3 bg-white/80 rounded-xl border border-teal-200">
                <strong className="text-teal-900 block font-semibold mb-1">
                  2. Activity / Daily Steps:
                </strong>
                Quantifies daily physical exertion volume. Steps are cross-referenced with resting heart rate and blood pressure to differentiate true cardiac drift from healthy exercise adaptations.
              </div>
              <div className="p-3 bg-white/80 rounded-xl border border-teal-200">
                <strong className="text-teal-900 block font-semibold mb-1">
                  3. General Activity Level:
                </strong>
                Calibrates baseline standard deviation windows. Highly active profiles are evaluated against wider normal cardiovascular variances.
              </div>
              <div className="p-3 bg-white/80 rounded-xl border border-teal-200">
                <strong className="text-teal-900 block font-semibold mb-1">
                  4. Meal & Hydration Notes:
                </strong>
                Preserved as descriptive clinical context. <em className="text-teal-700 font-medium">Notice: Notes do NOT arbitrarily alter machine learning forecasts without quantitative lab data.</em>
              </div>
            </div>
          </div>

          <form onSubmit={handleLifestyleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
              Daily Lifestyle Form
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Sleep Duration (Hours) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="24"
                  value={lifestyleSleep}
                  onChange={e => setLifestyleSleep(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Daily Steps <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="100"
                  min="0"
                  max="100000"
                  value={lifestyleSteps}
                  onChange={e => setLifestyleSteps(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  General Activity Level
                </label>
                <select
                  value={lifestyleActivity}
                  onChange={e => setLifestyleActivity(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs text-slate-900 bg-white"
                >
                  <option value="sedentary">Sedentary (&lt; 5,000 steps)</option>
                  <option value="light">Light Activity (5,000 - 7,500 steps)</option>
                  <option value="moderate">Moderate Activity (7,500 - 10,000 steps)</option>
                  <option value="active">Active / High Performance (&gt; 10,000 steps)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Meal & Hydration Context Notes <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                rows={2}
                value={lifestyleNotes}
                onChange={e => setLifestyleNotes(e.target.value)}
                placeholder="e.g. 2.5L water intake, high-sodium lunch, rested well."
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs text-slate-900"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isLifestyleSubmitting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white text-xs font-bold transition-colors"
              >
                {isLifestyleSubmitting ? 'Logging...' : 'Save Daily Lifestyle Log'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: WEARABLE CSV IMPORT */}
      {activeSubTab === 'csv' && (
        <div className="space-y-6">
          {csvSuccessMsg && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{csvSuccessMsg}</span>
            </div>
          )}

          {csvError && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{csvError}</span>
            </div>
          )}

          {/* Action Header Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Wearable & Sensor CSV Import
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Upload historical exports from smartwatches, continuous monitors, or clinical cuffs. Every row is strictly validated before persistence.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={downloadCsvTemplate}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
              >
                <Download className="w-4 h-4 text-slate-500" />
                <span>Download Sample Template</span>
              </button>

              <label className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold cursor-pointer transition-colors">
                <Upload className="w-4 h-4" />
                <span>Select CSV File</span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCsvFileChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Validation Preview Table */}
          {isValidatingCsv && (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
              <span className="w-6 h-6 border-2 border-teal-500/30 border-t-teal-600 rounded-full animate-spin inline-block mb-2" />
              <div className="text-xs text-slate-600 font-semibold">
                Validating CSV rows, physiological bounds, and checking for duplicates...
              </div>
            </div>
          )}

          {/* CSV Preview with Ingestion Engine Analysis */}
          {(csvPreviewResult || validationResult) && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4 animate-fade-in">
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-teal-600" />
                      CSV Ingestion Pre-Verification
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                      Total: {csvPreviewResult?.total_rows ?? validationResult?.total_rows}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                      Valid: {csvPreviewResult?.valid_rows_count ?? validationResult?.valid_rows}
                    </span>
                    {((csvPreviewResult?.unusual_rows_count ?? 0) > 0) && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800">
                        Unusual: {csvPreviewResult?.unusual_rows_count}
                      </span>
                    )}
                    {((csvPreviewResult?.rejected_rows_count ?? validationResult?.invalid_rows ?? 0) > 0) && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-800">
                        Rejected: {csvPreviewResult?.rejected_rows_count ?? validationResult?.invalid_rows}
                      </span>
                    )}
                    {((csvPreviewResult?.duplicate_rows_count ?? validationResult?.duplicate_rows ?? 0) > 0) && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-orange-100 text-orange-800">
                        Duplicates: {csvPreviewResult?.duplicate_rows_count ?? validationResult?.duplicate_rows}
                      </span>
                    )}
                  </div>

                  {/* Detected Columns */}
                  {csvPreviewResult?.detected_columns && (
                    <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-600">
                      <span className="font-semibold text-slate-500">Detected Columns:</span>
                      {csvPreviewResult.detected_columns.map((col: string) => (
                        <span key={col} className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono font-medium">
                          {col}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
                  {((csvPreviewResult?.unusual_rows_count ?? 0) > 0) && (
                    <label className="flex items-center gap-1.5 text-xs text-amber-900 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmUnusualAllCSV}
                        onChange={e => setConfirmUnusualAllCSV(e.target.checked)}
                        className="rounded text-teal-600 focus:ring-teal-500"
                      />
                      <span>Confirm {csvPreviewResult.unusual_rows_count} unusual readings in batch</span>
                    </label>
                  )}

                  <button
                    onClick={handleImportCsv}
                    disabled={isImportingCsv || ((csvPreviewResult?.valid_rows_count ?? validationResult?.valid_rows) === 0)}
                    className="flex items-center gap-2 px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white text-xs font-bold transition-colors"
                  >
                    {isImportingCsv ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Importing into MongoDB...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          Confirm Import ({csvPreviewResult?.valid_rows_count ?? validationResult?.valid_rows} Rows)
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Proposed Unit Mappings Banner */}
              {csvPreviewResult?.proposed_unit_conversions && csvPreviewResult.proposed_unit_conversions.length > 0 && (
                <div className="mx-5 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-950 text-xs space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5 text-blue-900">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    Proposed Canonical Unit Conversions ({csvPreviewResult.proposed_unit_conversions.length} detected)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {csvPreviewResult.proposed_unit_conversions.map((conv: any, i: number) => (
                      <div key={i} className="p-2 rounded-lg bg-white border border-blue-200 text-[11px] font-mono">
                        <span className="font-bold text-blue-900 block">Row #{conv.row}: {conv.metric}</span>
                        <span className="text-slate-600">{conv.from_unit} → <strong className="text-teal-700">{conv.to_unit}</strong></span>
                        <div className="text-[10px] text-slate-400 mt-0.5">{conv.note}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Valid & Unusual Rows Table */}
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5">Row</th>
                      <th className="px-4 py-2.5">Metric Type</th>
                      <th className="px-4 py-2.5">Entered Value</th>
                      <th className="px-4 py-2.5">Canonical Value</th>
                      <th className="px-4 py-2.5">Timestamp</th>
                      <th className="px-4 py-2.5">Status & Warnings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {csvPreviewResult ? (
                      csvPreviewResult.validated_rows.map((r: any) => (
                        <tr
                          key={r.row_number}
                          className={!r.is_valid ? 'bg-rose-50/50' : r.is_unusual ? 'bg-amber-50/40' : ''}
                        >
                          <td className="px-4 py-2 font-mono text-slate-500">#{r.row_number}</td>
                          <td className="px-4 py-2 font-medium text-slate-900">{r.measurement_type}</td>
                          <td className="px-4 py-2 font-mono text-slate-600">
                            {r.original_value} {r.original_unit}
                          </td>
                          <td className="px-4 py-2 font-mono font-bold text-slate-900">
                            {r.canonical_value} {r.canonical_unit}
                          </td>
                          <td className="px-4 py-2 text-slate-500 text-[11px] font-mono">
                            {new Date(r.observed_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-2">
                            {!r.is_valid ? (
                              <span className="text-rose-600 font-semibold text-[11px] flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 inline shrink-0" />
                                {r.errors.join('; ')}
                              </span>
                            ) : r.is_unusual ? (
                              <div className="space-y-0.5">
                                <span className="text-amber-800 font-semibold text-[11px] flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5 inline shrink-0 text-amber-600" />
                                  Unusual measurement
                                </span>
                                {r.warnings.map((w: string, wi: number) => (
                                  <div key={wi} className="text-[10px] text-amber-700">{w}</div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-emerald-700 font-semibold text-[11px] flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 inline shrink-0" />
                                Valid for import
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      validationResult?.rows.map(r => (
                        <tr
                          key={r.row_index}
                          className={!r.is_valid ? 'bg-rose-50/50' : r.is_duplicate ? 'bg-amber-50/40' : ''}
                        >
                          <td className="px-4 py-2 font-mono text-slate-500">#{r.row_index}</td>
                          <td className="px-4 py-2 font-medium text-slate-900">{r.metric_type}</td>
                          <td className="px-4 py-2 font-mono text-slate-600">{r.value} {r.unit}</td>
                          <td className="px-4 py-2 font-mono font-bold text-slate-900">{r.value} {r.unit}</td>
                          <td className="px-4 py-2 text-slate-500 text-[11px]">
                            {new Date(r.timestamp).toLocaleString()}
                          </td>
                          <td className="px-4 py-2">
                            {!r.is_valid ? (
                              <span className="text-rose-600 font-semibold text-[11px] flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 inline" />
                                {r.errors.join('; ')}
                              </span>
                            ) : (
                              <span className="text-emerald-700 font-semibold text-[11px] flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 inline" />
                                Valid for import
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Rejected Rows Section with Exact Reasons */}
              {csvPreviewResult?.rejected_samples && csvPreviewResult.rejected_samples.length > 0 && (
                <div className="p-4 bg-rose-50/70 border-t border-rose-200 space-y-2">
                  <div className="font-bold text-xs text-rose-900 flex items-center gap-1.5 uppercase tracking-wide">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    Rejected Rows ({csvPreviewResult.rejected_rows_count} rows will NOT be imported)
                  </div>
                  <div className="space-y-1.5 text-xs text-rose-800">
                    {csvPreviewResult.rejected_samples.map((rej: any, idx: number) => (
                      <div key={idx} className="p-2 rounded bg-white border border-rose-200 flex items-start justify-between gap-3 font-mono text-[11px]">
                        <div>
                          <strong className="text-rose-950">Row #{rej.row_number}: {rej.measurement_type} = {rej.original_value} {rej.original_unit}</strong>
                          <div className="text-rose-700 mt-0.5">{rej.errors.join('; ')}</div>
                        </div>
                        {rej.suggested_correction && (
                          <span className="text-[10px] bg-rose-100 text-rose-900 px-2 py-0.5 rounded font-sans font-semibold">
                            Suggested: {rej.suggested_correction}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: DATA HISTORY & AUDIT CORRECTIONS */}
      {activeSubTab === 'history' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-teal-600" />
                  Recent Observations for {selectedPatientId}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Full historical log with clinical audit trail. Observations can be corrected or removed with logged justifications.
                </p>
              </div>

              <button
                onClick={loadHistory}
                disabled={isLoadingHistory}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
              >
                {isLoadingHistory ? 'Refreshing...' : 'Refresh History'}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="px-5 py-3">Timestamp</th>
                    <th className="px-5 py-3">Metric</th>
                    <th className="px-5 py-3">Value</th>
                    <th className="px-5 py-3">Classification & Provenance</th>
                    <th className="px-5 py-3">Validation Status</th>
                    <th className="px-5 py-3">Notes & Audit</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyObservations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400">
                        {isLoadingHistory
                          ? 'Loading observations from MongoDB...'
                          : `No recent observations recorded for ${selectedPatientId}.`}
                      </td>
                    </tr>
                  ) : (
                    historyObservations.map(obs => {
                      const obsId = obs._id || obs.observation_id || '';
                      const classification = (obs as any).data_classification || (obs.data_tier === 'user_reported' ? 'user_entered' : 'measured');
                      const valStatus = (obs as any).validation_status || 'valid';
                      const editCount = (obs as any).edit_history ? (obs as any).edit_history.length : 0;
                      return (
                        <tr key={obsId} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-3 font-mono text-[11px] text-slate-600">
                            {new Date(obs.timestamp).toLocaleString()}
                          </td>
                          <td className="px-5 py-3 font-semibold text-slate-900">
                            {obs.metric_type}
                          </td>
                          <td className="px-5 py-3 font-mono font-bold text-slate-900">
                            {obs.value} {obs.unit}
                            {(obs as any).was_unit_converted && (
                              <span className="block text-[10px] font-normal text-teal-600">
                                (from {(obs as any).original_value} {(obs as any).original_unit})
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <div className="space-y-1">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  classification === 'user_entered'
                                    ? 'bg-blue-100 text-blue-800'
                                    : classification === 'wearable_imported'
                                    ? 'bg-purple-100 text-purple-800'
                                    : classification === 'synthetic_demo'
                                    ? 'bg-slate-100 text-slate-700'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {classification.replace('_', ' ')}
                              </span>
                              <div className="text-[10px] font-mono text-slate-400">
                                {(obs as any).source_type || obs.source}
                                {(obs as any).device_id ? ` • ${(obs as any).device_id}` : ''}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            {valStatus === 'valid' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                Valid
                              </span>
                            ) : valStatus === 'confirmed_unusual' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                                Confirmed Unusual
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                                {valStatus}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-slate-500 max-w-xs">
                            <div className="truncate text-xs">{obs.notes || '—'}</div>
                            {editCount > 0 && (
                              <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded bg-slate-100 text-[10px] font-mono text-slate-600 border border-slate-200">
                                Edited ×{editCount}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right space-x-1">
                            <button
                              onClick={() => openEditObsModal(obs)}
                              className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded"
                              title="Correct Observation"
                            >
                              <Edit2 className="w-3.5 h-3.5 inline" />
                            </button>
                            <button
                              onClick={() => handleDeleteObs(obs)}
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                              title="Delete Observation"
                            >
                              <Trash2 className="w-3.5 h-3.5 inline" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: REVIEW DATA QUALITY & INGESTION SAFEGUARDS */}
      {activeSubTab === 'data_quality' && (
        <div className="space-y-6 animate-fade-in">
          {/* Header Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-teal-500/10 text-teal-600 border border-teal-500/20">
                  <Shield className="w-5 h-5" />
                </span>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Health Data & Ingestion Quality Architecture
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Multi-layer physiological plausibility, explicit unit conversions, patient isolation, and pre-inference prediction safeguards.
              </p>
            </div>

            <button
              onClick={loadSafeguardData}
              disabled={isLoadingSafeguard}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 text-white text-xs font-bold transition-colors"
            >
              {isLoadingSafeguard ? 'Auditing Features...' : 'Re-audit Inference Readiness'}
            </button>
          </div>

          {/* Section 1: Provenance & Patient Isolation Guarantee */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <Layers className="w-4 h-4 text-teal-600" />
              1. Provenance Architecture & Five Ingestion Channels
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Every health observation ingested into SwasthyaTwin preserves immutable clinical provenance metadata, including canonical unit mappings, source identifier, device ID, validation status, and audit change logs.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Manual Entry (user_entered)
                </div>
                <p className="text-slate-500 text-[11px]">
                  Direct self-reported or clinician-keyed entries via app forms. Subject to interactive plausibility checks and confirmation dialogs.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  Imported File (imported_file)
                </div>
                <p className="text-slate-500 text-[11px]">
                  Batch CSV exports from smartwatch apps or clinic files. Verified through pre-import preview with column detection and unit conversions.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-teal-500" />
                  Device Measurement (device_measurement)
                </div>
                <p className="text-slate-500 text-[11px]">
                  Live optical bio-scanner telemetry, Bluetooth smart cuffs, and continuous wearable streams with hardware device identifiers.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Certified Clinical Lab (clinical_lab)
                </div>
                <p className="text-slate-500 text-[11px]">
                  Venous blood draws, laboratory panels, and formal diagnostic screenings acting as gold-standard reference points.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1 sm:col-span-2">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Research Datasets & Synthetic Demos (public_research_dataset / synthetic_demo)
                </div>
                <p className="text-slate-500 text-[11px]">
                  PhysioNet Sleep-EDF benchmark recordings and offline demonstration profiles. Strictly segregated in isolated MongoDB partitions.
                </p>
              </div>
            </div>

            {/* Strict Isolation Callout */}
            <div className="p-4 rounded-xl bg-teal-50/80 border border-teal-200 text-teal-950 text-xs flex items-start gap-3">
              <Shield className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold text-teal-950 mb-0.5">
                  Strict Personal Baseline Isolation Guarantee:
                </strong>
                <span>
                  SwasthyaTwin guarantees that public research participants (such as PhysioNet Sleep-EDF cohort members) and synthetic demonstration profiles are never merged into a real user's personal baseline corridor. Each patient baseline is calculated strictly from that individual's own verified historical observations.
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Clinical Corridor Reference Standards */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <Activity className="w-4 h-4 text-teal-600" />
                2. Configurable Plausibility Corridors & Medical Reference Sources
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Plausibility limits are computational data-quality checks, not clinical decision thresholds. Unplausible values trigger hard rejections (400), while unusual readings trigger confirmation dialogs (409) rather than silent modification.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="px-4 py-2.5">Biometric Signal</th>
                    <th className="px-4 py-2.5">Canonical Unit</th>
                    <th className="px-4 py-2.5">Hard Rejection Limits</th>
                    <th className="px-4 py-2.5">Soft Review Corridor</th>
                    <th className="px-4 py-2.5">Medical Reference Standard</th>
                    <th className="px-4 py-2.5">Unit Conversions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  <tr>
                    <td className="px-4 py-2 font-sans font-semibold text-slate-900">Resting Heart Rate</td>
                    <td className="px-4 py-2 text-teal-700 font-bold">bpm</td>
                    <td className="px-4 py-2 text-rose-700">&lt; 20 or &gt; 300</td>
                    <td className="px-4 py-2 text-amber-700">35 – 180 bpm</td>
                    <td className="px-4 py-2 font-sans text-slate-600">AHA / ACC Resting Standards</td>
                    <td className="px-4 py-2 font-sans text-slate-400">Canonical: bpm</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-sans font-semibold text-slate-900">Systolic Blood Pressure</td>
                    <td className="px-4 py-2 text-teal-700 font-bold">mmHg</td>
                    <td className="px-4 py-2 text-rose-700">&lt; 30 or &gt; 300</td>
                    <td className="px-4 py-2 text-amber-700">50 – 240 mmHg</td>
                    <td className="px-4 py-2 font-sans text-slate-600">AHA Guidelines & ISO 81060-2</td>
                    <td className="px-4 py-2 font-sans text-slate-600">kPa → mmHg (× 7.5006)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-sans font-semibold text-slate-900">Diastolic Blood Pressure</td>
                    <td className="px-4 py-2 text-teal-700 font-bold">mmHg</td>
                    <td className="px-4 py-2 text-rose-700">&lt; 20 or &gt; 200</td>
                    <td className="px-4 py-2 text-amber-700">30 – 140 mmHg</td>
                    <td className="px-4 py-2 font-sans text-slate-600">ISO 81060-2 (Must be &lt; Systolic)</td>
                    <td className="px-4 py-2 font-sans text-slate-600">kPa → mmHg (× 7.5006)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-sans font-semibold text-slate-900">Blood Glucose</td>
                    <td className="px-4 py-2 text-teal-700 font-bold">mg/dL</td>
                    <td className="px-4 py-2 text-rose-700">&lt; 10 or &gt; 1500</td>
                    <td className="px-4 py-2 text-amber-700">40 – 450 mg/dL</td>
                    <td className="px-4 py-2 font-sans text-slate-600">American Diabetes Association (ADA)</td>
                    <td className="px-4 py-2 font-sans text-slate-600">mmol/L → mg/dL (× 18.0182)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-sans font-semibold text-slate-900">Sleep Duration</td>
                    <td className="px-4 py-2 text-teal-700 font-bold">hours</td>
                    <td className="px-4 py-2 text-rose-700">&lt; 0 or &gt; 24</td>
                    <td className="px-4 py-2 text-amber-700">2.0 – 16.0 hrs</td>
                    <td className="px-4 py-2 font-sans text-slate-600">National Sleep Foundation (NSF)</td>
                    <td className="px-4 py-2 font-sans text-slate-600">minutes → hours (÷ 60)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-sans font-semibold text-slate-900">Respiratory Rate</td>
                    <td className="px-4 py-2 text-teal-700 font-bold">breaths/min</td>
                    <td className="px-4 py-2 text-rose-700">&lt; 3 or &gt; 80</td>
                    <td className="px-4 py-2 text-amber-700">6 – 45 breaths/min</td>
                    <td className="px-4 py-2 font-sans text-slate-600">WHO / ATS Clinical Standards</td>
                    <td className="px-4 py-2 font-sans text-slate-400">Canonical: breaths/min</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-sans font-semibold text-slate-900">Body Temperature</td>
                    <td className="px-4 py-2 text-teal-700 font-bold">°C</td>
                    <td className="px-4 py-2 text-rose-700">&lt; 30.0 or &gt; 45.0</td>
                    <td className="px-4 py-2 text-amber-700">35.0 – 41.0 °C</td>
                    <td className="px-4 py-2 font-sans text-slate-600">Clinical Thermometry Guidelines</td>
                    <td className="px-4 py-2 font-sans text-slate-600">°F → °C ((F - 32) × 5/9)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-sans font-semibold text-slate-900">Body Weight</td>
                    <td className="px-4 py-2 text-teal-700 font-bold">kg</td>
                    <td className="px-4 py-2 text-rose-700">&lt; 1.0 or &gt; 500.0</td>
                    <td className="px-4 py-2 text-amber-700">25.0 – 250.0 kg</td>
                    <td className="px-4 py-2 font-sans text-slate-600">Physical plausibility boundaries</td>
                    <td className="px-4 py-2 font-sans text-slate-600">lbs → kg (÷ 2.20462)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 space-y-1">
              <strong className="text-slate-800">Multi-variate Inconsistency Rules:</strong>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                <div>• Diastolic pressure $\ge$ Systolic pressure is rejected as technically impossible.</div>
                <div>• Pulse pressure &lt; 15 mmHg or &gt; 120 mmHg triggers an unusual alert.</div>
                <div>• Future timestamps &gt; 5 minutes into the future are rejected.</div>
                <div>• Impossible dates prior to 1970-01-01 are rejected.</div>
              </div>
            </div>
          </div>

          {/* Section 3: Pre-Inference Prediction Safeguards & Feature Readiness Inspector */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                  <HeartPulse className="w-4 h-4 text-teal-600" />
                  3. Pre-Inference Prediction Safeguards Inspector
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Patient: <strong className="text-slate-800 font-mono">{selectedPatientId}</strong> • Audits feature availability, temporal freshness (&le;30d), and prevents misleading zero-imputed predictions.
                </p>
              </div>

              {mlSafeguardData && (
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  mlSafeguardData.status === 'ready'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-100 text-amber-900 border border-amber-300'
                }`}>
                  Status: {mlSafeguardData.status?.replace('_', ' ')}
                </span>
              )}
            </div>

            {/* Zero-Imputation Prohibition Callout */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
              <strong className="text-slate-900 block font-semibold">
                Core Machine Learning Safeguard: Zero-Imputation Prohibition
              </strong>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                SwasthyaTwin never infers that an unmeasured biometric is zero (e.g., zero glucose, zero heart rate, or zero sleep). When required features are missing or outside supported training schemas, the pipeline honestly withholds inference with structured status explanations rather than returning a confident-looking hallucinated number.
              </p>
            </div>

            {/* Live Safeguard Status Details */}
            {mlSafeguardData && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Panel A: Status & Limitations */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2">
                  <span className="font-bold text-slate-800 block text-xs uppercase tracking-wide">
                    Inference Readiness Audit
                  </span>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Pipeline Status:</span>
                      <span className="font-mono font-bold capitalize text-slate-800">
                        {mlSafeguardData.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Model Version:</span>
                      <span className="font-mono text-slate-700">{mlSafeguardData.model_version || '2.4.0'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Synthetic Record:</span>
                      <span className="font-mono text-slate-700">
                        {mlSafeguardData.data_provenance?.is_synthetic ? 'Yes (Demo Demo)' : 'No (Clinical Individual)'}
                      </span>
                    </div>
                  </div>

                  {mlSafeguardData.limitations && mlSafeguardData.limitations.length > 0 && (
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[11px] font-bold text-slate-600 block mb-1">
                        Active Model Limitations:
                      </span>
                      <ul className="text-[11px] space-y-1 text-slate-500 list-disc list-inside">
                        {mlSafeguardData.limitations.map((lim: string, idx: number) => (
                          <li key={idx}>{lim}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Panel B: Missing & Stale Features */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-2">
                  <span className="font-bold text-slate-800 block text-xs uppercase tracking-wide">
                    Feature Availability & Freshness Audit
                  </span>

                  {mlSafeguardData.data_provenance?.missing_features && mlSafeguardData.data_provenance.missing_features.length > 0 ? (
                    <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-[11px]">
                      <strong className="block font-bold">Missing Required Features:</strong>
                      <div className="mt-1 flex flex-wrap gap-1 font-mono">
                        {mlSafeguardData.data_provenance.missing_features.map((f: string) => (
                          <span key={f} className="px-1.5 py-0.5 rounded bg-rose-200 text-rose-950 font-semibold">
                            {f}
                          </span>
                        ))}
                      </div>
                      <div className="text-[10px] text-rose-700 mt-1">
                        Predictions are withheld until these biometrics are recorded.
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>All required baseline features are present in MongoDB.</span>
                    </div>
                  )}

                  {mlSafeguardData.data_provenance?.stale_features && mlSafeguardData.data_provenance.stale_features.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
                      <strong className="block font-bold">Stale Features (&gt; 30 Days):</strong>
                      <div className="mt-1 flex flex-wrap gap-1 font-mono">
                        {mlSafeguardData.data_provenance.stale_features.map((f: string) => (
                          <span key={f} className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-950 font-semibold">
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {mlSafeguardData.warnings && mlSafeguardData.warnings.length > 0 && (
                    <div className="pt-2">
                      <span className="text-[11px] font-bold text-slate-600 block mb-1">
                        Quality Warnings:
                      </span>
                      <ul className="text-[11px] space-y-0.5 text-amber-800">
                        {mlSafeguardData.warnings.map((w: string, idx: number) => (
                          <li key={idx}>⚠️ {w}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Clinical & Non-Diagnostic Disclaimer */}
          <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200 text-amber-950 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              Algorithmic Data Quality & Plausibility Disclaimer
            </div>
            <p className="text-amber-900/90 leading-relaxed">
              SwasthyaTwin validation rules enforce data format integrity, explicit unit conversions, mathematical plausibility corridors, and temporal coherence. <strong>Validation checks do not guarantee medical correctness, certify physiological absence of disease, or substitute for professional clinical diagnosis.</strong> A measurement that passes all data-quality checks may still represent an abnormal clinical finding requiring prompt evaluation by a licensed healthcare provider.
            </p>
          </div>
        </div>
      )}

      {/* Edit Observation Modal (Audit Trail) */}
      {editingObs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-teal-600" />
                Correct Observation
              </h3>
              <button
                onClick={() => setEditingObs(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateObs} className="p-5 space-y-4">
              {updateError && (
                <div className="p-3 rounded-lg bg-rose-50 text-rose-800 text-xs">
                  {updateError}
                </div>
              )}

              <div className="text-xs text-slate-600">
                Updating <strong className="text-slate-900">{editingObs.metric_type}</strong> from{' '}
                <span className="font-mono font-bold text-slate-800">
                  {editingObs.value} {editingObs.unit}
                </span>
                .
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Corrected Numeric Value ({editingObs.unit}) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Clinical / Audit Reason for Correction <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={editReason}
                  onChange={e => setEditReason(e.target.value)}
                  placeholder="e.g. Typo during manual cuff transcription; verified against clinic chart."
                  required
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingObs(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingObs}
                  className="px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold"
                >
                  {isUpdatingObs ? 'Updating...' : 'Save Audit Correction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Suspicious / Unusual Value Confirmation Dialog */}
      {suspiciousModal && suspiciousModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-amber-300 shadow-2xl max-w-lg w-full overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="p-5 border-b border-amber-100 bg-amber-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-xs">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-amber-950">
                    Unusual Health Measurement Detected
                  </h3>
                  <p className="text-[11px] text-amber-800">
                    Input Quality Safeguard • Confirmation Required Before Saving
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSuspiciousModal(null)}
                className="text-amber-800/60 hover:text-amber-950 p-1"
                aria-label="Close dialog"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-700 leading-relaxed">
                The reading entered for <strong className="font-semibold text-slate-900">{suspiciousModal.metricType.replace('_', ' ')}</strong> is outside typical physiological corridors, but is technically plausible. To protect digital twin accuracy, please confirm this reading.
              </p>

              {/* Value Summary Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block font-mono">
                    Entered Measurement
                  </span>
                  <span className="text-base font-bold font-mono text-slate-900">
                    {suspiciousModal.value} {suspiciousModal.unit}
                  </span>
                </div>
                <div className="text-right text-[11px] text-slate-500 font-mono">
                  <div>Patient: {suspiciousModal.patientId}</div>
                  <div>{new Date(suspiciousModal.timestamp).toLocaleTimeString()}</div>
                </div>
              </div>

              {/* Warnings List */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 block">
                  Quality Warnings:
                </span>
                {suspiciousModal.warnings.map((w, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>

              {/* Typo Suggestion if Available */}
              {suspiciousModal.suggestedCorrection && (
                <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-950 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold block">Possible digit transposition detected?</span>
                    <span className="text-[11px] text-teal-800">
                      Did you mean to enter <strong>{suspiciousModal.suggestedCorrection} {suspiciousModal.unit}</strong>?
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setValue(String(suspiciousModal.suggestedCorrection));
                      setSuspiciousModal(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shrink-0 transition-colors"
                  >
                    Use {suspiciousModal.suggestedCorrection}
                  </button>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500 italic">
                Saved with validation_status="confirmed_unusual"
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSuspiciousModal(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors"
                >
                  Edit Measurement
                </button>

                <button
                  type="button"
                  onClick={handleConfirmSuspiciousValue}
                  disabled={isConfirmingUnusual}
                  className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5"
                >
                  {isConfirmingUnusual ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Confirming...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm & Record As Is</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

