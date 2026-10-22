import React, { useState } from 'react';
import { LineChart as LineChartIcon, Heart, Activity, Calendar } from 'lucide-react';
import { useTwin } from '../../context/TwinContext';
import { InteractiveHistoricalChart } from '../charts/InteractiveHistoricalChart';
import { CardiovascularIntelligenceWorkspace } from '../cardiovascular/CardiovascularIntelligenceWorkspace';

export const HealthTrendsPage: React.FC = () => {
  const { currentPatient } = useTwin();
  const [selectedRange, setSelectedRange] = useState<number>(30);
  const [activeSubTab, setActiveSubTab] = useState<'cardio-intelligence' | 'multisignal'>('cardio-intelligence');

  return (
    <div className="space-y-6">
      {/* Header with Sub-tab Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <LineChartIcon className="w-6 h-6 text-teal-400" />
            Longitudinal Health Dynamics & Anomaly Intelligence
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Evaluate time-series trajectories benchmarked strictly against {currentPatient?.full_name}’s own biological baseline.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setActiveSubTab('cardio-intelligence')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeSubTab === 'cardio-intelligence'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Heart className="w-3.5 h-3.5 text-teal-400" />
            Cardiovascular Intelligence
          </button>
          <button
            onClick={() => setActiveSubTab('multisignal')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
              activeSubTab === 'multisignal'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30 shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            Multi-Signal Trends
          </button>
        </div>
      </div>

      {activeSubTab === 'cardio-intelligence' ? (
        <CardiovascularIntelligenceWorkspace
          patientId={currentPatient?.patient_id || 'PT-1001'}
          patientName={currentPatient?.full_name}
        />
      ) : (
        <>
          <div className="flex justify-end">
            <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-lg border border-slate-800 text-xs shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
              {[7, 14, 30, 90].map(days => (
                <button
                  key={days}
                  onClick={() => setSelectedRange(days)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                    selectedRange === days
                      ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Last {days} Days
                </button>
              ))}
            </div>
          </div>
          <InteractiveHistoricalChart initialDays={selectedRange} />
        </>
      )}

      {/* Analytical Guidance Panel */}
      <div className="card-surface rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-900">
          Personal Baseline Interpretation Principles
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-600">
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
            <span className="font-bold text-slate-900 block">Baseline Tolerance Corridor</span>
            <p className="text-[11px] leading-relaxed">
              The shaded band represents $\mu \pm 1.5\sigma$ over the rolling window. Points inside this band reflect typical circadian biological fluctuations.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
            <span className="font-bold text-slate-900 block">Multi-Day Divergence</span>
            <p className="text-[11px] leading-relaxed">
              Consecutive observations outside the 1.5σ band signal systemic shifts (e.g. cumulative sleep deficit, autonomic strain, or overtraining).
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-100 space-y-1">
            <span className="font-bold text-slate-900 block">Zero Unsupported Population Norms</span>
            <p className="text-[11px] leading-relaxed">
              Charts do not impose generic population cutoffs (e.g., standard 60–100 bpm), protecting athletes and seniors from false alarms.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
