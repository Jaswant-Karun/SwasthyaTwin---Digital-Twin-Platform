import React from 'react';
import { Activity, ShieldCheck, AlertTriangle, ArrowUpRight, ArrowDownRight, Minus, Zap } from 'lucide-react';
import { useTwin } from '../../context/TwinContext';
import { StatusBadge } from '../common/StatusBadge';

export const TwinStatusHero: React.FC = () => {
  const { currentPatient, twinState, assessment } = useTwin();

  if (!twinState || !assessment) {
    return (
      <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 animate-pulse text-center">
        <p className="text-slate-400 text-sm">Synchronizing Digital Twin State...</p>
      </div>
    );
  }

  const score = assessment.vitality_index;
  const status = assessment.stability_status;

  // Determine score color
  const getScoreColor = (val: number) => {
    if (val >= 90) return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    if (val >= 75) return 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10';
    if (val >= 60) return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
  };

  const scoreClass = getScoreColor(score);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-teal-950/40 border border-teal-500/20 p-6 sm:p-8 shadow-xl shadow-teal-950/10">
      {/* Background ambient glow */}
      <div className="absolute -top-24 -right-24 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        {/* Left: Twin Identity & Health Assessment */}
        <div className="space-y-3 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/30 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              Dynamic Twin Active
            </span>
            <StatusBadge status={status} />
            <span className="text-xs text-slate-400">
              Personalized window: <strong className="text-slate-200">{currentPatient?.baseline_window_days} Days</strong>
            </span>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {currentPatient?.full_name}’s Health Twin
            </h1>
            <p className="text-sm text-slate-300 mt-1 leading-relaxed">
              {assessment.summary_message}
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Self-Baseline Baseline Reference</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-teal-400" />
              <span>{twinState.active_alert_count} Active Biometric Divergences</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Continuous Telemetry Synchronized</span>
            </div>
          </div>
        </div>

        {/* Right: Health Stability / Vitality Gauge */}
        <div className="flex items-center gap-5 bg-slate-950/60 p-5 rounded-2xl border border-slate-800/80 shrink-0 self-stretch sm:self-auto justify-center">
          <div className={`relative w-24 h-24 rounded-2xl flex flex-col items-center justify-center border ${scoreClass} shadow-lg`}>
            <span className="text-3xl font-black tracking-tight">{score}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Vitality Index</span>
          </div>

          <div className="space-y-1 text-left">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Health Stability</h3>
            <p className="text-sm font-bold text-white capitalize">{status.replace('_', ' ')}</p>
            <p className="text-[11px] text-slate-400 max-w-[180px] leading-tight">
              100% explainable deduction formula calibrated to personal baseline Z-scores.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
