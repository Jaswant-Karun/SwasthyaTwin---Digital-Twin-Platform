import React from 'react';
import { Info, RefreshCw } from 'lucide-react';
import { useTwin } from '../../context/TwinContext';

export const DemoBanner: React.FC = () => {
  const { isSeeding, seedDemoData, systemHealth } = useTwin();

  return (
    <div className="bg-slate-100/90 border-b border-slate-200 px-4 py-1.5 text-xs text-slate-600">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-teal-100 text-teal-800 border border-teal-200">
            DEMO ENVIRONMENT
          </span>
          <p className="text-[11px] text-slate-600">
            Longitudinal biometric records are synthetic demonstration models.
            <span className="hidden md:inline ml-1 text-slate-500">
              Designed for early deviation detection and lifestyle simulation — not an approved medical device.
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={seedDemoData}
            disabled={isSeeding}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-colors font-medium text-[11px] shadow-2xs disabled:opacity-50"
            title="Reset to 90-day baseline synthetic records"
          >
            <RefreshCw className={`w-3 h-3 text-teal-600 ${isSeeding ? 'animate-spin' : ''}`} />
            {isSeeding ? 'Resetting...' : 'Reset Synthetic Cohort'}
          </button>
        </div>
      </div>
    </div>
  );
};
