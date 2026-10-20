import React, { useState } from 'react';
import { LineChart as LineChartIcon, Heart, Activity, Moon, Footprints, Calendar } from 'lucide-react';
import { useTwin } from '../../context/TwinContext';
import { InteractiveHistoricalChart } from '../charts/InteractiveHistoricalChart';

export const HealthTrendsPage: React.FC = () => {
  const { currentPatient } = useTwin();
  const [selectedRange, setSelectedRange] = useState<number>(30);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <LineChartIcon className="w-6 h-6 text-teal-600" />
            Longitudinal Health Trends & Dynamics
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Evaluate time-series trajectories benchmarked strictly against {currentPatient?.full_name}’s own biological baseline.
          </p>
        </div>

        {/* Global Date Range for Trends */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-slate-200 text-xs shadow-2xs">
          <Calendar className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
          {[7, 14, 30, 90].map(days => (
            <button
              key={days}
              onClick={() => setSelectedRange(days)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                selectedRange === days
                  ? 'bg-teal-50 text-teal-800 border border-teal-200 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last {days} Days
            </button>
          ))}
        </div>
      </div>

      {/* Main Multi-Metric Time-series Visualizer */}
      <InteractiveHistoricalChart initialDays={selectedRange} />

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
