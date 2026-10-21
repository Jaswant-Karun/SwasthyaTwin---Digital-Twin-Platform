import React, { useState, useEffect } from 'react';
import { useTwin } from '../../context/TwinContext';
import {
  Observation,
  DataClassification,
  CSVValidationResult,
  CSVValidationRow
} from '../../types';
import { api } from '../../services/api';
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
    min: 30,
    max: 220,
    step: 1,
    placeholder: 'e.g. 68',
    help: 'Normal adult resting range: 50-90 bpm.'
  },
  {
    type: 'systolic_blood_pressure',
    label: 'Systolic Blood Pressure',
    defaultUnit: 'mmHg',
    allowedUnits: ['mmHg'],
    min: 60,
    max: 260,
    step: 1,
    placeholder: 'e.g. 120',
    help: 'Normal adult resting range: 90-129 mmHg.'
  },
  {
    type: 'diastolic_blood_pressure',
    label: 'Diastolic Blood Pressure',
    defaultUnit: 'mmHg',
    allowedUnits: ['mmHg'],
    min: 40,
    max: 160,
    step: 1,
    placeholder: 'e.g. 80',
    help: 'Normal adult resting range: 60-84 mmHg.'
  },
  {
    type: 'sleep_duration',
    label: 'Sleep Duration',
    defaultUnit: 'hours',
    allowedUnits: ['hours', 'hrs', 'h'],
    min: 0,
    max: 24,
    step: 0.1,
    placeholder: 'e.g. 7.5',
    help: 'Normal nightly duration: 6-9 hours.'
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
    min: 4,
    max: 60,
    step: 1,
    placeholder: 'e.g. 15',
    help: 'Normal resting breathing rate: 12-20 breaths/min.'
  },
  {
    type: 'hrv_rmssd',
    label: 'HRV (RMSSD)',
    defaultUnit: 'ms',
    allowedUnits: ['ms'],
    min: 5,
    max: 250,
    step: 1,
    placeholder: 'e.g. 42',
    help: 'Heart rate variability parasympathetic marker.'
  },
  {
    type: 'blood_glucose',
    label: 'Fasting Blood Glucose',
    defaultUnit: 'mg/dL',
    allowedUnits: ['mg/dL', 'mmol/L'],
    min: 30,
    max: 600,
    step: 1,
    placeholder: 'e.g. 95',
    help: 'Normal fasting range: 70-99 mg/dL (or ~4.0-5.5 mmol/L).'
  },
  {
    type: 'oxygen_saturation',
    label: 'Oxygen Saturation (SpO2)',
    defaultUnit: '%',
    allowedUnits: ['%'],
    min: 70,
    max: 100,
    step: 1,
    placeholder: 'e.g. 98',
    help: 'Normal room-air pulse oximetry: 95-100%.'
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
    'single' | 'lifestyle' | 'csv' | 'history'
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

  // Lifestyle Log Form State
  const [lifestyleSleep, setLifestyleSleep] = useState('7.5');
  const [lifestyleSteps, setLifestyleSteps] = useState('8000');
  const [lifestyleActivity, setLifestyleActivity] = useState('moderate');
  const [lifestyleNotes, setLifestyleNotes] = useState('');
  const [isLifestyleSubmitting, setIsLifestyleSubmitting] = useState(false);
  const [lifestyleSuccessMsg, setLifestyleSuccessMsg] = useState<string | null>(null);
  const [lifestyleError, setLifestyleError] = useState<string | null>(null);

  // CSV Import State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState('');
  const [validationResult, setValidationResult] =
    useState<CSVValidationResult | null>(null);
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
  }, [activeSubTab, selectedPatientId]);

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

      const saved = await logObservation(payload);
      if (saved) {
        setSingleSuccess(saved);
        setValue('');
        setNotes('');
        // Reload history if on that tab
        if (activeSubTab === 'history') {
          loadHistory();
        }
      }
    } catch (err: any) {
      setSingleError(err.message || 'Failed to persist observation to MongoDB.');
    } finally {
      setIsSingleSubmitting(false);
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
      const mTypeIdx = headers.indexOf('metric_type');
      const valIdx = headers.indexOf('value');
      const unitIdx = headers.indexOf('unit');
      const timeIdx = headers.indexOf('timestamp');
      const srcIdx = headers.indexOf('source');
      const notesIdx = headers.indexOf('notes');

      if (valIdx === -1 || mTypeIdx === -1) {
        setCsvError('CSV must include at least "metric_type" and "value" columns.');
        setIsValidatingCsv(false);
        return;
      }

      const parsedRows = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        if (cols.length < 2) continue;

        parsedRows.push({
          patient_id: pIdIdx !== -1 && cols[pIdIdx] ? cols[pIdIdx] : selectedPatientId,
          metric_type: cols[mTypeIdx] || '',
          value: parseFloat(cols[valIdx]),
          unit: unitIdx !== -1 && cols[unitIdx] ? cols[unitIdx] : '',
          timestamp: timeIdx !== -1 && cols[timeIdx] ? cols[timeIdx] : new Date().toISOString(),
          source: srcIdx !== -1 && cols[srcIdx] ? cols[srcIdx] : 'wearable_csv_import',
          notes: notesIdx !== -1 && cols[notesIdx] ? cols[notesIdx] : undefined
        });
      }

      const result = await validateCSV(parsedRows);
      setValidationResult(result);
    } catch (err: any) {
      setCsvError(err.message || 'Failed to validate CSV with backend engine.');
    } finally {
      setIsValidatingCsv(false);
    }
  };

  const handleImportCsv = async () => {
    if (!validationResult || validationResult.valid_rows === 0) return;
    setIsImportingCsv(true);
    setCsvError(null);
    setCsvSuccessMsg(null);
    try {
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
      setValidationResult(null);
      setCsvFile(null);
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
      <div className="flex border-b border-slate-200 space-x-1 sm:space-x-4">
        {[
          { id: 'single', label: 'Single Observation', icon: PlusCircle },
          { id: 'lifestyle', label: 'Daily Lifestyle Log', icon: Calendar },
          { id: 'csv', label: 'Wearable CSV Import', icon: FileSpreadsheet },
          { id: 'history', label: 'Data History & Corrections', icon: Clock }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-2 py-3 px-3 sm:px-4 text-xs font-semibold border-b-2 transition-all ${
                isActive
                  ? 'border-teal-600 text-teal-700 bg-teal-50/30'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-teal-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

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
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 text-xs text-slate-900 font-mono"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Valid bounds: {currentMeta.min} – {currentMeta.max} {unit}
                  </span>
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

          {validationResult && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-4">
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    CSV Pre-Import Verification
                  </span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                    Total: {validationResult.total_rows} rows
                  </span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                    Valid: {validationResult.valid_rows}
                  </span>
                  {validationResult.invalid_rows > 0 && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-800">
                      Invalid: {validationResult.invalid_rows}
                    </span>
                  )}
                  {validationResult.duplicate_rows > 0 && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800">
                      Duplicates: {validationResult.duplicate_rows}
                    </span>
                  )}
                </div>

                <button
                  onClick={handleImportCsv}
                  disabled={isImportingCsv || validationResult.valid_rows === 0}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white text-xs font-bold transition-colors"
                >
                  {isImportingCsv ? 'Importing...' : `Confirm Import of ${validationResult.valid_rows - validationResult.duplicate_rows} Rows`}
                </button>
              </div>

              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[11px] sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-2.5">Row</th>
                      <th className="px-4 py-2.5">Patient</th>
                      <th className="px-4 py-2.5">Metric Type</th>
                      <th className="px-4 py-2.5">Value & Unit</th>
                      <th className="px-4 py-2.5">Timestamp</th>
                      <th className="px-4 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {validationResult.rows.map(r => (
                      <tr
                        key={r.row_index}
                        className={!r.is_valid ? 'bg-rose-50/50' : r.is_duplicate ? 'bg-amber-50/40' : ''}
                      >
                        <td className="px-4 py-2 font-mono text-slate-500">#{r.row_index}</td>
                        <td className="px-4 py-2 font-mono">{r.patient_id}</td>
                        <td className="px-4 py-2 font-medium text-slate-900">{r.metric_type}</td>
                        <td className="px-4 py-2 font-mono font-bold text-slate-900">
                          {r.value} {r.unit}
                        </td>
                        <td className="px-4 py-2 text-slate-500 text-[11px]">
                          {new Date(r.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-2">
                          {!r.is_valid ? (
                            <span className="text-rose-600 font-semibold text-[11px] flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 inline" />
                              {r.errors.join('; ')}
                            </span>
                          ) : r.is_duplicate ? (
                            <span className="text-amber-700 font-semibold text-[11px]">
                              Duplicate timestamp
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-semibold text-[11px] flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 inline" />
                              Valid for import
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                    <th className="px-5 py-3">Classification</th>
                    <th className="px-5 py-3">Source</th>
                    <th className="px-5 py-3">Notes</th>
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
                          </td>
                          <td className="px-5 py-3">
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
                          </td>
                          <td className="px-5 py-3 text-slate-500 font-mono text-[11px]">
                            {obs.source}
                          </td>
                          <td className="px-5 py-3 text-slate-500 truncate max-w-xs">
                            {obs.notes || '—'}
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
    </div>
  );
};
