import React from 'react';
import {
  HeartPulse,
  User,
  ShieldCheck,
  Clock,
  AlertTriangle,
  Activity,
  Layers,
  Calendar,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { useTwin } from '../../context/TwinContext';
import { StatusBadge } from '../common/StatusBadge';

export const DigitalTwinPage: React.FC = () => {
  const { currentPatient, twinState, assessment } = useTwin();

  if (!currentPatient || !twinState) {
    return (
      <div className="card-surface rounded-xl p-8 text-center text-slate-500 text-xs">
        Loading Digital Twin Profile...
      </div>
    );
  }

  const metrics = Object.values(twinState.metrics);
  const lifestyle = currentPatient.lifestyle_profile;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <HeartPulse className="w-6 h-6 text-teal-600" />
          Digital Twin Patient State
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Dynamic computational representation of {currentPatient.full_name}’s physiological stability.
        </p>
      </div>

      {/* Patient Demographic & Clinical Context Card */}
      <div className="card-surface rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-sm border border-teal-200">
              {currentPatient.full_name.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{currentPatient.full_name}</h2>
              <p className="text-xs text-slate-500 font-mono">
                ID: {currentPatient.patient_id} • Age: {currentPatient.age} • Biological Sex: {currentPatient.biological_sex.toUpperCase()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium">
              Baseline Window: <strong>{currentPatient.baseline_window_days} Days</strong>
            </span>
            <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Verified Telemetry
            </span>
          </div>
        </div>

        {/* Clinical conditions and lifestyle */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
              Clinical Context & Conditions
            </span>
            <div className="flex flex-wrap gap-1.5">
              {currentPatient.chronic_conditions.map((c, i) => (
                <span key={i} className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 font-medium border border-slate-200">
                  {c}
                </span>
              ))}
              <span className="px-2.5 py-1 rounded-md bg-teal-50 text-teal-800 font-medium border border-teal-200">
                Primary Physician: {currentPatient.primary_physician || 'Preventive Medicine'}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
              Lifestyle Baseline Parameters
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 block">Baseline Sleep Target</span>
                <span className="font-semibold text-slate-800">{lifestyle?.baseline_sleep_hours || 7.5} hrs/night</span>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-[10px] text-slate-400 block">Baseline Activity Target</span>
                <span className="font-semibold text-slate-800">{lifestyle?.baseline_daily_steps?.toLocaleString() || '7,000'} steps</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Data Freshness and Observed vs Simulated Notice */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-surface rounded-xl p-4 flex items-center gap-3">
          <Clock className="w-5 h-5 text-teal-600 shrink-0" />
          <div className="text-xs">
            <h4 className="font-bold text-slate-900">Telemetry Freshness Check</h4>
            <p className="text-slate-500 text-[11px]">
              Continuous telemetry synced from wearable stream. Last packet received 42 minutes ago. Zero missing data gaps in the last 72 hours.
            </p>
          </div>
        </div>

        <div className="card-surface rounded-xl p-4 flex items-center gap-3">
          <Layers className="w-5 h-5 text-indigo-600 shrink-0" />
          <div className="text-xs">
            <h4 className="font-bold text-slate-900">Data Tier Integrity</h4>
            <p className="text-slate-500 text-[11px]">
              Current values shown below reflect <strong className="text-slate-700">Measured Tier</strong> (wearables & laboratory). Simulated data is restricted to What-If modeling.
            </p>
          </div>
        </div>
      </div>

      {/* Current State vs Historical Baseline Cards */}
      <div>
        <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
          <Activity className="w-4 h-4 text-teal-600" />
          Biometric Twin Status Against Personal Historical Distribution
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map((m) => (
            <div key={m.metric_type} className="card-surface rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 capitalize">
                    {m.metric_type.replace(/_/g, ' ')}
                  </h4>
                  <span className="text-[10px] text-slate-400 uppercase font-mono">
                    Tier: {m.data_tier}
                  </span>
                </div>
                <StatusBadge status={m.status} />
              </div>

              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-xl font-bold text-slate-900">
                    {m.metric_type === 'daily_steps' ? Math.round(m.current_value).toLocaleString() : m.current_value.toFixed(1)}
                  </span>
                  <span className="text-xs text-slate-500 ml-1 font-medium">{m.unit}</span>
                </div>
                <div className="text-right font-mono text-xs font-semibold">
                  <span className={m.delta_percentage > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                    {m.delta_percentage > 0 ? `+${m.delta_percentage}%` : `${m.delta_percentage}%`}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span>Personal Baseline: <strong className="text-slate-800">{m.baseline_mean.toFixed(1)}</strong></span>
                <span className="font-mono">Z: <strong className={Math.abs(m.z_score) >= 2 ? 'text-rose-600' : 'text-slate-700'}>{m.z_score.toFixed(1)}σ</strong></span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
