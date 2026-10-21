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
import { Calendar, Filter, Activity, Info } from 'lucide-react';
import { useTwin } from '../../context/TwinContext';
import { api } from '../../services/api';
import { Observation } from '../../types';

interface ChartPoint {
  date: string;
  timestamp: string;
  value: number;
  data_tier: string;
  source: string;
}

export const LongitudinalChart: React.FC = () => {
  const { currentPatient, twinState } = useTwin();
  const [selectedMetric, setSelectedMetric] = useState<string>('heart_rate');
  const [windowRange, setWindowRange] = useState<number>(30); // 7, 14, 30, 90
  const [observations, setObservations] = useState<Observation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!currentPatient) return;
    const fetchObs = async () => {
      setIsLoading(true);
      try {
        const res = await api.getObservations(currentPatient.patient_id, {
          metric_type: selectedMetric,
          limit: 300
        });
        const items = res?.items || [];
        const sorted = [...items].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        setObservations(sorted);
      } catch (err) {
        console.error('Failed to fetch observations for chart:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchObs();
  }, [currentPatient, selectedMetric]);

  const activeDeviation = twinState?.metrics[selectedMetric];
  const baselineMean = activeDeviation?.baseline_mean || 70;
  const baselineStd = activeDeviation?.baseline_std || 5;

  // Upper and lower bounds for 1.5 sigma corridor
  const upperSigma = baselineMean + 1.5 * baselineStd;
  const lowerSigma = Math.max(0, baselineMean - 1.5 * baselineStd);

  // Filter observations according to windowRange
  const now = new Date().getTime();
  const cutoffTime = now - windowRange * 24 * 60 * 60 * 1000;
  const filteredData: ChartPoint[] = observations
    .filter(o => new Date(o.timestamp).getTime() >= cutoffTime)
    .map(o => ({
      date: new Date(o.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      timestamp: o.timestamp,
      value: o.value,
      data_tier: o.data_tier,
      source: o.source
    }));

  const metricOptions = [
    { id: 'heart_rate', label: 'Resting Heart Rate (bpm)' },
    { id: 'blood_pressure_systolic', label: 'Systolic Blood Pressure (mmHg)' },
    { id: 'hrv_rmssd', label: 'Heart Rate Variability (ms)' },
    { id: 'sleep_duration_hours', label: 'Sleep Duration (hrs)' },
    { id: 'daily_steps', label: 'Daily Steps' },
    { id: 'fasting_blood_glucose', label: 'Fasting Blood Glucose (mg/dL)' }
  ];

  return (
    <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-4">
      {/* Chart Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-400" />
            Longitudinal Telemetry vs Personal Baseline Band
          </h3>
          <p className="text-xs text-slate-400">
            Shaded cyan band indicates your personal 1.5σ baseline tolerance envelope (μ ± 1.5σ).
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Metric Selector */}
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            className="bg-slate-800 text-white text-xs rounded-lg px-2.5 py-1.5 border border-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium"
          >
            {metricOptions.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>

          {/* Time range buttons */}
          <div className="flex rounded-lg bg-slate-800 p-0.5 border border-slate-700 text-xs">
            {[7, 14, 30, 90].map(days => (
              <button
                key={days}
                onClick={() => setWindowRange(days)}
                className={`px-2 py-1 rounded-md text-xs font-semibold transition-all ${
                  windowRange === days
                    ? 'bg-teal-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {days}D
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recharts Container */}
      <div className="h-72 w-full pt-2">
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-slate-400 text-xs animate-pulse">
            Loading longitudinal time-series...
          </div>
        ) : filteredData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-xs">
            No observations recorded within selected window.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filteredData} margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload as ChartPoint;
                    const delta = data.value - baselineMean;
                    const z = baselineStd > 0 ? (delta / baselineStd).toFixed(2) : '0.00';
                    return (
                      <div className="bg-slate-950/95 border border-slate-800 p-3 rounded-xl shadow-xl text-xs space-y-1">
                        <p className="font-bold text-white border-b border-slate-800 pb-1">{label} ({new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</p>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-400">Value:</span>
                          <span className="font-bold text-teal-400 font-mono">{data.value} {activeDeviation?.unit}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-400">Baseline (μ):</span>
                          <span className="text-slate-300 font-mono">{baselineMean.toFixed(1)} {activeDeviation?.unit}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-400">Deviation (Z):</span>
                          <span className={`font-mono font-bold ${Math.abs(Number(z)) >= 2 ? 'text-rose-400' : 'text-slate-300'}`}>
                            {Number(z) > 0 ? `+${z}` : z}σ
                          </span>
                        </div>
                        <div className="flex justify-between gap-4 text-[10px] text-slate-500 pt-1 border-t border-slate-800">
                          <span>Data Tier:</span>
                          <span className="uppercase font-semibold text-teal-300">{data.data_tier}</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              {/* Baseline Mean reference line */}
              <ReferenceLine
                y={baselineMean}
                stroke="#14b8a6"
                strokeDasharray="4 4"
                label={{ value: `Baseline μ: ${baselineMean.toFixed(1)}`, fill: '#14b8a6', fontSize: 10, position: 'insideTopLeft' }}
              />

              {/* Shaded 1.5-sigma baseline envelope */}
              <ReferenceArea
                y1={lowerSigma}
                y2={upperSigma}
                fill="#14b8a6"
                fillOpacity={0.06}
              />

              {/* Telemetry Line */}
              <Line
                type="monotone"
                dataKey="value"
                stroke="#2dd4bf"
                strokeWidth={2.5}
                dot={{ r: 2.5, fill: '#2dd4bf', strokeWidth: 1 }}
                activeDot={{ r: 5, fill: '#14b8a6', stroke: '#fff' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
