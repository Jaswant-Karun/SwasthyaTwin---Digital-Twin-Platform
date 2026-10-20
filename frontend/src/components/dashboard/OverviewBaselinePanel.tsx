import React from 'react';
import { GitCompare, ArrowUpRight, ArrowDownRight, Minus, BookOpen } from 'lucide-react';
import { useTwin } from '../../context/TwinContext';
import { StatusBadge } from '../common/StatusBadge';

export const OverviewBaselinePanel: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const { currentPatient, twinState } = useTwin();

  if (!currentPatient || !twinState) return null;

  const metrics = Object.values(twinState.metrics).slice(0, 5);

  return (
    <div className="card-surface rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-teal-600" />
            Patient Self-Baseline Comparison Matrix
          </h3>
          <p className="text-xs text-slate-500">
            Comparing current observations against {currentPatient.full_name}’s own {currentPatient.baseline_window_days}-day baseline (Anti-Population Norm).
          </p>
        </div>

        <button
          onClick={() => onNavigate('health-trends')}
          className="text-xs text-teal-700 hover:text-teal-800 font-semibold flex items-center gap-1"
        >
          Detailed Analysis →
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px] font-mono border-b border-slate-100">
            <tr>
              <th className="py-2.5 px-3">Biometric</th>
              <th className="py-2.5 px-3">Observed Current</th>
              <th className="py-2.5 px-3">Personal Baseline (μ)</th>
              <th className="py-2.5 px-3">Delta vs Self</th>
              <th className="py-2.5 px-3">Z-Score</th>
              <th className="py-2.5 px-3">Stability Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {metrics.map((m) => {
              const isElevated = m.direction === 'elevated';
              const isSuppressed = m.direction === 'suppressed';
              const deltaStr = m.delta_percentage > 0 ? `+${m.delta_percentage}%` : `${m.delta_percentage}%`;

              return (
                <tr key={m.metric_type} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 px-3 font-semibold text-slate-900 capitalize">
                    {m.metric_type.replace(/_/g, ' ')}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                    {m.metric_type === 'daily_steps' ? Math.round(m.current_value).toLocaleString() : m.current_value.toFixed(1)} {m.unit}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 font-mono">
                    {m.metric_type === 'daily_steps' ? Math.round(m.baseline_mean).toLocaleString() : m.baseline_mean.toFixed(1)} {m.unit}
                  </td>
                  <td className="py-2.5 px-3 font-semibold">
                    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-mono ${
                      m.status === 'optimal'
                        ? 'text-emerald-700 bg-emerald-50'
                        : m.status === 'mild_deviation'
                        ? 'text-cyan-700 bg-cyan-50'
                        : m.status === 'moderate_drift'
                        ? 'text-amber-700 bg-amber-50'
                        : 'text-rose-700 bg-rose-50'
                    }`}>
                      {isElevated ? <ArrowUpRight className="w-3 h-3" /> : isSuppressed ? <ArrowDownRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                      {deltaStr}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-700">
                    <span className={Math.abs(m.z_score) >= 2 ? 'text-rose-600 font-bold' : ''}>
                      {m.z_score > 0 ? `+${m.z_score.toFixed(1)}` : m.z_score.toFixed(1)}σ
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <StatusBadge status={m.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
