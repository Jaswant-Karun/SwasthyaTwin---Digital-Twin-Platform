import React, { useState } from 'react';
import {
  BookOpen,
  ShieldAlert,
  Cpu,
  Calculator,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  Info,
  Clock,
  Sparkles,
  Sliders,
  Check
} from 'lucide-react';

export const MethodologyPage: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const copyDocLink = () => {
    navigator.clipboard?.writeText('docs/calculation-methodology.md');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Title & Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-teal-950/60 via-slate-900 to-slate-900 border border-teal-500/20 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-teal-400 font-bold text-xs uppercase tracking-wider">
            <BookOpen className="w-4 h-4" />
            Mathematical & Algorithmic Transparency
          </div>
          <button
            onClick={copyDocLink}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-mono text-teal-300 border border-slate-700 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Info className="w-3.5 h-3.5 text-teal-400" />}
            <span>{copied ? 'Copied Path!' : 'docs/calculation-methodology.md'}</span>
          </button>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          SwasthyaTwin Calculation Engine Methodology
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-3xl">
          Complete, plain-language disclosure of personal baseline formulas, deviation mathematics, explainable demonstration rules, composite indicators, and in silico simulation physics.
        </p>
      </div>

      {/* Synthetic Baseline Example Highlight Box */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/30 space-y-4 shadow-lg">
        <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider font-mono">
          <Sparkles className="w-4 h-4" />
          Worked Example: How a Personal Baseline Works
        </div>
        <p className="text-xs text-slate-300">
          Illustrative synthetic example — not a real patient or clinical recommendation. Demonstrates why self-baselining outperforms static population norms.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-mono">Day 1</span>
            <span className="text-base font-bold text-white font-mono">70 bpm</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-mono">Day 2</span>
            <span className="text-base font-bold text-white font-mono">72 bpm</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-mono">Day 3</span>
            <span className="text-base font-bold text-white font-mono">71 bpm</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-mono">Day 4</span>
            <span className="text-base font-bold text-white font-mono">73 bpm</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-mono">Day 5</span>
            <span className="text-base font-bold text-white font-mono">74 bpm</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <span className="text-[11px] font-bold text-indigo-300 uppercase">1. Personal Baseline (Median)</span>
            <p className="font-mono text-xs text-teal-300">Median(70, 71, 72, 73, 74) = 72 bpm</p>
            <p className="text-[11px] text-slate-400">Sample median protects against transient sensor spikes distorting the true resting baseline.</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <span className="text-[11px] font-bold text-indigo-300 uppercase">2. Absolute Deviation (at 84 bpm)</span>
            <p className="font-mono text-xs text-amber-300">Δ = 84 - 72 = +12.0 bpm</p>
            <p className="text-[11px] text-slate-400">Direct absolute deviation from the patient's own central historical baseline.</p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
            <span className="text-[11px] font-bold text-indigo-300 uppercase">3. Relative Deviation</span>
            <p className="font-mono text-xs text-cyan-300">((84 - 72) / 72) × 100 = +16.7%</p>
            <p className="text-[11px] text-slate-400">A measurable 16.7% deviation above personal baseline, not proof of a medical condition.</p>
          </div>
        </div>
      </div>

      {/* Section A: Personal Baselines & Missing Data Policy */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Calculator className="w-4 h-4 text-teal-400" />
          A. Personal Baselines (Anti-Population Norm Architecture)
        </h2>
        <p className="text-xs text-slate-300 leading-relaxed">
          Every biometric metric is benchmarked against the patient’s own historical rolling window (default: 30 days; configurable from 7 to 180 days).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-4 rounded-xl bg-slate-950/80 font-mono text-teal-300 border border-slate-800 space-y-1">
            <p className="font-bold text-white mb-1 font-sans">Median & Robust IQR Formulation</p>
            <p>Baseline = Median(X_window)</p>
            <p>IQR = Q3(X) - Q1(X)</p>
            <p>Tukey Fences = [Q1 - 3.0×IQR, Q3 + 3.0×IQR]</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-950/80 text-slate-300 border border-slate-800 space-y-1">
            <p className="font-bold text-white mb-1">Data Governance Rules</p>
            <ul className="list-disc list-inside space-y-1 text-[11px]">
              <li><strong>Missing Values:</strong> Explicitly excluded; never treated as zero.</li>
              <li><strong>Sample Sufficiency:</strong> Requires min 3 readings; sparse baselines flag <code>is_sufficient: false</code>.</li>
              <li><strong>Simulation Isolation:</strong> Simulated observations are strictly excluded from measured baselines unless explicitly requested and labeled.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Section B: Deviation Analysis & Mathematical Guardrails */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          B. Deviation Analysis & Meaningful Relative Percentages
        </h2>
        <p className="text-xs text-slate-300 leading-relaxed">
          Calculates absolute deviation and relative percentage change with strict mathematical safeguards against misleading metrics:
        </p>
        <div className="p-4 rounded-xl bg-slate-950/80 font-mono text-xs text-cyan-300 border border-slate-800 space-y-1">
          <p>absolute_deviation = current_value - baseline</p>
          <p>relative_deviation_percent = 100 * (current_value - baseline) / abs(baseline)  [when meaningful]</p>
        </div>
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200 space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Where Relative Deviation is Excluded as Misleading</span>
          </div>
          <p className="text-[11px] leading-relaxed">
            <strong>1. Bounded Saturation (SpO2):</strong> Oxygen saturation is already a percentage (0–100%). A drop from 98% to 94% is clinically described as a <strong>4 percentage point drop</strong>, not -4.08%. Relative percentages of percentages are misleading in medicine and are set to <code>null</code>.<br />
            <strong>2. Interval Temperature Scales:</strong> Celsius and Fahrenheit have arbitrary zero points; relative percentage is mathematically undefined.<br />
            <strong>3. Zero Baselines:</strong> Division by zero is suppressed.
          </p>
        </div>
      </div>

      {/* Section C: Explainable Demonstration Rules Table */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          C. Configurable Demonstration Rules & Explainable Flags
        </h2>
        <p className="text-xs text-slate-300 leading-relaxed">
          Demonstration research heuristics evaluate persistent deviations. They do <strong>not</strong> assign arbitrary disease probabilities or claim emergency triage predictions.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border border-slate-800">
            <thead className="bg-slate-950 text-slate-400 font-mono text-[11px] border-b border-slate-800">
              <tr>
                <th className="p-2.5">Rule ID</th>
                <th className="p-2.5">Metric</th>
                <th className="p-2.5">Warning / Crit Threshold</th>
                <th className="p-2.5">Persistence</th>
                <th className="p-2.5">Category</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              <tr className="hover:bg-slate-800/40">
                <td className="p-2.5 font-mono text-teal-400">DEMO-HR-ELEV-01</td>
                <td className="p-2.5 font-medium text-white">Resting HR</td>
                <td className="p-2.5 font-mono">Z ≥ +1.8 / +3.0</td>
                <td className="p-2.5">2 readings</td>
                <td className="p-2.5 text-amber-300">Informational Trend / Clinical Review</td>
              </tr>
              <tr className="hover:bg-slate-800/40">
                <td className="p-2.5 font-mono text-teal-400">DEMO-BP-SYS-ELEV-01</td>
                <td className="p-2.5 font-medium text-white">Systolic BP</td>
                <td className="p-2.5 font-mono">Z ≥ +1.8 / +2.8</td>
                <td className="p-2.5">2 readings</td>
                <td className="p-2.5 text-amber-300">Informational Trend / Clinical Review</td>
              </tr>
              <tr className="hover:bg-slate-800/40">
                <td className="p-2.5 font-mono text-teal-400">DEMO-SPO2-DROP-01</td>
                <td className="p-2.5 font-medium text-white">SpO2 Saturation</td>
                <td className="p-2.5 font-mono">Z ≤ -2.0 or &lt; 94%</td>
                <td className="p-2.5">1 reading</td>
                <td className="p-2.5 text-rose-400 font-semibold">Warrants Professional Review</td>
              </tr>
              <tr className="hover:bg-slate-800/40">
                <td className="p-2.5 font-mono text-teal-400">DEMO-HRV-SUPP-01</td>
                <td className="p-2.5 font-medium text-white">HRV (RMSSD)</td>
                <td className="p-2.5 font-mono">Z ≤ -1.8 / -2.8</td>
                <td className="p-2.5">1 reading</td>
                <td className="p-2.5 text-cyan-300">Informational Trend</td>
              </tr>
              <tr className="hover:bg-slate-800/40">
                <td className="p-2.5 font-mono text-teal-400">DEMO-SLEEP-DEF-01</td>
                <td className="p-2.5 font-medium text-white">Sleep Duration</td>
                <td className="p-2.5 font-mono">Z ≤ -1.5 / -2.5</td>
                <td className="p-2.5">2 nights</td>
                <td className="p-2.5 text-cyan-300">Informational Trend</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Section D: Composite Indicator Transparency */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Cpu className="w-4 h-4 text-emerald-400" />
          D. Composite Experimental Health Stability Trend Indicator (0 - 100)
        </h2>
        <p className="text-xs text-slate-300 leading-relaxed">
          SwasthyaTwin prioritizes measurement-specific indicators. For high-level orientation, an explainable Health Stability Index is computed:
        </p>
        <div className="p-4 rounded-xl bg-slate-950/80 font-mono text-xs text-emerald-300 border border-slate-800">
          Index = 100 - [ ( ∑ w_i × min(30, max(0, (|Z_i| - 1.0) × 12)) ) / ∑ w_active ]
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          <strong>Missing Input Policy:</strong> Active weights (w_active) normalize out untracked biometrics so missing telemetry never induces an artificial penalty or fabricated zero.<br />
          <strong>Weights:</strong> Resting HR (0.22), Systolic BP (0.20), Diastolic BP (0.15), HRV (0.15), Sleep (0.15), Steps (0.08), SpO2 (0.05).
        </p>
      </div>

      {/* Section E: What-If Simulation Physics */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Sliders className="w-4 h-4 text-purple-400" />
          E. What-If Physiological In Silico Adaptation Dynamics
        </h2>
        <p className="text-xs text-slate-300 leading-relaxed">
          The counterfactual simulation engine is deterministic and models cardiovascular/autonomic adaptation using exponential response curves:
        </p>
        <div className="p-4 rounded-xl bg-slate-950/80 font-mono text-xs text-purple-300 border border-slate-800 space-y-1">
          <p>Δ Metric(t) = Target_Delta × (1 - e^( -t / τ ))</p>
          <p>Time constants: τ_sleep ≈ 4.0 days,  τ_activity ≈ 12.0 days,  τ_sodium ≈ 7.0 days</p>
          <p>Predictive 90% Confidence Interval: y(t) ± 1.645 × σ × √( 1 + t / T_horizon )</p>
        </div>
        <p className="text-[11px] text-slate-400">
          <strong>Non-Causal Disclosure:</strong> Observed telemetry is never modified. Changing sleep or activity does not guarantee a specific clinical outcome; individual response varies according to genetics, comorbidities, and medications.
        </p>
      </div>

      {/* Research Disclaimer */}
      <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 space-y-1.5">
        <div className="flex items-center gap-1.5 font-bold text-rose-400">
          <ShieldAlert className="w-4 h-4" />
          <span>Clinical & Ethical Boundaries</span>
        </div>
        <p>
          SwasthyaTwin is a research prototype for longitudinal self-baseline surveillance. It is non-diagnostic, non-prescriptive, and must not replace professional clinical evaluation or emergency medical care.
        </p>
      </div>
    </div>
  );
};
