import React, { useEffect, useRef } from 'react';
import {
  X,
  HelpCircle,
  Calculator,
  Calendar,
  Layers,
  Database,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Info,
  ArrowRight,
  TrendingUp,
  Activity
} from 'lucide-react';
import { CalculationExplanation } from '../../types';

interface ExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
  explanation: CalculationExplanation | null;
  isLoading?: boolean;
}

export const ExplanationModal: React.FC<ExplanationModalProps> = ({
  isOpen,
  onClose,
  explanation,
  isLoading = false
}) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      // Focus close button on open for accessibility
      setTimeout(() => closeButtonRef.current?.focus(), 50);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getResultTypeBadge = (type: string) => {
    switch (type) {
      case 'Rule-Based Indicator':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Model Prediction':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Statistical Estimate':
      default:
        return 'bg-teal-50 text-teal-700 border-teal-200';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="explanation-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 shrink-0 mt-0.5">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-slate-500">
                  Transparency & Explainability
                </span>
                {explanation && (
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${getResultTypeBadge(
                      explanation.result_type
                    )}`}
                  >
                    {explanation.result_type}
                  </span>
                )}
              </div>
              <h2 id="explanation-modal-title" className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                {explanation?.title || 'Calculation Explanation'}
              </h2>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close calculation explanation modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
          {isLoading || !explanation ? (
            <div className="py-12 text-center space-y-3">
              <Calculator className="w-8 h-8 text-teal-600 animate-spin mx-auto" />
              <p className="font-semibold text-slate-600">Retrieving calculation metadata and worked example...</p>
            </div>
          ) : (
            <>
              {/* Top Overview Grid: Item 1, 2, 3, 4 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* 1. Current value and unit */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-0.5">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block font-semibold">
                    1. Current Value
                  </span>
                  <span className="text-sm sm:text-base font-bold text-slate-900 font-mono block">
                    {explanation.current_value_formatted}
                  </span>
                  <span className="text-[10px] text-slate-500">Unit: {explanation.unit || 'standard'}</span>
                </div>

                {/* 2. Patient's baseline */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-0.5">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block font-semibold">
                    2. Personal Baseline
                  </span>
                  <span className="text-sm font-bold text-teal-700 font-mono block truncate" title={explanation.baseline_formatted || 'Not Established'}>
                    {(explanation.baseline_formatted || 'Not Established').split('(')[0].trim() || 'Not Established'}
                  </span>
                  <span className="text-[10px] text-slate-500 truncate block" title={explanation.baseline_formatted || 'Self-anchor'}>
                    {explanation.baseline_formatted && explanation.baseline_formatted.includes('(') ? `(${explanation.baseline_formatted.split('(')[1]}` : 'Self-anchor'}
                  </span>
                </div>

                {/* 3. Historical window used */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-0.5">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block font-semibold">
                    3. Window Used
                  </span>
                  <span className="text-sm font-bold text-slate-900 font-mono block">
                    {explanation.window_days} Days
                  </span>
                  <span className="text-[10px] text-slate-500 truncate block" title={explanation.historical_window}>
                    Rolling history
                  </span>
                </div>

                {/* 4. Number of observations used */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-0.5">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block font-semibold">
                    4. Sample Count
                  </span>
                  <span className="text-sm font-bold text-slate-900 font-mono block">
                    {explanation.observations_count} Readings
                  </span>
                  <span
                    className={`text-[10px] font-semibold block truncate ${
                      explanation.is_sufficient ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                    title={explanation.observations_sufficiency}
                  >
                    {explanation.is_sufficient ? 'Sufficient (≥14)' : 'Preliminary (<14)'}
                  </span>
                </div>
              </div>

              {/* Warnings Banner: Item 9 */}
              {explanation.warnings && explanation.warnings.length > 0 && (
                <div
                  className={`p-3.5 rounded-xl border flex items-start gap-2.5 ${
                    explanation.is_stale || explanation.is_missing_data
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <AlertTriangle
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      explanation.is_stale || explanation.is_missing_data ? 'text-amber-600' : 'text-slate-500'
                    }`}
                  />
                  <div className="space-y-0.5 text-xs">
                    <span className="font-bold block">
                      {explanation.is_missing_data
                        ? 'Missing Data / Telemetry Notice'
                        : explanation.is_stale
                        ? 'Data Freshness Warning'
                        : 'Calculation Quality Notes'}
                    </span>
                    <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                      {explanation.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* 5. Formula Applied */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                  <Calculator className="w-4 h-4 text-teal-600" />
                  <span>5. Mathematical Formula Applied</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto border border-slate-800 space-y-1.5">
                  <div className="text-teal-400 font-bold text-[11px]">{explanation.formula_name}</div>
                  <div className="text-slate-200 text-xs sm:text-sm font-semibold tracking-wide">
                    {explanation.formula_latex_or_text}
                  </div>
                  <p className="text-[11px] text-slate-400 font-sans leading-relaxed pt-1 border-t border-slate-800">
                    {explanation.formula_explanation}
                  </p>
                </div>
              </div>

              {/* 6. Worked Numerical Example Matching Displayed Data */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <Activity className="w-4 h-4 text-teal-600" />
                    <span>6. Worked Numerical Example (Patient's Displayed Data)</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Step-by-step audit trail</span>
                </div>

                <div className="space-y-2">
                  {explanation.worked_example_steps.map((step) => (
                    <div
                      key={step.step_number}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-900">
                          Step {step.step_number}: {step.title}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-50 text-teal-800 font-semibold border border-teal-200">
                          {step.result}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600">{step.description}</p>
                      <pre className="p-2 rounded-lg bg-white border border-slate-200 text-[11px] font-mono text-slate-800 whitespace-pre-wrap leading-relaxed">
                        {step.calculation}
                      </pre>
                    </div>
                  ))}
                </div>

                {/* Worked summary card */}
                <div className="p-3 rounded-xl bg-teal-50/70 border border-teal-200 text-teal-950 font-medium text-xs leading-relaxed">
                  <strong className="text-teal-900">Verification Summary: </strong>
                  {explanation.worked_example_summary}
                </div>
              </div>

              {/* 7. Data source & latest observation timestamp */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                  <Database className="w-4 h-4 text-teal-600" />
                  <span>7. Provenance, Data Source & Freshness</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-mono uppercase block font-semibold">
                      Telemetry Data Source
                    </span>
                    <span className="font-bold text-slate-800 font-mono block mt-0.5">
                      {explanation.data_source}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-mono uppercase block font-semibold">
                      Latest Observation Timestamp
                    </span>
                    <span className="font-semibold text-slate-800 block mt-0.5 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      {explanation.latest_timestamp_formatted}
                    </span>
                  </div>
                </div>
              </div>

              {/* 8. Reason trend flag or alert was generated */}
              {explanation.reason_flag_or_alert && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <TrendingUp className="w-4 h-4 text-teal-600" />
                    <span>8. Reason Trend Flag / Alert Was Generated</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed">
                    {explanation.reason_flag_or_alert}
                  </div>
                </div>
              )}

              {/* 10. Limitations & Indicator Classification */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                  <ShieldAlert className="w-4 h-4 text-teal-600" />
                  <span>10. Methodology Classification & Limitations</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 font-semibold">Analytical Type:</span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${getResultTypeBadge(
                        explanation.result_type
                      )}`}
                    >
                      {explanation.result_type}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    <strong>Clinical Safety Disclaimer: </strong>
                    {explanation.limitations}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            Deterministic calculation metadata from SwasthyaTwin Analytics Engine.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs transition-colors shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
