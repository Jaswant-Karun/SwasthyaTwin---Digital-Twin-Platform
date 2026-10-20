import React from 'react';
import { BookOpen, ShieldAlert, Cpu, Calculator, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';

export const MethodologyPage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-teal-950/40 via-slate-900 to-slate-900 border border-teal-500/20 space-y-2">
        <div className="flex items-center gap-2 text-teal-400 font-bold text-xs uppercase tracking-wider">
          <BookOpen className="w-4 h-4" />
          Mathematical Transparency
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          SwasthyaTwin Methodology & Scientific Rigor
        </h1>
        <p className="text-xs text-slate-300 leading-relaxed">
          Open documentation of algorithmic models, statistical formulations, and ethical boundaries driving the SwasthyaTwin personalized health digital twin.
        </p>
      </div>

      {/* Section 1: Self-Baseline Window */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Calculator className="w-4 h-4 text-teal-400" />
          1. Longitudinal Rolling Baseline Window & Outlier Winsorization
        </h2>
        <p className="text-xs text-slate-300 leading-relaxed">
          A patient’s health trajectory is benchmarked against their own past historical window $W$ (default: 30 days).
          Before calculating baseline parameters, transient hardware artifacts (e.g. sensor disconnect spikes) are filtered using non-parametric Interquartile Range (IQR) trimming:
        </p>
        <div className="p-4 rounded-xl bg-slate-950/80 font-mono text-xs text-teal-300 border border-slate-800 space-y-1">
          <p>IQR = Q3(X) - Q1(X)</p>
          <p>Valid Envelope: [Q1 - 3.0 × IQR,  Q3 + 3.0 × IQR]</p>
          <p>Baseline Mean (μ) = (1 / N) ∑ x_i</p>
          <p>Baseline Variance (σ) = √[ (1 / (N - 1)) ∑ (x_i - μ)² ]</p>
        </div>
      </div>

      {/* Section 2: Z-Score Standardizing */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          2. Standardized Deviation & Drift Classification (Z-Score)
        </h2>
        <p className="text-xs text-slate-300 leading-relaxed">
          When new telemetry enters the digital twin, its distance from the patient's individual baseline is calculated via standardized Z-score:
        </p>
        <div className="p-4 rounded-xl bg-slate-950/80 font-mono text-xs text-cyan-300 border border-slate-800">
          Z_m = ( Current_Value_m - μ_m ) / σ_m
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1 text-xs">
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
            <span className="font-bold block">|Z| &lt; 1.0σ</span>
            <span className="text-[11px] text-slate-400">Optimal Baseline</span>
          </div>
          <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
            <span className="font-bold block">1.0σ ≤ |Z| &lt; 2.0σ</span>
            <span className="text-[11px] text-slate-400">Mild Fluctuation</span>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
            <span className="font-bold block">2.0σ ≤ |Z| &lt; 3.0σ</span>
            <span className="text-[11px] text-slate-400">Moderate Drift</span>
          </div>
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300">
            <span className="font-bold block">|Z| ≥ 3.0σ</span>
            <span className="text-[11px] text-slate-400">Significant Deviation</span>
          </div>
        </div>
      </div>

      {/* Section 3: Health Stability Index */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Cpu className="w-4 h-4 text-emerald-400" />
          3. Explainable Health Stability Index (0 - 100)
        </h2>
        <p className="text-xs text-slate-300 leading-relaxed">
          The Vitality Index begins at 100. Any point deduction is mathematically linked to biometric deviations exceeding 1.0 standard deviation from the patient's personal baseline:
        </p>
        <div className="p-4 rounded-xl bg-slate-950/80 font-mono text-xs text-emerald-300 border border-slate-800">
          Index = 100 - ∑ [ w_k × min(30, max(0, (|Z_k| - 1.0) × 12)) ]
        </div>
        <p className="text-xs text-slate-400">
          Weights ($w_k$): Heart Rate (0.22), Systolic BP (0.20), Diastolic BP (0.15), HRV (0.15), Sleep (0.15), Daily Steps (0.08), SpO2 (0.05).
        </p>
      </div>

      {/* Section 4: What-If Simulation Physics */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Calculator className="w-4 h-4 text-purple-400" />
          4. What-If Physiological In Silico Adaptation Dynamics
        </h2>
        <p className="text-xs text-slate-300 leading-relaxed">
          The What-If counterfactual model simulates cardiovascular and autonomic adaptation using exponential saturation curves grounded in exercise physiology and sleep medicine:
        </p>
        <div className="p-4 rounded-xl bg-slate-950/80 font-mono text-xs text-purple-300 border border-slate-800 space-y-1">
          <p>Δ Metric(t) = Target_Delta × (1 - e^( -t / τ ))</p>
          <p>Time constants: τ_sleep ≈ 4.0 days,  τ_activity ≈ 12.0 days,  τ_sodium ≈ 7.0 days</p>
          <p>Predictive 90% Confidence Interval: y(t) ± 1.645 × σ × √( 1 + t / T_horizon )</p>
        </div>
      </div>

      {/* Regulatory Notice */}
      <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 space-y-1.5">
        <div className="flex items-center gap-1.5 font-bold text-rose-400">
          <ShieldAlert className="w-4 h-4" />
          <span>Research Prototype Disclaimer</span>
        </div>
        <p>
          SwasthyaTwin is created for hackathon demonstration, educational exploratory research, and proactive wellness insights.
          It is not a clinical diagnostic device and must not replace professional clinical judgment or emergency services.
        </p>
      </div>
    </div>
  );
};
