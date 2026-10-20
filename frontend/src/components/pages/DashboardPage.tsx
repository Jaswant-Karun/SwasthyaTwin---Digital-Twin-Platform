import React, { useState } from 'react';
import { useTwin } from '../../context/TwinContext';
import { TwinStatusHero } from '../dashboard/TwinStatusHero';
import { PatientProfileCard } from '../dashboard/PatientProfileCard';
import { MetricCard } from '../dashboard/MetricCard';
import { HealthScoreWidget } from '../dashboard/HealthScoreWidget';
import { LongitudinalChart } from '../charts/LongitudinalChart';
import { SelfBaselineComparison } from '../comparison/SelfBaselineComparison';
import { GitCompare, LineChart, Sparkles } from 'lucide-react';

interface DashboardPageProps {
  onNavigateTab: (tab: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigateTab }) => {
  const { twinState, currentPatient, isLoading } = useTwin();
  const [selectedMetric, setSelectedMetric] = useState<string>('heart_rate');

  if (isLoading && !twinState) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-44 bg-slate-900/60 rounded-3xl border border-slate-800" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-slate-900/40 rounded-2xl border border-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  const metricList = twinState ? Object.values(twinState.metrics) : [];

  return (
    <div className="space-y-6">
      {/* Hero: Dynamic Twin Status */}
      <TwinStatusHero />

      {/* Grid: Patient Demographic Card + Metric Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <PatientProfileCard />
        </div>
        <div className="lg:col-span-2">
          <HealthScoreWidget onLearnMore={() => onNavigateTab('methodology')} />
        </div>
      </div>

      {/* Biometric Deviations Matrix Cards */}
      <div>
        <div className="flex items-center justify-between mb-3.5">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-400" />
              Real-Time Biometric Deviations from Self-Baseline
            </h3>
            <p className="text-xs text-slate-400">
              Evaluated strictly against {currentPatient?.full_name}’s historical distribution.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('comparison')}
            className="text-xs text-teal-400 hover:text-teal-300 font-semibold flex items-center gap-1"
          >
            <GitCompare className="w-3.5 h-3.5" />
            Full Matrix
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {metricList.map((dev) => (
            <MetricCard
              key={dev.metric_type}
              deviation={dev}
              isSelected={selectedMetric === dev.metric_type}
              onSelect={() => setSelectedMetric(dev.metric_type)}
            />
          ))}
        </div>
      </div>

      {/* Longitudinal Graph */}
      <LongitudinalChart />
    </div>
  );
};
