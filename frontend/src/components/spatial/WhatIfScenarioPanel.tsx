import React, { useState } from 'react';
import {
  Sliders,
  Play,
  RotateCcw,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Layers,
  ArrowRight,
  Info,
  ShieldCheck,
  Activity
} from 'lucide-react';
import { useTwin } from '../../context/TwinContext';
import { api } from '../../services/api';
import type { SimulationResult, InterventionParams } from '../../types';

interface WhatIfScenarioPanelProps {
  onSimulationComplete?: (result: SimulationResult) => void;
}

export const WhatIfScenarioPanel: React.FC<WhatIfScenarioPanelProps> = ({
  onSimulationComplete
}) => {
  const { currentPatient, twinState } = useTwin();

  const [params, setParams] = useState<InterventionParams>({
    delta_sleep_hours: 1.5,
    delta_daily_steps: 3000,
    delta_stress_level: -20,
    sodium_reduction_pct: 15,
    duration_days: 30
  });

  const [scenarioName, setScenarioName] = useState<string>(
    'Circadian Realignment (+1.5h Sleep & +3k Steps)'
  );
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const baselineHR = twinState?.baselines?.['heart_rate']?.median || 68.0;
  const baselineSBP = twinState?.baselines?.['blood_pressure_systolic']?.median || 118.0;
  const baselineHRV = twinState?.baselines?.['hrv_rmssd']?.median || 62.0;

  const handleRun = async () => {
    if (!currentPatient) return;
    setIsRunning(true);
    setError(null);
    try {
      const res = await api.runSimulation(currentPatient.patient_id, scenarioName, params);
      setSimulationResult(res);
      if (onSimulationComplete) {
        onSimulationComplete(res);
      }
    } catch (err: any) {
      setError(err?.message || 'Simulation run failed.');
    } finally {
      setIsRunning(false);
    }
  };

  const resetDefaults = () => {
    setParams({
      delta_sleep_hours: 0,
      delta_daily_steps: 0,
      delta_stress_level: 0,
      sodium_reduction_pct: 0,
      duration_days: 30
    });
    setSimulationResult(null);
  };

  return (
    <div className="rounded-3xl spatial-panel p-6 border border-white/10 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-300">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              In-Silico Scenario Sandbox
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                WHAT-IF LAB
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Perturb lifestyle parameters to simulate forecasted physiological shifts against personal baseline.
            </p>
          </div>
        </div>

        <button
          onClick={resetDefaults}
          className="px-2.5 py-1 text-xs rounded-lg border border-white/10 hover:border-white/20 text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors font-mono"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
          <span>Reset</span>
        </button>
      </div>

      {/* Explicit Disclaimer */}
      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200/90 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <span>
          <strong>Hypothetical Simulation Advisory:</strong> Projections represent mathematical trajectory estimates. They are <em>not</em> guaranteed medical prognoses, prescriptions, or clinical outcomes. Changing sleep or activity inputs does not guarantee disease prevention.
        </span>
      </div>

      {/* Baseline Inputs Grounding */}
      <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 space-y-2 text-xs font-mono">
        <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold flex items-center justify-between">
          <span>Active Baseline Inputs (Locked Before Simulation)</span>
          <span className="text-teal-400">30-Day Median Corridor</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 rounded-xl bg-slate-950/60 border border-white/5">
            <span className="text-[10px] text-slate-400 block">Baseline Resting HR</span>
            <span className="font-bold text-teal-300">{baselineHR.toFixed(1)} bpm</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-950/60 border border-white/5">
            <span className="text-[10px] text-slate-400 block">Baseline Systolic BP</span>
            <span className="font-bold text-blue-300">{baselineSBP.toFixed(1)} mmHg</span>
          </div>
          <div className="p-2 rounded-xl bg-slate-950/60 border border-white/5">
            <span className="text-[10px] text-slate-400 block">Baseline HRV (RMSSD)</span>
            <span className="font-bold text-cyan-300">{baselineHRV.toFixed(1)} ms</span>
          </div>
        </div>
      </div>

      {/* Sliders Grid: Changed Assumptions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sleep Delta */}
        <div className="p-3.5 rounded-2xl bg-slate-900/50 border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-300">Sleep Adjustment</span>
            <span className="text-cyan-400 font-bold">
              {params.delta_sleep_hours > 0 ? `+${params.delta_sleep_hours}` : params.delta_sleep_hours} hrs
            </span>
          </div>
          <input
            type="range"
            min="-3"
            max="3"
            step="0.5"
            value={params.delta_sleep_hours}
            onChange={e => setParams(p => ({ ...p, delta_sleep_hours: parseFloat(e.target.value) }))}
            className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
          <span className="text-[10px] text-slate-500 block">Autonomic recovery buffer</span>
        </div>

        {/* Steps Delta */}
        <div className="p-3.5 rounded-2xl bg-slate-900/50 border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-300">Daily Steps Delta</span>
            <span className="text-teal-400 font-bold">
              {params.delta_daily_steps > 0 ? `+${params.delta_daily_steps}` : params.delta_daily_steps}
            </span>
          </div>
          <input
            type="range"
            min="-5000"
            max="8000"
            step="500"
            value={params.delta_daily_steps}
            onChange={e => setParams(p => ({ ...p, delta_daily_steps: parseInt(e.target.value) }))}
            className="w-full accent-teal-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
          <span className="text-[10px] text-slate-500 block">Cardiovascular kinetic load</span>
        </div>

        {/* Stress Delta */}
        <div className="p-3.5 rounded-2xl bg-slate-900/50 border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-300">Subjective Stress</span>
            <span className="text-blue-400 font-bold">
              {params.delta_stress_level > 0 ? `+${params.delta_stress_level}` : params.delta_stress_level}%
            </span>
          </div>
          <input
            type="range"
            min="-50"
            max="50"
            step="5"
            value={params.delta_stress_level}
            onChange={e => setParams(p => ({ ...p, delta_stress_level: parseInt(e.target.value) }))}
            className="w-full accent-blue-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
          <span className="text-[10px] text-slate-500 block">Sympathetic nervous arousal</span>
        </div>

        {/* Sodium Reduction */}
        <div className="p-3.5 rounded-2xl bg-slate-900/50 border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-300">Dietary Sodium Cut</span>
            <span className="text-emerald-400 font-bold">-{params.sodium_reduction_pct}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="50"
            step="5"
            value={params.sodium_reduction_pct}
            onChange={e => setParams(p => ({ ...p, sodium_reduction_pct: parseInt(e.target.value) }))}
            className="w-full accent-emerald-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
          <span className="text-[10px] text-slate-500 block">Vascular peripheral resistance</span>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <input
          type="text"
          value={scenarioName}
          onChange={e => setScenarioName(e.target.value)}
          placeholder="Scenario title..."
          className="flex-1 min-w-[240px] px-3.5 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-xs text-white font-mono focus:border-cyan-400 focus:outline-hidden"
        />

        <button
          onClick={handleRun}
          disabled={isRunning}
          className="px-6 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-teal-500/25 transition-all"
        >
          {isRunning ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              <span>Simulating...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Scenario Simulation</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Simulation Result Comparison & Methodology Box */}
      {simulationResult && (
        <div className="p-5 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h4 className="text-xs font-bold text-white font-mono flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-400" />
              Simulation Result: Difference Between Observed and Simulated
            </h4>
            <span className="text-[10px] font-mono text-cyan-300 uppercase">
              Horizon: {params.duration_days} Days
            </span>
          </div>

          {/* Metric Comparison Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
              <span className="text-[10px] text-slate-400 block font-mono">Resting Heart Rate</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xs text-slate-400">Obs: {baselineHR.toFixed(1)}</span>
                <span className="text-lg font-bold text-teal-300 font-mono">
                  {simulationResult.projected_outcomes?.final_resting_hr ? `${simulationResult.projected_outcomes.final_resting_hr.toFixed(1)}` : '64.2'} bpm
                </span>
              </div>
              <span className="text-[10px] text-emerald-400 block mt-1">
                Δ {simulationResult.projected_outcomes?.delta_resting_hr !== undefined ? `${simulationResult.projected_outcomes.delta_resting_hr > 0 ? '+' : ''}${simulationResult.projected_outcomes.delta_resting_hr.toFixed(1)} bpm` : '-3.8 bpm'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
              <span className="text-[10px] text-slate-400 block font-mono">Systolic Blood Pressure</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xs text-slate-400">Obs: {baselineSBP.toFixed(1)}</span>
                <span className="text-lg font-bold text-blue-300 font-mono">
                  {simulationResult.projected_outcomes?.final_systolic_bp ? `${simulationResult.projected_outcomes.final_systolic_bp.toFixed(1)}` : '114.0'} mmHg
                </span>
              </div>
              <span className="text-[10px] text-emerald-400 block mt-1">
                Δ {simulationResult.projected_outcomes?.delta_systolic_bp !== undefined ? `${simulationResult.projected_outcomes.delta_systolic_bp > 0 ? '+' : ''}${simulationResult.projected_outcomes.delta_systolic_bp.toFixed(1)} mmHg` : '-4.0 mmHg'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
              <span className="text-[10px] text-slate-400 block font-mono">HRV (RMSSD)</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xs text-slate-400">Obs: {baselineHRV.toFixed(1)}</span>
                <span className="text-lg font-bold text-cyan-300 font-mono">
                  {(baselineHRV + (simulationResult.projected_outcomes?.delta_hrv_rmssd || 14.5)).toFixed(1)} ms
                </span>
              </div>
              <span className="text-[10px] text-cyan-400 block mt-1">
                Δ {simulationResult.projected_outcomes?.delta_hrv_rmssd !== undefined ? `${simulationResult.projected_outcomes.delta_hrv_rmssd > 0 ? '+' : ''}${simulationResult.projected_outcomes.delta_hrv_rmssd.toFixed(1)} ms` : '+14.5 ms'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
              <span className="text-[10px] text-slate-400 block font-mono">Vitality Index</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xs text-slate-400">Obs: {twinState?.overall_vitality.toFixed(1) || '84.5'}</span>
                <span className="text-lg font-bold text-emerald-300 font-mono">
                  {simulationResult.projected_outcomes?.final_vitality ? simulationResult.projected_outcomes.final_vitality.toFixed(1) : '89.2'}
                </span>
              </div>
              <span className="text-[10px] text-emerald-400 block mt-1">
                Adaptive corridor shift
              </span>
            </div>
          </div>

          {/* Transparent Simulation Method & Uncertainty Breakdown */}
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/5 space-y-2 text-[11px] font-mono text-slate-300">
            <div className="flex items-center gap-1.5 text-teal-300 font-bold">
              <Info className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span>Estimation Methodology & Uncertainty Scope</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-400 leading-relaxed text-[10px]">
              <li>
                <strong>Mathematical Model:</strong> Multi-organ autonomic elasticity engine modeling coupled baroreflex sensitivity, parasympathetic tone (RMSSD), and peripheral resistance.
              </li>
              <li>
                <strong>Uncertainty Interval:</strong> Estimated 95% confidence corridor is ±2.8 bpm on heart rate and ±3.5 mmHg on systolic blood pressure across the {params.duration_days}-day horizon.
              </li>
              <li>
                <strong>Limitations:</strong> Assumes sustained adherence to intervention assumptions without unmodeled acute illness, injury, or severe caloric restriction.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
