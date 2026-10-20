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
  Sparkles
} from 'lucide-react';
import { useTwin } from '../../context/TwinContext';
import { api } from '../../services/api';
import { Observation } from '../../types';

export const PatientTimeline: React.FC = () => {
  const { currentPatient, logObservation, newlyAddedObservationId } = useTwin();
  const [observations, setObservations] = useState<Observation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [metricFilter, setMetricFilter] = useState<string>('all');

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

  const fetchObservations = async () => {
    if (!currentPatient) return;
    const currentReq = ++fetchReqIdRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getObservations(currentPatient.patient_id, {
        metric_type: metricFilter !== 'all' ? metricFilter : undefined,
        limit: 150
      });
      if (currentReq === fetchReqIdRef.current) {
        // Chronological sort: newest first for timeline audit
        const sorted = [...res.items].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setObservations(sorted);
      }
    } catch (err: any) {
      if (currentReq === fetchReqIdRef.current) {
        console.error('Error fetching observations for timeline:', err);
        setError(err.message || 'Failed to load observation history.');
      }
    } finally {
      if (currentReq === fetchReqIdRef.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchObservations();
  }, [currentPatient?.patient_id, metricFilter]);

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
      const created = await logObservation({
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
        `Recorded ${newMetric.replace(/_/g, ' ')} (${newValue} ${newUnit}). Digital twin updated.`
      );
      setTimeout(() => setConfirmationMsg(null), 5000);
      await fetchObservations();
    } catch (err: any) {
      console.error('Failed to log observation:', err);
      setValidationError(err.message || 'Failed to save observation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMetricIcon = (metric: string) => {
    if (metric.includes('heart')) return <Heart className="w-3.5 h-3.5 text-rose-400" />;
    if (metric.includes('sleep')) return <Moon className="w-3.5 h-3.5 text-cyan-400" />;
    if (metric.includes('step')) return <Footprints className="w-3.5 h-3.5 text-emerald-400" />;
    if (metric.includes('respiratory')) return <Wind className="w-3.5 h-3.5 text-sky-400" />;
    return <Activity className="w-3.5 h-3.5 text-teal-400" />;
  };

  return (
    <div className="space-y-5">
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

      {/* Timeline Controls & Add Entry Button */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-teal-400" />
            Longitudinal Observation Timeline
          </h3>
          <p className="text-xs text-slate-400">
            Chronological audit stream of wearable biometrics, clinical assays, and manual journals for {currentPatient?.full_name}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={metricFilter}
            onChange={(e) => setMetricFilter(e.target.value)}
            className="bg-slate-800 text-white text-xs rounded-lg px-2.5 py-1.5 border border-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium"
          >
            <option value="all">All Metrics</option>
            <option value="heart_rate">Resting Heart Rate</option>
            <option value="blood_pressure_systolic">Blood Pressure</option>
            <option value="respiratory_rate">Respiratory Rate</option>
            <option value="hrv_rmssd">Heart Rate Variability</option>
            <option value="sleep_duration_hours">Sleep Duration</option>
            <option value="daily_steps">Daily Activity</option>
            <option value="fasting_blood_glucose">Blood Glucose</option>
          </select>

          <button
            onClick={() => setIsAdding(!isAdding)}
            className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-teal-500/20"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            {isAdding ? 'Close Form' : 'Log Measurement'}
          </button>
        </div>
      </div>

      {/* Observation Entry Form Modal / Accordion */}
      {isAdding && (
        <form onSubmit={handleAddObservation} className="p-5 rounded-2xl bg-slate-900 border border-teal-500/30 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h4 className="text-xs font-bold text-teal-300 uppercase tracking-wider">
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
              Saves persistently to MongoDB and triggers instant digital twin re-assessment.
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

      {/* Observation Items */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 divide-y divide-slate-800/80">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 bg-slate-800/40 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center text-xs text-rose-400 space-y-2">
            <AlertCircle className="w-5 h-5 mx-auto" />
            <p>{error}</p>
            <button
              onClick={fetchObservations}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-200"
            >
              Retry
            </button>
          </div>
        ) : observations.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No telemetry records found matching the selected filter.
          </div>
        ) : (
          observations.slice(0, 60).map((obs) => {
            const obsId = obs._id || (obs as any).observation_id;
            const isNewlyAdded =
              obsId === newlyAddedObservationId ||
              obs.source?.includes('live');

            return (
              <div
                key={obsId}
                className={`p-4 flex items-center justify-between transition-colors text-xs ${
                  isNewlyAdded
                    ? 'bg-teal-950/40 border-l-4 border-l-teal-400 shadow-sm shadow-teal-500/10'
                    : 'hover:bg-slate-800/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${isNewlyAdded ? 'bg-teal-500/20 text-teal-300' : 'bg-slate-800 text-slate-300'}`}>
                    {getMetricIcon(obs.metric_type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white capitalize">{obs.metric_type.replace(/_/g, ' ')}</h4>
                      {isNewlyAdded && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-teal-400 text-slate-950 animate-pulse">
                          <Sparkles className="w-2.5 h-2.5" />
                          JUST INGESTED
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span>{new Date(obs.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(obs.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span>•</span>
                      <span className="font-mono text-slate-500">Source: {obs.source}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`text-base font-extrabold font-mono ${isNewlyAdded ? 'text-teal-300' : 'text-white'}`}>
                    {obs.metric_type === 'daily_steps' ? Math.round(obs.value).toLocaleString() : obs.value}
                    <span className="text-xs font-normal text-slate-400 ml-1">{obs.unit}</span>
                  </span>
                  <span className="block text-[10px] uppercase font-mono tracking-wider font-semibold text-teal-400">
                    {obs.data_tier}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
