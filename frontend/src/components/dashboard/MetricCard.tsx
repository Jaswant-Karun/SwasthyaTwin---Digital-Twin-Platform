import React from 'react';
import {
  Heart,
  Activity,
  Moon,
  Footprints,
  Wind,
  Droplets,
  Scale,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles
} from 'lucide-react';
import { MetricDeviation } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { HowCalculatedButton } from '../common/HowCalculatedButton';

interface MetricCardProps {
  deviation: MetricDeviation;
  onSelect?: () => void;
  isSelected?: boolean;
}

const METRIC_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  heart_rate: { label: 'Resting Heart Rate', icon: Heart, color: 'text-rose-400' },
  blood_pressure_systolic: { label: 'Systolic Blood Pressure', icon: Activity, color: 'text-amber-400' },
  blood_pressure_diastolic: { label: 'Diastolic Blood Pressure', icon: Activity, color: 'text-amber-400' },
  hrv_rmssd: { label: 'Heart Rate Variability', icon: Activity, color: 'text-teal-400' },
  sleep_duration_hours: { label: 'Sleep Duration', icon: Moon, color: 'text-cyan-400' },
  daily_steps: { label: 'Daily Activity', icon: Footprints, color: 'text-emerald-400' },
  spo2: { label: 'Blood Oxygen (SpO2)', icon: Wind, color: 'text-sky-400' },
  fasting_blood_glucose: { label: 'Fasting Glucose', icon: Droplets, color: 'text-purple-400' }
};

export const MetricCard: React.FC<MetricCardProps> = ({ deviation, onSelect, isSelected = false }) => {
  const config = METRIC_CONFIG[deviation.metric_type] || {
    label: deviation.metric_type.replace(/_/g, ' ').toUpperCase(),
    icon: Activity,
    color: 'text-slate-300'
  };

  const Icon = config.icon;
  const isElevated = deviation.direction === 'elevated';
  const isSuppressed = deviation.direction === 'suppressed';

  const formatValue = (val: number, type: string) => {
    if (type === 'daily_steps') return Math.round(val).toLocaleString();
    return val.toFixed(1);
  };

  return (
    <div
      onClick={onSelect}
      className={`group relative rounded-2xl p-4 sm:p-5 transition-all cursor-pointer border ${
        isSelected
          ? 'bg-slate-900 border-teal-500 shadow-lg shadow-teal-500/10 ring-1 ring-teal-500'
          : 'bg-slate-900/60 hover:bg-slate-900/90 border-slate-800/80 hover:border-slate-700'
      }`}
    >
      {/* Top Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/50">
            <Icon className={`w-4 h-4 ${config.color}`} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">{config.label}</h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                Tier: <span className="text-teal-400 font-semibold">{deviation.data_tier}</span>
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <HowCalculatedButton
            category="metric"
            itemId={deviation.metric_type}
            variant="icon"
            className="text-slate-400 hover:text-teal-400"
          />
          <StatusBadge status={deviation.status} />
        </div>
      </div>

      {/* Main Metric Value */}
      <div className="flex items-baseline justify-between mb-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-black text-white tracking-tight">
            {formatValue(deviation.current_value, deviation.metric_type)}
          </span>
          <span className="text-xs text-slate-400 font-semibold">{deviation.unit}</span>
        </div>

        {/* Delta vs self-baseline */}
        <div className={`flex items-center text-xs font-bold px-2 py-0.5 rounded-md ${
          deviation.status === 'optimal'
            ? 'text-emerald-400 bg-emerald-500/10'
            : deviation.status === 'mild_deviation'
            ? 'text-cyan-400 bg-cyan-500/10'
            : deviation.status === 'moderate_drift'
            ? 'text-amber-400 bg-amber-500/10'
            : 'text-rose-400 bg-rose-500/10'
        }`}>
          {isElevated ? (
            <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
          ) : isSuppressed ? (
            <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
          ) : (
            <Minus className="w-3.5 h-3.5 mr-0.5" />
          )}
          <span>{deviation.delta_percentage > 0 ? `+${deviation.delta_percentage}%` : `${deviation.delta_percentage}%`}</span>
        </div>
      </div>

      {/* Baseline comparison footer */}
      <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-1">
          <span>Your Baseline: </span>
          <span className="font-semibold text-slate-200">{formatValue(deviation.baseline_mean, deviation.metric_type)} {deviation.unit}</span>
          <HowCalculatedButton
            category="baseline"
            itemId={deviation.metric_type}
            variant="icon"
            className="text-slate-400 hover:text-teal-400 p-0.5"
          />
        </div>
        <div className="font-mono">
          <span>Z: </span>
          <span className={`font-bold ${Math.abs(deviation.z_score) >= 2.0 ? 'text-rose-400' : 'text-slate-300'}`}>
            {deviation.z_score > 0 ? `+${deviation.z_score.toFixed(2)}` : deviation.z_score.toFixed(2)}σ
          </span>
        </div>
      </div>
    </div>
  );
};
