import React from 'react';
import { AlertTriangle, Database, RefreshCw, ShieldAlert } from 'lucide-react';
import { useTwin } from '../../context/TwinContext';

export const DemoBanner: React.FC = () => {
  const { isSeeding, seedDemoData, systemHealth } = useTwin();

  return (
    <div className="bg-gradient-to-r from-teal-900/40 via-slate-900/60 to-amber-950/40 border-b border-teal-500/20 px-4 py-2 text-xs text-slate-300">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
          </span>
          <span className="font-semibold text-teal-300 uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded bg-teal-950/80 border border-teal-500/30">
            Research Prototype
          </span>
          <p className="text-slate-300">
            <strong className="text-white">DEMO ENVIRONMENT:</strong> Biometrics are synthetic longitudinal test records.
            <span className="hidden sm:inline text-slate-400 ml-1">
              Engineered for early deviation tracking & preventive exploration — Not an FDA/CE diagnostic device.
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-400 hidden lg:inline">
            Storage: <span className="text-teal-300 font-mono">{systemHealth?.database.engine || 'Connecting...'}</span>
          </span>
          <button
            onClick={seedDemoData}
            disabled={isSeeding}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-teal-600/30 hover:bg-teal-600/50 text-teal-200 border border-teal-500/30 transition-all font-medium disabled:opacity-50 text-[11px]"
            title="Re-generate deterministic 90-day synthetic patient cohorts"
          >
            <RefreshCw className={`w-3 h-3 ${isSeeding ? 'animate-spin' : ''}`} />
            {isSeeding ? 'Seeding...' : 'Reset Demo Cohorts'}
          </button>
        </div>
      </div>
    </div>
  );
};
