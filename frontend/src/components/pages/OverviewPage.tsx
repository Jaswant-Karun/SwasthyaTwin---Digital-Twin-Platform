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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Patient Health Overview
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Personalized longitudinal biometric surveillance for <strong className="text-teal-300">{currentPatient?.full_name}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('digital-twin')}
            className="flex items-center gap-1.5 bg-gradient-to-r from-teal-500/20 to-cyan-500/20 hover:from-teal-500/30 hover:to-cyan-500/30 text-cyan-200 px-3.5 py-1.5 rounded-xl border border-cyan-500/40 text-xs font-bold shadow-lg shadow-cyan-950/40 transition-all"
            title="Launch Autonomous Spatial Human Digital Twin"
          >
            <Activity className="w-4 h-4 text-cyan-400" />
            <span>Launch Spatial Twin</span>
          </button>

          <button
            onClick={() => onNavigate('methodology')}
            className="flex items-center gap-1.5 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl border border-white/10 text-xs font-semibold transition-all"
            title="Inspect calculation methodology and formulas"
          >
            <BookOpen className="w-3.5 h-3.5 text-teal-400" />
            <span>Methodology</span>
          </button>

          {currentPatient && (
            <div className="hidden sm:flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-white/10 text-xs text-slate-300">
              <Stethoscope className="w-4 h-4 text-teal-400" />
              <span>
                Physician: <strong className="text-white">{currentPatient.primary_physician || 'Preventive Medicine'}</strong>
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
