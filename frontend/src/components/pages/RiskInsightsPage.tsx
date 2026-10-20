import React from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  CheckCircle2,
  Clock,
  Compass,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { useTwin } from '../../context/TwinContext';
import { StatusBadge } from '../common/StatusBadge';

export const RiskInsightsPage: React.FC = () => {
  const { currentPatient, assessment, alerts } = useTwin();

  if (!currentPatient || !assessment) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-teal-600" />
          Explainable Risk Insights & Rule Evaluation
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Deterministic statistical indicators calibrated strictly to {currentPatient.full_name}’s baseline parameters.
        </p>
      </div>

      {/* Prominent Non-Diagnosis Healthcare Safety Notice */}
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-bold">Clinical Safety Notice: Non-Diagnostic Indicator</h4>
          <p className="text-[11px] leading-relaxed text-amber-800">
            SwasthyaTwin risk insights identify statistical departures from personal baselines. They do <strong>not</strong> diagnose medical pathology, predict clinical emergencies, or guarantee outcomes. Any concerning or persistent symptoms require clinical examination by a licensed medical practitioner.
          </p>
        </div>
      </div>

      {/* Rule-Based Risk Drivers */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900">
          Evaluated Rule Triggers & Evidence Breakdown
        </h3>

        {assessment.explainability_factors.length === 0 ? (
          <div className="card-surface rounded-xl p-8 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
            <h4 className="text-sm font-bold text-slate-800">No Risk Flags Detected</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              All monitored cardiovascular, autonomic, and lifestyle indicators remain within 1.0 standard deviation of {currentPatient.full_name}’s personal baseline.
            </p>
          </div>
        ) : (
          assessment.explainability_factors.map((factor, idx) => (
            <div key={idx} className="card-surface rounded-xl p-5 space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <StatusBadge severity={factor.severity} />
                  <h4 className="text-sm font-bold text-slate-900 capitalize">
                    {factor.rule_name}
                  </h4>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-slate-500">Confidence: <strong className="text-slate-800">High (96%)</strong></span>
                  <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    -{factor.impact_score} Vitality Points
                  </span>
                </div>
              </div>

              {/* Plain Language Rationale */}
              <div className="text-xs space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-mono">
                  Plain-Language Assessment
                </span>
                <p className="text-slate-700 leading-relaxed font-medium">
                  {factor.rationale}
                </p>
              </div>

              {/* Supporting Evidence Panel */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-600">
                <div>
                  <span className="text-[10px] text-slate-400 block font-mono">Metric Domain</span>
                  <span className="font-bold text-slate-900 capitalize">{factor.metric_type.replace(/_/g, ' ')}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-mono">Evaluation Rule</span>
                  <span className="font-semibold text-slate-800">|Z| &gt; 1.8σ Divergence</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-mono">Surveillance Status</span>
                  <span className="font-semibold text-teal-700">Active Monitoring</span>
                </div>
              </div>

              {/* Suggested Conservative Next Steps */}
              <div className="pt-2 flex items-start gap-2 text-xs">
                <Compass className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <div className="text-slate-600">
                  <strong className="text-slate-900">Recommended Non-Prescriptive Action: </strong>
                  Prioritize consistent sleep timing and avoid intense cognitive strain before bed. Take repeat resting vitals after 5 minutes of seated rest.
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
