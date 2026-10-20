import React from 'react';
import { ShieldCheck, Lock, Database, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

export const PrivacyPage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-teal-950/40 via-slate-900 to-slate-900 border border-teal-500/20 space-y-2">
        <div className="flex items-center gap-2 text-teal-400 font-bold text-xs uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4" />
          Data Governance & Provenance
        </div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">
          Privacy Architecture & Telemetry Tiers
        </h1>
        <p className="text-xs text-slate-300 leading-relaxed">
          Transparent accounting of where health metrics originate, how biometric data is compartmentalized, and how patient privacy is strictly safeguarded.
        </p>
      </div>

      {/* Data Tier Taxonomy */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-teal-400" />
          Strict 3-Tier Data Provenance Model
        </h2>
        <p className="text-xs text-slate-300 leading-relaxed">
          Every biometric observation in SwasthyaTwin is tagged with an indelible data tier to prevent user confusion between measured reality and hypothetical models:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono bg-teal-500/10 text-teal-300 border border-teal-500/20">
              Tier 1: Measured
            </span>
            <h3 className="text-xs font-bold text-white">Objective Clinical & Sensors</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Derived from continuous wearable optical photoplethysmography (PPG), ECG sensors, or certified laboratory blood assays. Highest reliability benchmark.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
              Tier 2: User Reported
            </span>
            <h3 className="text-xs font-bold text-white">Subjective & Manual Logs</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Self-reported logs such as manual blood pressure cuff readings, subjective sleep quality ratings, or dietary journals.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20">
              Tier 3: Simulated
            </span>
            <h3 className="text-xs font-bold text-white">In Silico Forecasts</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Projections computed by digital twin What-If mathematical differential models. Never treated as historic observation ground truth.
            </p>
          </div>
        </div>
      </div>

      {/* Security & Safeguards */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Lock className="w-4 h-4 text-emerald-400" />
          Security Safeguards & Synthetic Data Compliance
        </h2>
        <ul className="space-y-2 text-xs text-slate-300">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span><strong>Zero Real Patient Records:</strong> All demonstration cohorts in this hackathon distribution are synthetic, algorithmically generated mathematical trajectories designed to model real biological patterns safely.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span><strong>Zero Credential Leakage:</strong> Database connection URIs and operational credentials are strictly governed via environment variables; never exposed to frontend bundles.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span><strong>Immutable Audit Trails:</strong> Alert acknowledgements, model runs, and telemetry ingestion write timestamped records for traceability.</span>
          </li>
        </ul>
      </div>
    </div>
  );
};
