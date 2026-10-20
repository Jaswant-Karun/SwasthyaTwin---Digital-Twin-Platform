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
  AlertCircle
} from 'lucide-react';
import { useTwin } from '../../context/TwinContext';
import { api } from '../../services/api';
import { Observation } from '../../types';

export const PatientTimeline: React.FC = () => {
  const { currentPatient, refreshData } = useTwin();
  const [observations, setObservations] = useState<Observation[]>([]);
  const [metricFilter, setMetricFilter] = useState<string>('all');
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [newMetric, setNewMetric] = useState<string>('heart_rate');
  const [newValue, setNewValue] = useState<string>('72');
  const [newUnit, setNewUnit] = useState<string>('bpm');
  const [newSource, setNewSource] = useState<string>('manual_entry');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchObservations = async () => {
    if (!currentPatient) return;
    try {
      const res = await api.getObservations(currentPatient.patient_id, {
        metric_type: metricFilter !== 'all' ? metricFilter : undefined,
        limit: 100
      });
      setObservations(res.items);
    } catch (err) {
      console.error('Error fetching observations for timeline:', err);
    }
  };

  useEffect(() => {
    fetchObservations();
  }, [currentPatient, metricFilter]);

  const handleAddObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPatient) return;
    setIsSubmitting(true);
    try {
      await api.addObservation(currentPatient.patient_id, {
        patient_id: currentPatient.patient_id,
        timestamp: new Date().toISOString(),
        metric_type: newMetric,
        value: parseFloat(newValue),
        unit: newUnit,
        source: newSource,
        data_tier: newSource.includes('manual') ? 'user_reported' : 'measured'
      });
      setIsAdding(false);
      await fetchObservations();
      await refreshData();
    } catch (err) {
      console.error('Failed to log observation:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMetricIcon = (metric: string) => {
    if (metric.includes('heart')) return <Heart className="w-3.5 h-3.5 text-rose-400" />;
    if (metric.includes('sleep')) return <Moon className="w-3.5 h-3.5 text-cyan-400" />;
    if (metric.includes('step')) return <Footprints className="w-3.5 h-3.5 text-emerald-400" />;
    return <Activity className="w-3.5 h-3.5 text-teal-400" />;
  };

  return (
    <div className="space-y-5">
      {/* Timeline Controls & Add Entry Button */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-teal-400" />
            Longitudinal Observation Timeline
          </h3>
          <p className="text-xs text-slate-400">
            Chronological audit stream of wearable biometrics, clinical assays, and manual journals.
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
            <option value="hrv_rmssd">Heart Rate Variability</option>
            <option value="sleep_duration_hours">Sleep Duration</option>
            <option value="daily_steps">Daily Activity</option>
          </select>

          <button
            onClick={() => setIsAdding(!isAdding)}
            className="px-3 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-teal-500/20"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Log Measurement
          </button>
        </div>
      </div>

      {/* Observation Entry Form Modal / Accordion */}
      {isAdding && (
        <form onSubmit={handleAddObservation} className="p-5 rounded-2xl bg-slate-900 border border-teal-500/30 space-y-4 shadow-xl">
          <h4 className="text-xs font-bold text-teal-300 uppercase tracking-wider">Log New Physiological Observation</h4>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-slate-300 block mb-1">Metric Type</label>
              <select
                value={newMetric}
                onChange={(e) => {
                  setNewMetric(e.target.value);
                  if (e.target.value === 'heart_rate') { setNewUnit('bpm'); setNewValue('72'); }
                  else if (e.target.value === 'blood_pressure_systolic') { setNewUnit('mmHg'); setNewValue('125'); }
                  else if (e.target.value === 'sleep_duration_hours') { setNewUnit('hours'); setNewValue('7.0'); }
                  else if (e.target.value === 'daily_steps') { setNewUnit('steps'); setNewValue('8000'); }
                }}
                className="w-full bg-slate-800 text-white text-xs rounded-lg px-2.5 py-2 border border-slate-700 font-medium"
              >
                <option value="heart_rate">Heart Rate (bpm)</option>
                <option value="blood_pressure_systolic">Systolic BP (mmHg)</option>
                <option value="hrv_rmssd">HRV RMSSD (ms)</option>
                <option value="sleep_duration_hours">Sleep (hrs)</option>
                <option value="daily_steps">Steps</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-300 block mb-1">Observed Value</label>
              <input
                type="number"
                step="any"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="w-full bg-slate-800 text-white text-xs rounded-lg px-2.5 py-2 border border-slate-700 font-mono font-bold"
                required
              />
            </div>

            <div>
              <label className="text-xs text-slate-300 block mb-1">Unit</label>
              <input
                type="text"
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                className="w-full bg-slate-800 text-white text-xs rounded-lg px-2.5 py-2 border border-slate-700 font-mono"
                required
              />
            </div>

            <div>
              <label className="text-xs text-slate-300 block mb-1">Data Source</label>
              <select
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                className="w-full bg-slate-800 text-white text-xs rounded-lg px-2.5 py-2 border border-slate-700 font-medium"
              >
                <option value="manual_entry">Patient Self-Report (User Tier)</option>
                <option value="clinical_lab">Clinical Lab Test (Measured Tier)</option>
                <option value="wearable_continuous">Wearable Sensor (Measured Tier)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAdding(false)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-teal-500/20"
            >
              {isSubmitting ? 'Recording...' : 'Commit to Digital Twin'}
            </button>
          </div>
        </form>
      )}

      {/* Observation Items */}
      <div className="rounded-2xl bg-slate-900/60 border border-slate-800 divide-y divide-slate-800/80">
        {observations.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No telemetry records found.
          </div>
        ) : (
          observations.slice(0, 50).map((obs) => (
            <div key={obs._id} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors text-xs">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-slate-800 text-slate-300">
                  {getMetricIcon(obs.metric_type)}
                </div>
                <div>
                  <h4 className="font-bold text-white capitalize">{obs.metric_type.replace(/_/g, ' ')}</h4>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                    <span>{new Date(obs.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(obs.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span>•</span>
                    <span className="font-mono text-slate-500">Source: {obs.source}</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <span className="text-base font-extrabold text-white font-mono">
                  {obs.metric_type === 'daily_steps' ? Math.round(obs.value).toLocaleString() : obs.value}
                  <span className="text-xs font-normal text-slate-400 ml-1">{obs.unit}</span>
                </span>
                <span className="block text-[10px] uppercase font-mono tracking-wider font-semibold text-teal-400">
                  {obs.data_tier}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
