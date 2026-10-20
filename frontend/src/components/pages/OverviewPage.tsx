import React from 'react';
import { useTwin } from '../../context/TwinContext';
import { OverviewTwinStatusPanel } from '../dashboard/OverviewTwinStatusPanel';
import { OverviewMetricCards } from '../dashboard/OverviewMetricCards';
import { InteractiveHistoricalChart } from '../charts/InteractiveHistoricalChart';
import { OverviewBaselinePanel } from '../dashboard/OverviewBaselinePanel';
import { OverviewTrendAndAlerts } from '../dashboard/OverviewTrendAndAlerts';
import { User, Activity, Clock, ShieldCheck, Stethoscope, BookOpen } from 'lucide-react';

interface OverviewPageProps {
  onNavigate: (tab: string) => void;
  selectedRange: number;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ onNavigate, selectedRange }) => {
  const { currentPatient, twinState, isLoading } = useTwin();

  if (isLoading && !twinState) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-28 bg-white rounded-xl border border-slate-200" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-white rounded-xl border border-slate-200" />
          ))}
        </div>
        <div className="h-72 bg-white rounded-xl border border-slate-200" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Welcome Header & Patient Summary */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Patient Health Overview
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Personalized longitudinal biometric surveillance for <strong className="text-slate-800">{currentPatient?.full_name}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('methodology')}
            className="flex items-center gap-1.5 bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-800 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-teal-300 text-xs font-semibold shadow-2xs transition-all"
            title="Inspect calculation methodology and formulas"
          >
            <BookOpen className="w-3.5 h-3.5 text-teal-600" />
            <span>Methodology</span>
          </button>

          {currentPatient && (
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs shadow-2xs">
              <Stethoscope className="w-4 h-4 text-teal-600" />
              <span className="text-slate-600">
                Physician: <strong className="text-slate-900">{currentPatient.primary_physician || 'Preventive Medicine'}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Compact Digital Twin Status Panel (last updated time & data freshness) */}
      <OverviewTwinStatusPanel onNavigate={onNavigate} />

      {/* 3. Four Core Metric Cards (Heart Rate, BP, Sleep, Activity) */}
      <OverviewMetricCards />

      {/* 4. Large Interactive Multi-Series Chart */}
      <InteractiveHistoricalChart initialDays={selectedRange} />

      {/* 5. Patient-Specific Baseline Comparison Panel */}
      <OverviewBaselinePanel onNavigate={onNavigate} />

      {/* 6. Explainable Health-Trend Indicator & Alert Panel */}
      <OverviewTrendAndAlerts onNavigate={onNavigate} />
    </div>
  );
};
