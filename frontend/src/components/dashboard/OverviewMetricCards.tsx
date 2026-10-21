import React from 'react';
import {
  Heart,
  Activity,
  Moon,
  Footprints,
  Wind,
  Droplet,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { useTwin } from '../../context/TwinContext';
import { StatusBadge } from '../common/StatusBadge';
import { HowCalculatedButton } from '../common/HowCalculatedButton';
import type { MetricDeviation } from '../../types';

interface MetricMeta {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  defaultUnit: string;
}

const METRIC_METAS: Record<string, MetricMeta> = {
  heart_rate: {
    label: 'Resting Heart Rate',
    icon: Heart,
    iconBg: 'bg-rose-50 text-rose-600',
    defaultUnit: 'bpm'
  },
  blood_pressure_systolic: {
    label: 'Blood Pressure (Systolic)',
    icon: Activity,
    iconBg: 'bg-amber-50 text-amber-600',
    defaultUnit: 'mmHg'
  },
  respiratory_rate: {
    label: 'Respiratory Rate',
    icon: Wind,
    iconBg: 'bg-sky-50 text-sky-600',
    defaultUnit: 'breaths/min'
  },
  sleep_duration_hours: {
    label: 'Sleep Duration',
    icon: Moon,
    iconBg: 'bg-cyan-50 text-cyan-600',
    defaultUnit: 'hours'
  },
  daily_steps: {
    label: 'Physical Activity',
    icon: Footprints,
    iconBg: 'bg-emerald-50 text-emerald-600',
    defaultUnit: 'steps'
  },
  fasting_blood_glucose: {
    label: 'Fasting Blood Glucose',
    icon: Droplet,
    iconBg: 'bg-purple-50 text-purple-600',
    defaultUnit: 'mg/dL'
  },
  hrv_rmssd: {
    label: 'Heart Rate Variability',
    icon: Zap,
    iconBg: 'bg-indigo-50 text-indigo-600',
    defaultUnit: 'ms'
  }
};

export const OverviewMetricCards: React.FC = () => {
  const { twinState, isLoadingPatientData, patientDataError, retryLoadPatient } = useTwin();

  // Skeleton loading state
  if (isLoadingPatientData) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-36 rounded-xl bg-slate-100 animate-pulse border border-slate-200 p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="w-24 h-4 bg-slate-200 rounded" />
              <div className="w-16 h-4 bg-slate-200 rounded" />
            </div>
            <div className="w-32 h-8 bg-slate-200 rounded my-2" />
            <div className="w-40 h-3 bg-slate-200 rounded" />
          </div>
        ))}
      </div>
    );
  }

  // Error state with retry
  if (patientDataError && !twinState) {
    return (
      <div className="card-surface rounded-xl p-5 border border-rose-200 bg-rose-50/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <div>
            <h4 className="text-xs font-bold text-rose-900">Failed to Load Biometric Telemetry</h4>
            <p className="text-xs text-rose-700 mt-0.5">{patientDataError}</p>
          </div>
        </div>
        <button
          onClick={retryLoadPatient}
          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      </div>
    );
  }

  if (!twinState) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-36 rounded-xl bg-slate-100 animate-pulse border border-slate-200" />
        ))}
      </div>
    );
  }

  const metrics = twinState.metrics || {};

  // Standard primary metrics we prioritize displaying
  const priorityKeys = [
    'heart_rate',
    'blood_pressure_systolic',
    'respiratory_rate',
    'sleep_duration_hours',
    'daily_steps'
  ];

  // Include any extra metric present in the twin state (e.g. fasting_blood_glucose, hrv_rmssd)
  const allKeys = Array.from(new Set([...priorityKeys, ...Object.keys(metrics)]));

  // Filter to show existing metrics, plus up to 4 priority metrics
  const displayedKeys = allKeys.filter(k => metrics[k] || priorityKeys.includes(k)).slice(0, 5);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {displayedKeys.map((key) => {
        const meta = METRIC_METAS[key] || {
          label: key.replace(/_/g, ' '),
          icon: Activity,
          iconBg: 'bg-slate-50 text-slate-600',
          defaultUnit: ''
        };
        const Icon = meta.icon;
        const d: MetricDeviation | undefined = metrics[key];

        // If untracked for this patient, show explicit awaiting telemetry state (no fake data)
        if (!d) {
          return (
            <div
              key={key}
              className="card-surface rounded-xl p-4 flex flex-col justify-between border-dashed border-slate-200 opacity-70"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg ${meta.iconBg} border border-slate-100`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-700">{meta.label}</h4>
                    <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">
                      Tier: Unrecorded
                    </span>
                  </div>
                </div>
              </div>

              <div className="my-3">
                <span className="text-xs font-medium text-slate-400 italic">
                  Awaiting Telemetry
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                <span>Baseline: Not Established</span>
              </div>
            </div>
          );
        }

        const isElevated = d.direction === 'elevated';
        const isSuppressed = d.direction === 'suppressed';

        return (
          <div
            key={key}
            className="card-surface card-surface-hover rounded-xl p-4 transition-all flex flex-col justify-between"
          >
            {/* Header: Icon + Status */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-lg ${meta.iconBg} border border-slate-100`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-700">{meta.label}</h4>
                  <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">
                    Tier: {d.data_tier}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <HowCalculatedButton
                  category="metric"
                  itemId={key}
                  variant="icon"
                />
                <StatusBadge status={d.status} />
              </div>
            </div>

            {/* Metric Value & Trend Delta */}
            <div className="my-2 flex items-baseline justify-between">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-slate-900 tracking-tight font-mono">
                  {key === 'daily_steps' ? Math.round(d.current_value).toLocaleString() : d.current_value.toFixed(1)}
                </span>
                <span className="text-xs text-slate-500 font-medium">{d.unit || meta.defaultUnit}</span>
              </div>

              <div
                className={`flex items-center text-xs font-semibold px-2 py-0.5 rounded ${
                  d.status === 'optimal'
                    ? 'text-emerald-700 bg-emerald-50'
                    : d.status === 'mild_deviation'
                    ? 'text-cyan-700 bg-cyan-50'
                    : d.status === 'moderate_drift'
                    ? 'text-amber-700 bg-amber-50'
                    : 'text-rose-700 bg-rose-50'
                }`}
              >
                {isElevated ? (
                  <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                ) : isSuppressed ? (
                  <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                ) : (
                  <Minus className="w-3.5 h-3.5 mr-0.5" />
                )}
                <span>{d.delta_percentage > 0 ? `+${d.delta_percentage}%` : `${d.delta_percentage}%`}</span>
              </div>
            </div>

            {/* Baseline comparison and timestamp */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <div className="flex items-center gap-1">
                <span>Self μ: </span>
                <span className="font-semibold text-slate-800 font-mono">
                  {key === 'daily_steps' ? Math.round(d.baseline_mean).toLocaleString() : d.baseline_mean.toFixed(1)} {d.unit}
                </span>
                <HowCalculatedButton
                  category="baseline"
                  itemId={key}
                  variant="icon"
                  className="p-0.5 text-slate-400 hover:text-teal-600"
                />
              </div>
              <div className="font-mono text-[10px] text-slate-400">
                <span>Z: </span>
                <span className={`font-semibold ${Math.abs(d.z_score) >= 2 ? 'text-rose-600' : 'text-slate-600'}`}>
                  {d.z_score > 0 ? `+${d.z_score.toFixed(1)}` : d.z_score.toFixed(1)}σ
                </span>
              </div>
            </div>

            {/* Quick explanation link */}
            <div className="pt-2 mt-1 border-t border-slate-50 flex justify-end">
              <HowCalculatedButton
                category="metric"
                itemId={key}
                variant="link"
                className="text-[10px]"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

