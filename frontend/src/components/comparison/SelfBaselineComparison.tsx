import React from 'react';
import { GitCompare, ShieldCheck, AlertCircle, ArrowUpRight, ArrowDownRight, Minus, HelpCircle } from 'lucide-react';
import { useTwin } from '../../context/TwinContext';
import { StatusBadge } from '../common/StatusBadge';

export const SelfBaselineComparison: React.FC = () => {
  const { currentPatient, twinState } = useTwin();

  if (!currentPatient || !twinState) return null;

  const metrics = Object.values(twinState.metrics);

  return (
    <div className="space-y-6">
      {/* Educational Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-teal-950/40 via-slate-900 to-indigo-950/30 border border-teal-500/20">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 shrink-0">
            <GitCompare className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Personal Self-Baseline Architecture
              <span className="text-[10px] bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded font-mono uppercase font-bold">
                Anti-Population Norm
              </span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Standard clinical dashboards judge every human against generic population distributions (e.g. 60–100 bpm).
              However, for an endurance runner, 76 bpm may represent acute autonomic fatigue or infection; for another person, 76 bpm is completely optimal.
              <strong className="text-teal-300"> SwasthyaTwin benchmarks {currentPatient.full_name} exclusively against their own {currentPatient.baseline_window_days}-day longitudinal rolling window.</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Comparison Matrix Table */}
      <div className="overflow-hidden rounded-2xl bg-slate-900/60 border border-slate-800">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-white">Biometric Deviation Matrix</h3>
            <p className="text-xs text-slate-400">Comparing current telemetry snapshot against individual {currentPatient.baseline_window_days}-day statistics</p>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Patient ID: <span className="text-white font-bold">{currentPatient.patient_id}</span>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[10px] font-mono border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Biometric Metric</th>
                <th className="py-3 px-4">Current Value</th>
                <th className="py-3 px-4">Personal Baseline (μ)</th>
                <th className="py-3 px-4">Baseline StdDev (σ)</th>
                <th className="py-3 px-4">Delta vs Self</th>
                <th className="py-3 px-4">Standardized Z-Score</th>
                <th className="py-3 px-4">Stability Tier</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {metrics.map((m) => {
                const isElevated = m.direction === 'elevated';
                const isSuppressed = m.direction === 'suppressed';
                const deltaStr = m.delta_percentage > 0 ? `+${m.delta_percentage}%` : `${m.delta_percentage}%`;

                return (
                  <tr key={m.metric_type} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-white capitalize">
                      {m.metric_type.replace(/_/g, ' ')}
                      <span className="block text-[10px] text-slate-500 font-mono lowercase">tier: {m.data_tier}</span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-white font-mono text-sm">
                      {m.metric_type === 'daily_steps' ? Math.round(m.current_value).toLocaleString() : m.current_value.toFixed(1)}
                      <span className="text-[11px] font-normal text-slate-400 ml-1">{m.unit}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 font-mono">
                      {m.metric_type === 'daily_steps' ? Math.round(m.baseline_mean).toLocaleString() : m.baseline_mean.toFixed(1)} {m.unit}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 font-mono">
                      ±{m.baseline_std.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 font-bold">
                      <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[11px] font-mono ${
                        m.status === 'optimal'
                          ? 'text-emerald-400 bg-emerald-500/10'
                          : m.status === 'mild_deviation'
                          ? 'text-cyan-400 bg-cyan-500/10'
                          : m.status === 'moderate_drift'
                          ? 'text-amber-400 bg-amber-500/10'
                          : 'text-rose-400 bg-rose-500/10'
                      }`}>
                        {isElevated ? <ArrowUpRight className="w-3 h-3" /> : isSuppressed ? <ArrowDownRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                        {deltaStr}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold">
                      <span className={Math.abs(m.z_score) >= 2.0 ? 'text-rose-400' : 'text-slate-300'}>
                        {m.z_score > 0 ? `+${m.z_score.toFixed(2)}` : m.z_score.toFixed(2)}σ
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={m.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
