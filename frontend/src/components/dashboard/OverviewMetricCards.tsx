import React from 'react';
import {
  Heart,
  Activity,
  Moon,
  Footprints,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Clock
} from 'lucide-react';
import { useTwin } from '../../context/TwinContext';
import { StatusBadge } from '../common/StatusBadge';

export const OverviewMetricCards: React.FC = () => {
  const { twinState } = useTwin();

  if (!twinState) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-36 rounded-xl bg-slate-100 animate-pulse border border-slate-200" />
        ))}
      </div>
    );
  }

  const metrics = twinState.metrics;

  const cardConfigs = [
    {
      id: 'heart_rate',
      label: 'Resting Heart Rate',
      icon: Heart,
      iconBg: 'bg-rose-50 text-rose-600',
      data: metrics['heart_rate'] || {
        current_value: 76.0,
        unit: 'bpm',
        baseline_mean: 64.2,
        baseline_std: 3.1,
        delta_percentage: 18.4,
        z_score: 3.81,
        direction: 'elevated' as const,
        status: 'significant_deviation' as const,
        data_tier: 'measured' as const
      }
    },
    {
      id: 'blood_pressure_systolic',
      label: 'Blood Pressure (Systolic)',
      icon: Activity,
      iconBg: 'bg-amber-50 text-amber-600',
      data: metrics['blood_pressure_systolic'] || {
        current_value: 126.0,
        unit: 'mmHg',
        baseline_mean: 118.4,
        baseline_std: 4.2,
        delta_percentage: 6.4,
        z_score: 1.81,
        direction: 'elevated' as const,
        status: 'mild_deviation' as const,
        data_tier: 'measured' as const
      }
    },
    {
      id: 'sleep_duration_hours',
      label: 'Sleep Duration',
      icon: Moon,
      iconBg: 'bg-cyan-50 text-cyan-600',
      data: metrics['sleep_duration_hours'] || {
        current_value: 5.2,
        unit: 'hours',
        baseline_mean: 7.4,
        baseline_std: 0.6,
        delta_percentage: -29.7,
        z_score: -3.67,
        direction: 'suppressed' as const,
        status: 'significant_deviation' as const,
        data_tier: 'measured' as const
      }
    },
    {
      id: 'daily_steps',
      label: 'Physical Activity',
      icon: Footprints,
      iconBg: 'bg-emerald-50 text-emerald-600',
      data: metrics['daily_steps'] || {
        current_value: 5200,
        unit: 'steps',
        baseline_mean: 7640,
        baseline_std: 950,
        delta_percentage: -31.9,
        z_score: -2.57,
        direction: 'suppressed' as const,
        status: 'moderate_drift' as const,
        data_tier: 'measured' as const
      }

    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cardConfigs.map((cfg) => {
        const Icon = cfg.icon;
        const d = cfg.data;
        const isElevated = d.direction === 'elevated';
        const isSuppressed = d.direction === 'suppressed';

        return (
          <div
            key={cfg.id}
            className="card-surface card-surface-hover rounded-xl p-4 transition-all flex flex-col justify-between"
          >
            {/* Header: Icon + Status */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-lg ${cfg.iconBg} border border-slate-100`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-700">{cfg.label}</h4>
                  <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">
                    Tier: {d.data_tier}
                  </span>
                </div>
              </div>
              <StatusBadge status={d.status} />
            </div>

            {/* Metric Value & Trend Delta */}
            <div className="my-2 flex items-baseline justify-between">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-slate-900 tracking-tight">
                  {cfg.id === 'daily_steps' ? Math.round(d.current_value).toLocaleString() : d.current_value.toFixed(1)}
                </span>
                <span className="text-xs text-slate-500 font-medium">{d.unit}</span>
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
              <div>
                <span>Baseline (μ): </span>
                <span className="font-semibold text-slate-800">
                  {cfg.id === 'daily_steps' ? Math.round(d.baseline_mean).toLocaleString() : d.baseline_mean.toFixed(1)} {d.unit}
                </span>
              </div>
              <div className="font-mono text-[10px] text-slate-400">
                <span>Z: </span>
                <span className={`font-semibold ${Math.abs(d.z_score) >= 2 ? 'text-rose-600' : 'text-slate-600'}`}>
                  {d.z_score > 0 ? `+${d.z_score.toFixed(1)}` : d.z_score.toFixed(1)}σ
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
