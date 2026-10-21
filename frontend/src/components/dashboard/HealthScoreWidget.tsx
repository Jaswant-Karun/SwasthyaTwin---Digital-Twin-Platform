import React from 'react';
import { ShieldCheck, Info, AlertTriangle, ArrowRight } from 'lucide-react';
import { useTwin } from '../../context/TwinContext';
import { HowCalculatedButton } from '../common/HowCalculatedButton';

interface HealthScoreWidgetProps {
  onLearnMore?: () => void;
}

export const HealthScoreWidget: React.FC<HealthScoreWidgetProps> = ({ onLearnMore }) => {
  const { assessment } = useTwin();

  if (!assessment) return null;

  const factors = assessment.explainability_factors;

  return (
    <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-teal-400" />
          <h3 className="text-sm font-bold text-white">Vitality Index Explainability</h3>
        </div>
        <div className="flex items-center gap-2">
          <HowCalculatedButton
            category="trend"
            itemId="vitality_index"
            variant="button"
            className="bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700 hover:text-white"
          />
          {onLearnMore && (
            <button
              onClick={onLearnMore}
              className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1 font-semibold"
            >
              Formula & Math <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">
        SwasthyaTwin does not use black-box probabilities. Vitality score starts at <strong className="text-slate-200">100</strong>, with transparent deductions based strictly on your statistical distance (|Z| &gt; 1.0) from your own historical baseline:
      </p>

      {factors.length === 0 ? (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>All tracked vital biometrics are within 1.0 standard deviation of your personalized baseline. Zero deductions applied.</span>
        </div>
      ) : (
        <div className="space-y-2">
          {factors.map((f, i) => (
            <div
              key={i}
              className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between text-xs gap-3"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white capitalize">{f.metric_type.replace(/_/g, ' ')}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    -{f.impact_score} pts
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">{f.rationale}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
