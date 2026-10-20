import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ReferenceArea
} from 'recharts';
import { Activity, Calendar, Info, Layers } from 'lucide-react';
import { useTwin } from '../../context/TwinContext';
import { api } from '../../services/api';
import type { Observation } from '../../types';

interface ChartPoint {
  date: string;
  timestamp: string;
  value: number;
  data_tier: string;
  source: string;
}

export const InteractiveHistoricalChart: React.FC<{ initialDays?: number }> = ({ initialDays = 30 }) => {
  const { currentPatient, twinState, selectedRangeDays } = useTwin();
  const [selectedMetric, setSelectedMetric] = useState<string>('heart_rate');
  const [windowRange, setWindowRange] = useState<number>(selectedRangeDays || initialDays);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const reqIdRef = React.useRef<number>(0);

  // Sync with global range if initialDays changes or global range changes
  useEffect(() => {
    if (selectedRangeDays) {
      setWindowRange(selectedRangeDays);
    }
  }, [selectedRangeDays]);

  useEffect(() => {
    if (!currentPatient) return;
    const currentReq = ++reqIdRef.current;
    const fetchObs = async () => {
      setIsLoading(true);
      try {
        const res = await api.getObservations(currentPatient.patient_id, {
          metric_type: selectedMetric,
          limit: 500
        });
        if (currentReq === reqIdRef.current) {
          const sorted = [...res.items].sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          setObservations(sorted);
        }
      } catch (err) {
        if (currentReq === reqIdRef.current) {
          console.error('Failed to fetch observations for chart:', err);
        }
      } finally {
        if (currentReq === reqIdRef.current) {
          setIsLoading(false);
        }
      }
    };
    fetchObs();
  }, [currentPatient?.patient_id, selectedMetric]);

  const activeDeviation = twinState?.metrics[selectedMetric];
  const baselineMean = activeDeviation?.baseline_mean || 68;
  const baselineStd = activeDeviation?.baseline_std || 3.5;

  const upperSigma = baselineMean + 1.5 * baselineStd;
  const lowerSigma = Math.max(0, baselineMean - 1.5 * baselineStd);

  // Anchor window to either now or the latest available observation timestamp
  const latestTimestamp = observations.length > 0
    ? Math.max(...observations.map(o => new Date(o.timestamp).getTime()))
    : Date.now();
  const anchorTime = Math.max(Date.now(), latestTimestamp);
  const cutoffTime = anchorTime - windowRange * 24 * 60 * 60 * 1000;

  const filteredData: ChartPoint[] = observations
    .filter(o => new Date(o.timestamp).getTime() >= cutoffTime)
    .map(o => ({
      date: new Date(o.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      timestamp: o.timestamp,
      value: o.value,
      data_tier: o.data_tier,
      source: o.source
    }));

  const metricTabs = [
    { id: 'heart_rate', label: 'Resting HR', unit: 'bpm' },
    { id: 'blood_pressure_systolic', label: 'Blood Pressure', unit: 'mmHg' },
    { id: 'respiratory_rate', label: 'Respiratory Rate', unit: 'breaths/min' },
    { id: 'sleep_duration_hours', label: 'Sleep Duration', unit: 'hrs' },
    { id: 'daily_steps', label: 'Activity Steps', unit: 'steps' },
    { id: 'hrv_rmssd', label: 'HRV (RMSSD)', unit: 'ms' },
    { id: 'fasting_blood_glucose', label: 'Blood Glucose', unit: 'mg/dL' }
  ];

  return (
    <div className="card-surface rounded-xl p-5 space-y-4">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-600" />
            Longitudinal Health Measurements & Personal Baseline Corridor
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            The shaded teal band defines {currentPatient?.full_name}’s personalized tolerance range (μ ± 1.5σ).
          </p>
        </div>

        {/* Range Controls */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
          {[7, 14, 30, 90].map(days => (
            <button
              key={days}
              onClick={() => setWindowRange(days)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                windowRange === days
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {days}D
            </button>
          ))}
        </div>
      </div>

      {/* Metric Selector Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {metricTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setSelectedMetric(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              selectedMetric === t.id
                ? 'bg-teal-50 border-teal-300 text-teal-800'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.label} <span className="text-[10px] text-slate-400 font-normal">({t.unit})</span>
          </button>
        ))}
      </div>

      {/* Chart Canvas */}
      <div className="h-72 w-full pt-1">
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center space-y-2 bg-slate-50/50 rounded-lg animate-pulse">
            <Activity className="w-6 h-6 text-teal-600/40 animate-spin" />
            <span className="text-slate-500 text-xs font-medium">Loading longitudinal observations...</span>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs space-y-1">
            <Activity className="w-5 h-5 text-slate-300" />
            <span>No observations recorded for this metric within the selected {windowRange}-day window.</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filteredData} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as ChartPoint;
                    const delta = data.value - baselineMean;
                    const z = baselineStd > 0 ? (delta / baselineStd).toFixed(2) : '0.00';
                    return (
                      <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-md text-xs space-y-1">
                        <p className="font-semibold text-slate-900 border-b border-slate-100 pb-1">
                          {label} ({new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                        </p>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-500">Observed Value:</span>
                          <span className="font-bold text-slate-900 font-mono">
                            {data.value} {activeDeviation?.unit}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-500">Personal Baseline (μ):</span>
                          <span className="text-slate-700 font-mono">
                            {baselineMean.toFixed(1)} {activeDeviation?.unit}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-500">Z-Score:</span>
                          <span className={`font-mono font-bold ${Math.abs(Number(z)) >= 2 ? 'text-rose-600' : 'text-slate-700'}`}>
                            {Number(z) > 0 ? `+${z}` : z}σ
                          </span>
                        </div>
                        <div className="flex justify-between gap-4 text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                          <span>Provenance:</span>
                          <span className="uppercase font-semibold text-teal-700">{data.data_tier}</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {/* Baseline Reference Line */}
              <ReferenceLine
                y={baselineMean}
                stroke="#0d9488"
                strokeDasharray="4 4"
                label={{
                  value: `Baseline: ${baselineMean.toFixed(1)}`,
                  fill: '#0d9488',
                  fontSize: 10,
                  position: 'insideTopLeft'
                }}
              />

              {/* Shaded 1.5-sigma envelope */}
              <ReferenceArea
                y1={lowerSigma}
                y2={upperSigma}
                fill="#0d9488"
                fillOpacity={0.08}
              />

              {/* Measurement Line */}
              <Line
                type="monotone"
                dataKey="value"
                stroke="#0d9488"
                strokeWidth={2.5}
                dot={{ r: 2.5, fill: '#0d9488', strokeWidth: 1 }}
                activeDot={{ r: 5, fill: '#0d9488', stroke: '#ffffff' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
