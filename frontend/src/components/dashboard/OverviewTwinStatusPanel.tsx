import React from 'react';
import { Activity, ShieldCheck, Clock, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { useTwin } from '../../context/TwinContext';
import { StatusBadge } from '../common/StatusBadge';

export const OverviewTwinStatusPanel: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const { currentPatient, twinState, assessment } = useTwin();

  if (!currentPatient || !twinState || !assessment) return null;

  const vitality = assessment.vitality_index;

  const getVitalityBadgeColor = (val: number) => {
    if (val >= 90) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    if (val >= 75) return 'text-cyan-700 bg-cyan-50 border-cyan-200';
    if (val >= 60) return 'text-amber-700 bg-amber-50 border-amber-200';
    return 'text-rose-700 bg-rose-50 border-rose-200';
  };

  return (
    <div className="card-surface rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
      {/* Left: Twin Identity & Status */}
      <div className="space-y-1.5 max-w-xl">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
            Digital Twin Active
          </span>
          <StatusBadge status={twinState.stability_status} />
          <span className="text-xs text-slate-500 flex items-center gap-1 font-mono">
            <Clock className="w-3 h-3 text-slate-400" />
            Freshness: <strong className="text-slate-700 font-semibold">Continuous Sync (&lt; 2h)</strong>
          </span>
        </div>

        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          {currentPatient.full_name}’s Health Twin State
        </h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          {assessment.summary_message}
        </p>

        <div className="pt-1 flex items-center gap-4 text-xs text-slate-500">
          <span>Baseline Window: <strong className="text-slate-800">{currentPatient.baseline_window_days} Days</strong></span>
          <span>•</span>
          <span>Divergences: <strong className="text-slate-800">{twinState.active_alert_count} Active</strong></span>
          <span>•</span>
          <button
            onClick={() => onNavigate('digital-twin')}
            className="text-teal-700 hover:text-teal-800 font-semibold inline-flex items-center gap-1 text-xs"
          >
            Full Twin Profile <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Right: Vitality Index Indicator */}
      <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 shrink-0 self-stretch md:self-auto justify-between md:justify-start">
        <div className={`w-20 h-20 rounded-xl flex flex-col items-center justify-center border font-mono ${getVitalityBadgeColor(vitality)}`}>
          <span className="text-2xl font-black">{vitality}</span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Vitality Index</span>
        </div>
        <div className="space-y-1 text-left">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-mono">
            Mathematical Health Stability
          </span>
          <span className="text-sm font-bold text-slate-900 capitalize block">
            {twinState.stability_status.replace('_', ' ')}
          </span>
          <p className="text-[11px] text-slate-500 max-w-[190px] leading-tight">
            100% explainable deduction formula calibrated against personal baseline variance.
          </p>
        </div>
      </div>
    </div>
  );
};
