import React, { useState, useEffect } from 'react';
import {
  Clock,
  PlusCircle,
  Activity,
  Heart,
  Moon,
  Footprints,
  Calendar,
  Filter,
  CheckCircle2,
  AlertCircle,
  Wind,
  Sparkles,
  Brain,
  ShieldCheck,
  ChevronRight,
  Info,
  Layers,
  BarChart2,
  Sliders,
  X,
  ExternalLink,
  Zap,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { useTwin } from '../../context/TwinContext';
import { api } from '../../services/api';
import {
  MultiSignalTimelineItem,
  MultiSignalTimelineResponse
} from '../../types';

// 5-Stage AASM Color Palettes
const STAGE_THEMES: Record<string, { bg: string; text: string; border: string; glow: string; barColor: string }> = {
  N3: {
    bg: 'bg-amber-950/40',
    text: 'text-amber-300',
    border: 'border-amber-500/40',
    glow: 'shadow-amber-500/10',
    barColor: 'bg-amber-400'
  },
  REM: {
    bg: 'bg-purple-950/40',
    text: 'text-purple-300',
    border: 'border-purple-500/40',
    glow: 'shadow-purple-500/10',
    barColor: 'bg-purple-400'
  },
  N2: {
    bg: 'bg-emerald-950/40',
    text: 'text-emerald-300',
    border: 'border-emerald-500/40',
    glow: 'shadow-emerald-500/10',
    barColor: 'bg-emerald-400'
  },
  N1: {
    bg: 'bg-indigo-950/40',
    text: 'text-indigo-300',
    border: 'border-indigo-500/40',
    glow: 'shadow-indigo-500/10',
    barColor: 'bg-indigo-400'
  },
  Wake: {
    bg: 'bg-sky-950/40',
    text: 'text-sky-300',
    border: 'border-sky-500/40',
    glow: 'shadow-sky-500/10',
    barColor: 'bg-sky-400'
  }
};

const STAGE_DISPLAY_NAMES: Record<string, string> = {
  Wake: 'Stage Wake (Awake / Arousal)',
  N1: 'Stage N1 (Light Transitional Sleep)',
  N2: 'Stage N2 (Stable Light Sleep)',
  N3: 'Stage N3 (Deep Slow-Wave Sleep)',
  REM: 'Stage REM (Rapid Eye Movement / Dreaming)'
};

export const PatientTimeline: React.FC = () => {
  const { currentPatient, logObservation, newlyAddedObservationId } = useTwin();
  const [timelineData, setTimelineData] = useState<MultiSignalTimelineResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [signalFilter, setSignalFilter] = useState<'all' | 'sleep' | 'cardio' | 'observations'>('all');

  // Inspection Modal State
  const [inspectedItem, setInspectedItem] = useState<MultiSignalTimelineItem | null>(null);

  // Form State
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [newMetric, setNewMetric] = useState<string>('heart_rate');
  const [newValue, setNewValue] = useState<string>('72');
  const [newUnit, setNewUnit] = useState<string>('bpm');
  const [newSource, setNewSource] = useState<string>('manual_entry');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [confirmationMsg, setConfirmationMsg] = useState<string | null>(null);

  const fetchReqIdRef = React.useRef<number>(0);

  const fetchMultiSignalTimeline = async () => {
    if (!currentPatient) return;
    const currentReq = ++fetchReqIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getMultiSignalTimeline(currentPatient.patient_id, {
        signal_filter: signalFilter,
        limit: 150
      });
      if (currentReq === fetchReqIdRef.current) {
        setTimelineData(res);
      }
    } catch (err: any) {
      if (currentReq === fetchReqIdRef.current) {
        console.error('Error fetching multi-signal timeline:', err);
        setError(err.message || 'Failed to load multi-signal health timeline.');
      }
    } finally {
      if (currentReq === fetchReqIdRef.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchMultiSignalTimeline();
  }, [currentPatient?.patient_id, signalFilter]);

  // Metric-specific default units and validation rules
  const validateValue = (metric: string, valStr: string): string | null => {
    const val = parseFloat(valStr);
    if (isNaN(val)) return 'Please enter a valid number';
    switch (metric) {
      case 'heart_rate':
        if (val < 30 || val > 240) return 'Heart rate must be between 30 and 240 bpm';
        break;
      case 'blood_pressure_systolic':
        if (val < 60 || val > 260) return 'Systolic BP must be between 60 and 260 mmHg';
        break;
      case 'respiratory_rate':
        if (val < 6 || val > 60) return 'Respiratory rate must be between 6 and 60 breaths/min';
        break;
      case 'sleep_duration_hours':
        if (val < 0 || val > 24) return 'Sleep duration must be between 0 and 24 hours';
        break;
      case 'daily_steps':
        if (val < 0 || val > 100000) return 'Daily steps must be between 0 and 100,000';
        break;
      case 'hrv_rmssd':
        if (val < 5 || val > 300) return 'HRV RMSSD must be between 5 and 300 ms';
        break;
      case 'fasting_blood_glucose':
        if (val < 30 || val > 600) return 'Blood glucose must be between 30 and 600 mg/dL';
        break;
    }
    return null;
  };

  const handleMetricChange = (metric: string) => {
    setNewMetric(metric);
    let defaultVal = '72';
    let defaultUnit = 'bpm';
    if (metric === 'heart_rate') { defaultVal = '72'; defaultUnit = 'bpm'; }
    else if (metric === 'blood_pressure_systolic') { defaultVal = '122'; defaultUnit = 'mmHg'; }
    else if (metric === 'respiratory_rate') { defaultVal = '16'; defaultUnit = 'breaths/min'; }
    else if (metric === 'sleep_duration_hours') { defaultVal = '7.5'; defaultUnit = 'hours'; }
    else if (metric === 'daily_steps') { defaultVal = '8500'; defaultUnit = 'steps'; }
    else if (metric === 'hrv_rmssd') { defaultVal = '45'; defaultUnit = 'ms'; }
    else if (metric === 'fasting_blood_glucose') { defaultVal = '95'; defaultUnit = 'mg/dL'; }

    setNewValue(defaultVal);
    setNewUnit(defaultUnit);
    setValidationError(validateValue(metric, defaultVal));
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewValue(val);
    setValidationError(validateValue(newMetric, val));
  };

  const handleAddObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPatient) return;

    const error = validateValue(newMetric, newValue);
    if (error) {
      setValidationError(error);
      return;
    }

    setIsSubmitting(true);
    setConfirmationMsg(null);
    try {
      await logObservation({
        patient_id: currentPatient.patient_id,
        timestamp: new Date().toISOString(),
        metric_type: newMetric,
        value: parseFloat(newValue),
        unit: newUnit,
        source: newSource,
        data_tier: newSource.includes('manual') ? 'user_reported' : 'measured'
      });

      setIsAdding(false);
      setConfirmationMsg(
        `Recorded ${newMetric.replace(/_/g, ' ')} (${newValue} ${newUnit}). Synchronized to digital twin.`
      );
      setTimeout(() => setConfirmationMsg(null), 5000);
      await fetchMultiSignalTimeline();
    } catch (err: any) {
      console.error('Failed to log observation:', err);
      setValidationError(err.message || 'Failed to save observation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMetricIcon = (type: string, signalType: string) => {
    if (signalType === 'sleep_stage_prediction') {
      return <Moon className="w-4 h-4 text-purple-400" />;
    }
    if (signalType === 'heart_rate_statistical_flag') {
      return <Heart className="w-4 h-4 text-rose-400" />;
    }
    if (type.includes('step')) return <Footprints className="w-4 h-4 text-emerald-400" />;
    if (type.includes('respiratory')) return <Wind className="w-4 h-4 text-sky-400" />;
    return <Activity className="w-4 h-4 text-teal-400" />;
  };

  const items = timelineData?.items || [];
  const summary = timelineData?.summary;
  const sleepSummary = summary?.sleep_intelligence;
  const cardioSummary = summary?.cardiovascular_intelligence;
  const crossSignal = summary?.cross_signal_insight;

  return (
    <div className="space-y-6">
      {/* 1. Header & Context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-mono text-[11px] font-bold">
              GENUINE MULTI-SIGNAL HEALTH INTELLIGENCE
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono text-[10px]">
              PATIENT: {currentPatient?.patient_id}
            </span>
          </div>
          <h2 className="text-xl font-extrabold text-white mt-1.5 flex items-center gap-2 tracking-tight">
            <Layers className="w-5 h-5 text-teal-400" />
            Synchronized Patient Timeline
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
            Co-registers authentic <strong className="text-purple-300">BiDSleep ML Wearable Sleep Stages</strong> with personalized <strong className="text-rose-300">nMAD Cardiovascular Anomaly Intelligence</strong> and raw physiological records.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-teal-500/20 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{isAdding ? 'Close Entry Form' : 'Log Measurement'}</span>
          </button>
        </div>
      </div>

      {/* Confirmation Banner */}
      {confirmationMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between shadow-lg animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{confirmationMsg}</span>
          </div>
          <button
            onClick={() => setConfirmationMsg(null)}
            className="text-emerald-400 hover:text-emerald-300 text-xs font-mono px-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Multi-Signal Dual Intelligence Executive Board */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Signal A: BiDSleep Sleep-Stage ML Intelligence */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-950/30 via-slate-900/90 to-slate-900/90 border border-purple-500/30 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300">
                <Moon className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-mono font-bold text-purple-200 uppercase tracking-wider">
                  Signal A: BiDSleep Wearable Sleep ML
                </h3>
                <p className="text-[11px] text-slate-400 font-sans">
                  Supervised 5-stage AASM classification from 30s optical PPG
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300 border border-purple-500/30 text-[10px] font-mono font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              ONLINE
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-3.5">
            <div className="p-2.5 rounded-xl bg-slate-950/50 border border-white/5">
              <span className="text-[10px] font-mono text-slate-400 block">Deep Sleep (N3)</span>
              <span className="text-base font-extrabold font-mono text-amber-300">
                {sleepSummary?.deep_sleep_ratio_pct ?? 0}%
              </span>
              <span className="text-[10px] text-slate-500 block">Slow-wave nadir</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/50 border border-white/5">
              <span className="text-[10px] font-mono text-slate-400 block">REM Ratio</span>
              <span className="text-base font-extrabold font-mono text-purple-300">
                {sleepSummary?.rem_sleep_ratio_pct ?? 0}%
              </span>
              <span className="text-[10px] text-slate-500 block">Dream architecture</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/50 border border-white/5">
              <span className="text-[10px] font-mono text-slate-400 block">Mean Confidence</span>
              <span className="text-base font-extrabold font-mono text-cyan-300">
                {sleepSummary?.average_confidence_pct ?? 0}%
              </span>
              <span className="text-[10px] text-slate-500 block">Softmax certainty</span>
            </div>
          </div>

          {/* Stage Distribution Bar */}
          {sleepSummary?.stage_distribution_pct && (
            <div className="mt-3.5 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Stage Breakdown:</span>
                <span className="text-slate-300">
                  N3: {sleepSummary.stage_distribution_pct.N3}% • REM: {sleepSummary.stage_distribution_pct.REM}% • N2: {sleepSummary.stage_distribution_pct.N2}% • Wake: {sleepSummary.stage_distribution_pct.Wake}%
                </span>
              </div>
              <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden flex border border-white/10">
                <div style={{ width: `${sleepSummary.stage_distribution_pct.N3}%` }} className="bg-amber-400" title="Stage N3" />
                <div style={{ width: `${sleepSummary.stage_distribution_pct.REM}%` }} className="bg-purple-400" title="Stage REM" />
                <div style={{ width: `${sleepSummary.stage_distribution_pct.N2}%` }} className="bg-emerald-400" title="Stage N2" />
                <div style={{ width: `${sleepSummary.stage_distribution_pct.N1}%` }} className="bg-indigo-400" title="Stage N1" />
                <div style={{ width: `${sleepSummary.stage_distribution_pct.Wake}%` }} className="bg-sky-400" title="Stage Wake" />
              </div>
            </div>
          )}

          <div className="mt-3 pt-2.5 border-t border-purple-500/20 text-[10px] text-purple-300/80 font-mono flex items-center justify-between">
            <span>Model: {sleepSummary?.model_name || 'BiDSleep LightGBM'}</span>
            <span className="text-slate-500">Non-Diagnostic Research ML</span>
          </div>
        </div>

        {/* Signal B: Cardiovascular nMAD Statistical Anomaly Intelligence */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-rose-950/30 via-slate-900/90 to-slate-900/90 border border-rose-500/30 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between border-b border-rose-500/20 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-300">
                <Heart className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-mono font-bold text-rose-200 uppercase tracking-wider">
                  Signal B: Cardiovascular nMAD Engine
                </h3>
                <p className="text-[11px] text-slate-400 font-sans">
                  Zero-leakage sliding 30-day non-parametric median & 2×nMAD tolerance corridor
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-300 border border-rose-500/30 text-[10px] font-mono font-bold">
              v1.2.0-ROBUST-MAD
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-3.5">
            <div className="p-2.5 rounded-xl bg-slate-950/50 border border-white/5">
              <span className="text-[10px] font-mono text-slate-400 block">Personal Median</span>
              <span className="text-base font-extrabold font-mono text-white">
                {cardioSummary?.baseline_median_bpm ?? '--'} <span className="text-xs font-normal text-slate-400">bpm</span>
              </span>
              <span className="text-[10px] text-slate-500 block">30d sliding reference</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/50 border border-white/5">
              <span className="text-[10px] font-mono text-slate-400 block">nMAD Corridor</span>
              <span className="text-base font-extrabold font-mono text-teal-300">
                {cardioSummary?.lower_corridor_bpm ?? '--'} - {cardioSummary?.upper_corridor_bpm ?? '--'}
              </span>
              <span className="text-[10px] text-slate-500 block">±2.0× normalized MAD</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-950/50 border border-white/5">
              <span className="text-[10px] font-mono text-slate-400 block">Flagged Deviations</span>
              <span className={`text-base font-extrabold font-mono ${
                (cardioSummary?.flagged_anomalies_count || 0) > 0 ? 'text-rose-400' : 'text-emerald-400'
              }`}>
                {cardioSummary?.flagged_anomalies_count ?? 0}
                <span className="text-xs font-normal text-slate-400 ml-1">({cardioSummary?.flagged_rate_pct ?? 0}%)</span>
              </span>
              <span className="text-[10px] text-slate-500 block">Statistical excursions</span>
            </div>
          </div>

          {/* Cardiovascular Anomaly Notice */}
          <div className="mt-3.5 p-2 rounded-xl bg-slate-950/40 border border-white/5 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400 text-[11px]">Robust Dispersion (nMAD):</span>
            <span className="text-teal-400 font-bold">{cardioSummary?.n_mad_variability ?? '--'} bpm</span>
          </div>

          <div className="mt-3 pt-2.5 border-t border-rose-500/20 text-[10px] text-rose-300/80 font-mono flex items-center justify-between">
            <span>Evaluated Readings: {cardioSummary?.total_observations_analyzed ?? 0}</span>
            <span className="text-slate-500">Non-Diagnostic Statistical Engine</span>
          </div>
        </div>
      </div>

      {/* 3. Cross-Signal Biological Co-Registration Insight */}
      {crossSignal && (
        <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 flex items-start gap-3 shadow-sm">
          <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300 shrink-0 mt-0.5">
            <Brain className="w-4 h-4" />
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider">
                {crossSignal.title}
              </h4>
              <span className="text-[10px] text-cyan-400/80 font-mono">
                SYNCHRONIZED CO-REGISTRATION
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {crossSignal.finding}
            </p>
            <div className="pt-1 flex flex-wrap items-center gap-3 text-[11px] font-mono text-cyan-400/90">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-cyan-400" />
                {crossSignal.clinical_separation_guarantee}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Observation Entry Form Modal / Accordion */}
      {isAdding && (
        <form onSubmit={handleAddObservation} className="p-5 rounded-2xl bg-slate-900 border border-teal-500/30 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h4 className="text-xs font-bold text-teal-300 uppercase tracking-wider flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-teal-400" />
              Log Verified Physiological Observation
            </h4>
            <span className="text-[11px] text-slate-400 font-mono">
              Patient: {currentPatient?.patient_id}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-slate-300 block mb-1 font-semibold">Metric Type</label>
              <select
                value={newMetric}
                onChange={(e) => handleMetricChange(e.target.value)}
                className="w-full bg-slate-800 text-white text-xs rounded-lg px-2.5 py-2 border border-slate-700 font-medium focus:ring-1 focus:ring-teal-500"
              >
                <option value="heart_rate">Heart Rate (bpm)</option>
                <option value="blood_pressure_systolic">Systolic BP (mmHg)</option>
                <option value="respiratory_rate">Respiratory Rate (breaths/min)</option>
                <option value="sleep_duration_hours">Sleep Duration (hrs)</option>
                <option value="daily_steps">Daily Steps</option>
                <option value="hrv_rmssd">HRV RMSSD (ms)</option>
                <option value="fasting_blood_glucose">Blood Glucose (mg/dL)</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-300 block mb-1 font-semibold">Observed Value</label>
              <input
                type="number"
                step="any"
                value={newValue}
                onChange={handleValueChange}
                className={`w-full bg-slate-800 text-white text-xs rounded-lg px-2.5 py-2 border font-mono font-bold focus:outline-none ${
                  validationError ? 'border-rose-500 text-rose-300' : 'border-slate-700 text-teal-300'
                }`}
                required
              />
              {validationError && (
                <span className="text-[10px] text-rose-400 mt-1 block">
                  {validationError}
                </span>
              )}
            </div>

            <div>
              <label className="text-xs text-slate-300 block mb-1 font-semibold">Unit</label>
              <input
                type="text"
                value={newUnit}
                readOnly
                className="w-full bg-slate-800/60 text-slate-400 text-xs rounded-lg px-2.5 py-2 border border-slate-700/60 font-mono cursor-not-allowed"
              />
            </div>

            <div>
              <label className="text-xs text-slate-300 block mb-1 font-semibold">Data Provenance Source</label>
              <select
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                className="w-full bg-slate-800 text-white text-xs rounded-lg px-2.5 py-2 border border-slate-700 font-medium focus:ring-1 focus:ring-teal-500"
              >
                <option value="manual_entry">Patient Self-Report (User Tier)</option>
                <option value="clinical_lab">Clinical Lab Test (Measured Tier)</option>
                <option value="wearable_continuous">Wearable Sensor (Measured Tier)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <span className="text-[11px] text-slate-500">
              Saves persistently to MongoDB and triggers instant multi-signal timeline re-evaluation.
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !!validationError}
                className="px-4 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-teal-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Recording...' : 'Commit to Digital Twin'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* 4. Filter Switcher Rail */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setSignalFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all ${
              signalFilter === 'all'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800'
            }`}
          >
            All Multi-Signal Events ({timelineData?.total_items || 0})
          </button>

          <button
            onClick={() => setSignalFilter('sleep')}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
              signalFilter === 'sleep'
                ? 'bg-purple-500 text-slate-950 shadow-md shadow-purple-500/20'
                : 'text-purple-300 hover:text-white bg-purple-950/40 hover:bg-purple-900/40 border border-purple-500/30'
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
            <span>BiDSleep Sleep ML</span>
          </button>

          <button
            onClick={() => setSignalFilter('cardio')}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
              signalFilter === 'cardio'
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                : 'text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/40 border border-rose-500/30'
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            <span>Heart-Rate nMAD Flags</span>
          </button>

          <button
            onClick={() => setSignalFilter('observations')}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
              signalFilter === 'observations'
                ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                : 'text-teal-300 hover:text-white bg-teal-950/40 hover:bg-teal-900/40 border border-teal-500/30'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Telemetry Observations</span>
          </button>
        </div>

        <span className="text-[11px] font-mono text-slate-400 text-right">
          Displaying {items.length} chronological events
        </span>
      </div>

      {/* 5. Chronological Multi-Signal Timeline Items Stream */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="p-8 space-y-3 rounded-2xl bg-slate-900/60 border border-slate-800">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 bg-slate-800/40 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-rose-400 space-y-2 rounded-2xl bg-slate-900/60 border border-slate-800">
            <AlertCircle className="w-5 h-5 mx-auto" />
            <p>{error}</p>
            <button
              onClick={fetchMultiSignalTimeline}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-200 font-mono"
            >
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 rounded-2xl bg-slate-900/60 border border-slate-800">
            No events found matching the selected multi-signal filter.
          </div>
        ) : (
          items.map((item) => {
            const isNewlyAdded = item.id.includes(newlyAddedObservationId || '___none___');
            const isSleep = item.signal_type === 'sleep_stage_prediction';
            const isCardio = item.signal_type === 'heart_rate_statistical_flag';

            const stageTheme = isSleep && item.sleep_details
              ? STAGE_THEMES[item.sleep_details.stage_5class] || STAGE_THEMES.N2
              : null;

            return (
              <div
                key={item.id}
                onClick={() => setInspectedItem(item)}
                className={`p-4 rounded-2xl transition-all border cursor-pointer ${
                  isNewlyAdded
                    ? 'bg-teal-950/40 border-teal-400 shadow-md shadow-teal-500/20'
                    : isSleep
                    ? 'bg-slate-900/80 hover:bg-slate-900 border-purple-500/30 hover:border-purple-400/60 shadow-xs'
                    : isCardio
                    ? item.status_level === 'elevated' || item.status_level === 'low'
                      ? 'bg-slate-900/80 hover:bg-slate-900 border-rose-500/40 hover:border-rose-400/70 shadow-xs'
                      : 'bg-slate-900/80 hover:bg-slate-900 border-slate-800 hover:border-slate-700'
                    : 'bg-slate-900/60 hover:bg-slate-900/90 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left Column: Icon + Category Badge + Title & Summary */}
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                        isSleep
                          ? 'bg-purple-500/20 text-purple-300'
                          : isCardio
                          ? item.status_level === 'elevated' || item.status_level === 'low'
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-teal-500/20 text-teal-300'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {getMetricIcon(item.primary_metric || '', item.signal_type)}
                    </div>

                    <div className="space-y-1">
                      {/* Signal Category Badge */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold uppercase tracking-wider border ${
                            isSleep
                              ? 'bg-purple-950/60 text-purple-300 border-purple-500/40'
                              : isCardio
                              ? 'bg-rose-950/60 text-rose-300 border-rose-500/40'
                              : 'bg-slate-800 text-teal-300 border-slate-700'
                          }`}
                        >
                          {item.signal_badge}
                        </span>

                        <span className="text-[11px] font-mono text-slate-400">
                          {new Date(item.timestamp).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}{' '}
                          at{' '}
                          {new Date(item.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>

                        {isNewlyAdded && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-teal-400 text-slate-950 animate-pulse">
                            <Sparkles className="w-2.5 h-2.5" />
                            JUST INGESTED
                          </span>
                        )}
                      </div>

                      {/* Main Title */}
                      <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                        <span>{item.title}</span>
                      </h4>

                      {/* Summary explanation */}
                      <p className="text-xs text-slate-400 line-clamp-2">
                        {item.summary}
                      </p>
                    </div>
                  </div>

                  {/* Right Column: Status Pill & Metric Display */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 shrink-0 pl-11 sm:pl-0 border-t sm:border-t-0 border-slate-800 pt-2 sm:pt-0">
                    {/* Status Label */}
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border ${
                        isSleep && stageTheme
                          ? `${stageTheme.bg} ${stageTheme.text} ${stageTheme.border}`
                          : item.status_level === 'elevated'
                          ? 'bg-rose-950/60 text-rose-300 border-rose-500/40'
                          : item.status_level === 'low'
                          ? 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                          : item.status_level === 'review'
                          ? 'bg-orange-950/60 text-orange-300 border-orange-500/40'
                          : 'bg-slate-800/80 text-teal-300 border-slate-700'
                      }`}
                    >
                      {item.status_label}
                    </span>

                    {/* Numeric value / stage badge */}
                    <div className="text-right">
                      {isSleep && item.sleep_details ? (
                        <div className="text-right">
                          <span className="text-xs font-mono text-purple-300 font-bold block">
                            Confidence: {item.sleep_details.confidence_pct}%
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            PPG Optical HR: {item.sleep_details.ppg_features.hr_mean} bpm
                          </span>
                        </div>
                      ) : isCardio && item.cardiovascular_details ? (
                        <div className="text-right">
                          <span className="text-sm font-extrabold font-mono text-white">
                            {item.cardiovascular_details.measured_heart_rate} bpm
                          </span>
                          {item.cardiovascular_details.baseline_median && (
                            <span className="text-[10px] text-slate-400 font-mono block">
                              Median: {item.cardiovascular_details.baseline_median} bpm (Score:{' '}
                              {item.cardiovascular_details.robust_score !== null && item.cardiovascular_details.robust_score !== undefined
                                ? (item.cardiovascular_details.robust_score > 0 ? `+${item.cardiovascular_details.robust_score}` : item.cardiovascular_details.robust_score)
                                : '--'}
                              )
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="text-right">
                          <span className="text-sm font-extrabold font-mono text-white">
                            {item.primary_value} <span className="text-xs text-slate-400 font-normal">{item.primary_unit}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Micro Footer Notice */}
                <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span className="truncate max-w-xl">{item.disclaimer}</span>
                  <span className="text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 shrink-0 ml-2">
                    Inspect Audit <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 6. Deep Audit Inspection Modal */}
      {inspectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl p-6 overflow-hidden max-h-[90vh] flex flex-col">
            <button
              onClick={() => setInspectedItem(null)}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span
                className={`px-2.5 py-0.5 rounded-md font-mono text-[10px] font-bold uppercase tracking-wider border ${
                  inspectedItem.signal_type === 'sleep_stage_prediction'
                    ? 'bg-purple-950/80 text-purple-300 border-purple-500/40'
                    : inspectedItem.signal_type === 'heart_rate_statistical_flag'
                    ? 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                    : 'bg-slate-800 text-teal-300 border-slate-700'
                }`}
              >
                {inspectedItem.signal_badge}
              </span>
              <span className="text-xs font-mono text-slate-400">
                Audit Event ID: {inspectedItem.id}
              </span>
            </div>

            <h3 className="text-lg font-bold text-white tracking-tight">
              {inspectedItem.title}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {inspectedItem.summary}
            </p>

            <div className="my-4 border-t border-slate-800" />

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Modality A: BiDSleep Sleep ML Breakdown */}
              {inspectedItem.signal_type === 'sleep_stage_prediction' && inspectedItem.sleep_details && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-500/30 space-y-2">
                    <h4 className="text-xs font-mono font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Brain className="w-3.5 h-3.5" />
                      BiDSleep 5-Stage AASM Softmax Probabilities
                    </h4>
                    <div className="space-y-2 pt-1">
                      {Object.entries(inspectedItem.sleep_details.probabilities).map(([stage, prob]) => {
                        const pct = Math.round(prob * 100);
                        const isPred = stage === inspectedItem.sleep_details?.stage_5class;
                        return (
                          <div key={stage} className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-mono">
                              <span className={isPred ? 'font-bold text-purple-300' : 'text-slate-400'}>
                                {stage} ({STAGE_DISPLAY_NAMES[stage] || stage})
                              </span>
                              <span className={isPred ? 'font-bold text-purple-300' : 'text-slate-400'}>
                                {pct}%
                              </span>
                            </div>
                            <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-white/5">
                              <div
                                style={{ width: `${pct}%` }}
                                className={`h-full ${isPred ? 'bg-purple-400' : 'bg-slate-700'}`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Feature Vector Chips */}
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                    <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                      Input 30-Second Wearable Optical Features
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                      {Object.entries(inspectedItem.sleep_details.ppg_features).map(([k, v]) => (
                        <div key={k} className="p-2 rounded-lg bg-slate-900 border border-white/5">
                          <span className="text-[10px] font-mono text-slate-400 block">{k}</span>
                          <span className="text-xs font-mono font-bold text-teal-300">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
                    <p><strong className="text-slate-300">Architecture:</strong> {inspectedItem.sleep_details.model_architecture}</p>
                    <p><strong className="text-slate-300">Model:</strong> {inspectedItem.sleep_details.model_name}</p>
                    <p><strong className="text-slate-300">Telemetry Source:</strong> {inspectedItem.sleep_details.inference_source}</p>
                  </div>
                </div>
              )}

              {/* Modality B: Cardiovascular nMAD Breakdown */}
              {inspectedItem.signal_type === 'heart_rate_statistical_flag' && inspectedItem.cardiovascular_details && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-500/30 space-y-3">
                    <h4 className="text-xs font-mono font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5" />
                      nMAD Mathematical Anomaly Calculation
                    </h4>
                    
                    <div className="p-3 rounded-lg bg-slate-950 font-mono text-xs text-rose-200 border border-rose-500/20">
                      <code>Score = (Reading - Median) / (1.4826 × MAD)</code>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <div className="p-2 rounded-lg bg-slate-900 border border-white/5">
                        <span className="text-[10px] font-mono text-slate-400 block">Measured HR</span>
                        <span className="text-sm font-bold font-mono text-white">
                          {inspectedItem.cardiovascular_details.measured_heart_rate} bpm
                        </span>
                      </div>

                      <div className="p-2 rounded-lg bg-slate-900 border border-white/5">
                        <span className="text-[10px] font-mono text-slate-400 block">Baseline Median</span>
                        <span className="text-sm font-bold font-mono text-teal-300">
                          {inspectedItem.cardiovascular_details.baseline_median} bpm
                        </span>
                      </div>

                      <div className="p-2 rounded-lg bg-slate-900 border border-white/5">
                        <span className="text-[10px] font-mono text-slate-400 block">nMAD Dispersion</span>
                        <span className="text-sm font-bold font-mono text-teal-300">
                          {inspectedItem.cardiovascular_details.variability_value} bpm
                        </span>
                      </div>

                      <div className="p-2 rounded-lg bg-slate-900 border border-white/5">
                        <span className="text-[10px] font-mono text-slate-400 block">Corridor Bounds</span>
                        <span className="text-xs font-bold font-mono text-slate-200">
                          [{inspectedItem.cardiovascular_details.lower_corridor} - {inspectedItem.cardiovascular_details.upper_corridor}]
                        </span>
                      </div>

                      <div className="p-2 rounded-lg bg-slate-900 border border-white/5">
                        <span className="text-[10px] font-mono text-slate-400 block">Robust Z-Score</span>
                        <span className={`text-sm font-bold font-mono ${
                          (inspectedItem.cardiovascular_details.robust_score || 0) > 2.5 || (inspectedItem.cardiovascular_details.robust_score || 0) < -2.5
                            ? 'text-rose-400'
                            : 'text-emerald-400'
                        }`}>
                          {inspectedItem.cardiovascular_details.robust_score !== null && inspectedItem.cardiovascular_details.robust_score !== undefined
                            ? (inspectedItem.cardiovascular_details.robust_score > 0 ? `+${inspectedItem.cardiovascular_details.robust_score}` : inspectedItem.cardiovascular_details.robust_score)
                            : '--'}
                        </span>
                      </div>

                      <div className="p-2 rounded-lg bg-slate-900 border border-white/5">
                        <span className="text-[10px] font-mono text-slate-400 block">Sample Window</span>
                        <span className="text-xs font-bold font-mono text-slate-200">
                          {inspectedItem.cardiovascular_details.sample_count} samples ({inspectedItem.cardiovascular_details.window_days}d)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
                    <p><strong className="text-slate-300">Algorithm:</strong> {inspectedItem.cardiovascular_details.algorithm_version}</p>
                    <p><strong className="text-slate-300">Status Classification:</strong> {inspectedItem.cardiovascular_details.anomaly_status}</p>
                  </div>
                </div>
              )}

              {/* Modality C: Physiological Observation */}
              {inspectedItem.signal_type === 'physiological_observation' && inspectedItem.observation_details && (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <h4 className="text-xs font-mono font-bold text-teal-300 uppercase tracking-wider">
                    Ingested Provenance Telemetry
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 rounded-lg bg-slate-900 border border-white/5">
                      <span className="text-[10px] text-slate-400 block">Measurement</span>
                      <span className="text-white font-bold">{inspectedItem.observation_details.metric_type}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900 border border-white/5">
                      <span className="text-[10px] text-slate-400 block">Value</span>
                      <span className="text-white font-bold">{inspectedItem.observation_details.value} {inspectedItem.observation_details.unit}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900 border border-white/5">
                      <span className="text-[10px] text-slate-400 block">Source</span>
                      <span className="text-slate-300 font-bold">{inspectedItem.observation_details.source_type}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900 border border-white/5">
                      <span className="text-[10px] text-slate-400 block">Data Tier</span>
                      <span className="text-teal-300 font-bold uppercase">{inspectedItem.observation_details.data_tier}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Research Disclaimer Box */}
              <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-200/90 leading-relaxed font-sans">
                  <strong>Clinical & Research Notice:</strong> {inspectedItem.disclaimer}
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setInspectedItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold transition-colors"
              >
                Close Audit Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
