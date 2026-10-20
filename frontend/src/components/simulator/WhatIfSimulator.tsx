import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { Sliders, Play, RotateCcw, ShieldAlert, CheckCircle2, ArrowRight } from 'lucide-react';
import { useTwin } from '../../context/TwinContext';
import { api } from '../../services/api';
import type { SimulationResult, InterventionParams } from '../../types';

export const WhatIfSimulator: React.FC = () => {
  const { currentPatient, twinState } = useTwin();

  const [params, setParams] = useState<InterventionParams>({
    delta_sleep_hours: 1.5,
    delta_daily_steps: 3000,
    delta_stress_level: -20,
    sodium_reduction_pct: 15,
    duration_days: 30
  });

  const [scenarioName, setScenarioName] = useState<string>('Optimized Sleep & Daily 3k Steps');
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pastSimulations, setPastSimulations] = useState<SimulationResult[]>([]);

  // Load past simulations for this patient
  useEffect(() => {
    if (!currentPatient) return;
    api.getSimulations(currentPatient.patient_id)
      .then(sims => setPastSimulations(sims))
      .catch(err => console.warn('Could not load past simulations:', err));
  }, [currentPatient?.patient_id]);

  const handleRunSimulation = async () => {
    if (!currentPatient) return;
    if (!scenarioName.trim()) {
      setError('Please provide a scenario name.');
      return;
    }
    setIsRunning(true);
    setError(null);
    try {
      const res = await api.runSimulation(currentPatient.patient_id, scenarioName.trim(), params);
      setSimulationResult(res);
      setPastSimulations(prev => [res, ...prev.filter(p => p._id !== res._id)]);
    } catch (err: any) {
      setError(err.message || 'Simulation execution failed.');
    } finally {
      setIsRunning(false);
    }
  };

  const handleSelectPastSimulation = (sim: SimulationResult) => {
    setSimulationResult(sim);
    setScenarioName(sim.scenario_name);
    setParams(sim.parameters);
  };

  const handleReset = () => {
    setParams({
      delta_sleep_hours: 0,
      delta_daily_steps: 0,
      delta_stress_level: 0,
      sodium_reduction_pct: 0,
      duration_days: 30
    });
    setScenarioName('Baseline Control Scenario');
    setSimulationResult(null);
    setError(null);
  };

  const hrDeviation = twinState?.metrics['heart_rate'];
  const bpDeviation = twinState?.metrics['blood_pressure_systolic'];

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Sliders className="w-6 h-6 text-teal-600" />
            What-if Counterfactual Simulator
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Simulate how hypothetical sleep, activity, and nutrition modifications alter {currentPatient?.full_name}’s autonomic trajectory over time.
          </p>
        </div>

        {pastSimulations.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium hidden md:inline">Past Scenarios:</span>
            <select
              onChange={(e) => {
                const found = pastSimulations.find(s => s._id === e.target.value || (s as any).simulation_id === e.target.value);
                if (found) handleSelectPastSimulation(found);
              }}
              className="bg-white border border-slate-200 text-slate-800 text-xs rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-teal-500 font-medium"
            >
              <option value="">Load Past Simulation ({pastSimulations.length})</option>
              {pastSimulations.map((s, idx) => (
                <option key={s._id || idx} value={s._id || (s as any).simulation_id}>
                  {s.scenario_name} ({s.parameters.duration_days}d)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Current Observed Baseline Summary Panel */}
      <div className="card-surface rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono block">
            Starting Observed Baseline (Anchor)
          </span>
          <div className="flex items-center gap-4 mt-1">
            <span>Resting HR: <strong className="text-slate-900 font-mono">{hrDeviation?.current_value ? `${hrDeviation.current_value.toFixed(1)} bpm` : '72.0 bpm'}</strong></span>
            <span>•</span>
            <span>Systolic BP: <strong className="text-slate-900 font-mono">{bpDeviation?.current_value ? `${bpDeviation.current_value.toFixed(1)} mmHg` : '122.0 mmHg'}</strong></span>
            <span>•</span>
            <span>Sleep: <strong className="text-slate-900 font-mono">{currentPatient?.lifestyle_profile.baseline_sleep_hours || 7.5} hrs</strong></span>
          </div>
        </div>

        <span className="text-[11px] text-teal-700 bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200 font-medium">
          Anchored to Measured Self-Baseline
        </span>
      </div>

      {/* Control Grid: Controls + Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Levers Panel */}
        <div className="card-surface rounded-xl p-5 space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <label className="text-xs font-semibold text-slate-700 block mb-1">Scenario Label</label>
            <input
              type="text"
              value={scenarioName}
              disabled={isRunning}
              onChange={(e) => setScenarioName(e.target.value)}
              className="w-full bg-slate-50 text-slate-900 text-xs rounded-lg px-3 py-2 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium disabled:opacity-60"
              placeholder="e.g. +1.5h Sleep & 8k Daily Steps"
            />
          </div>

          {/* Sleep Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-700 font-medium">Sleep Extension:</span>
              <span className={`font-mono font-bold ${params.delta_sleep_hours > 0 ? 'text-teal-700' : params.delta_sleep_hours < 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                {params.delta_sleep_hours > 0 ? `+${params.delta_sleep_hours} hrs` : `${params.delta_sleep_hours} hrs`}/night
              </span>
            </div>
            <input
              type="range"
              min="-2.0"
              max="3.0"
              step="0.5"
              disabled={isRunning}
              value={params.delta_sleep_hours}
              onChange={(e) => setParams({ ...params, delta_sleep_hours: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600 disabled:opacity-50"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>-2.0h</span>
              <span>Baseline</span>
              <span>+3.0h</span>
            </div>
          </div>

          {/* Daily Steps Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-700 font-medium">Daily Physical Activity:</span>
              <span className={`font-mono font-bold ${params.delta_daily_steps > 0 ? 'text-emerald-700' : params.delta_daily_steps < 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                {params.delta_daily_steps > 0 ? `+${params.delta_daily_steps.toLocaleString()} steps` : `${params.delta_daily_steps.toLocaleString()} steps`}
              </span>
            </div>
            <input
              type="range"
              min="-4000"
              max="8000"
              step="500"
              disabled={isRunning}
              value={params.delta_daily_steps}
              onChange={(e) => setParams({ ...params, delta_daily_steps: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600 disabled:opacity-50"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>-4k</span>
              <span>Baseline</span>
              <span>+8k</span>
            </div>
          </div>

          {/* Stress Reduction Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-700 font-medium">Stress Mitigation:</span>
              <span className="font-mono font-bold text-cyan-700">
                {params.delta_stress_level < 0 ? `${Math.abs(params.delta_stress_level)}% Reduction` : `${params.delta_stress_level}%`}
              </span>
            </div>
            <input
              type="range"
              min="-50"
              max="20"
              step="5"
              disabled={isRunning}
              value={params.delta_stress_level}
              onChange={(e) => setParams({ ...params, delta_stress_level: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-cyan-600 disabled:opacity-50"
            />
          </div>

          {/* Projection Horizon */}
          <div className="space-y-1.5">
            <span className="text-xs text-slate-700 font-medium block">Horizon:</span>
            <div className="grid grid-cols-3 gap-2">
              {[14, 30, 60].map(days => (
                <button
                  key={days}
                  disabled={isRunning}
                  onClick={() => setParams({ ...params, duration_days: days })}
                  className={`py-1.5 rounded-lg text-xs font-semibold border transition-all disabled:opacity-50 ${
                    params.duration_days === days
                      ? 'bg-teal-50 text-teal-800 border-teal-300 font-bold'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {days} Days
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex gap-2">
            <button
              onClick={handleRunSimulation}
              disabled={isRunning}
              className="flex-1 py-2 px-4 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-xs"
            >
              <Play className={`w-3.5 h-3.5 fill-current ${isRunning ? 'animate-spin' : ''}`} />
              {isRunning ? 'Modeling In Silico...' : 'Run Simulation'}
            </button>
            <button
              onClick={handleReset}
              disabled={isRunning}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 transition-colors disabled:opacity-50"
              title="Reset Levers"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
        </div>

        {/* Results & Forecast Curves */}
        <div className="lg:col-span-2 card-surface rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Modeled Cardiovascular Adaptation Trajectory</h3>
                <span className="px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase bg-amber-100 text-amber-900 border border-amber-300">
                  Simulated Output
                </span>
              </div>
              <p className="text-xs text-slate-500">Resting Heart Rate forecast with 90% confidence uncertainty envelope.</p>
            </div>
            {simulationResult && (
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Scenario Computed
              </span>
            )}
          </div>

          {/* Outcomes */}
          {simulationResult && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-mono">Resting HR</span>
                  <span className="text-[8px] font-bold text-amber-700 uppercase bg-amber-50 px-1 rounded">Simulated</span>
                </div>
                <span className="text-lg font-bold text-slate-900 font-mono">
                  {simulationResult.projected_outcomes.final_resting_hr} <span className="text-xs font-normal text-slate-500">bpm</span>
                </span>
                <span className={`block text-xs font-semibold ${simulationResult.projected_outcomes.delta_resting_hr <= 0 ? 'text-teal-700' : 'text-rose-600'}`}>
                  {simulationResult.projected_outcomes.delta_resting_hr > 0 ? `+${simulationResult.projected_outcomes.delta_resting_hr}` : simulationResult.projected_outcomes.delta_resting_hr} bpm
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-mono">Systolic BP</span>
                  <span className="text-[8px] font-bold text-amber-700 uppercase bg-amber-50 px-1 rounded">Simulated</span>
                </div>
                <span className="text-lg font-bold text-slate-900 font-mono">
                  {simulationResult.projected_outcomes.final_systolic_bp} <span className="text-xs font-normal text-slate-500">mmHg</span>
                </span>
                <span className={`block text-xs font-semibold ${simulationResult.projected_outcomes.delta_systolic_bp <= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {simulationResult.projected_outcomes.delta_systolic_bp > 0 ? `+${simulationResult.projected_outcomes.delta_systolic_bp}` : simulationResult.projected_outcomes.delta_systolic_bp} mmHg
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-mono">HRV (RMSSD)</span>
                  <span className="text-[8px] font-bold text-amber-700 uppercase bg-amber-50 px-1 rounded">Simulated</span>
                </div>
                <span className="text-lg font-bold text-slate-900 font-mono">
                  {simulationResult.projected_outcomes.final_hrv_rmssd} <span className="text-xs font-normal text-slate-500">ms</span>
                </span>
                <span className={`block text-xs font-semibold ${simulationResult.projected_outcomes.delta_hrv_rmssd >= 0 ? 'text-teal-700' : 'text-rose-600'}`}>
                  {simulationResult.projected_outcomes.delta_hrv_rmssd > 0 ? `+${simulationResult.projected_outcomes.delta_hrv_rmssd}` : simulationResult.projected_outcomes.delta_hrv_rmssd} ms
                </span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-mono">Vitality Target</span>
                  <span className="text-[8px] font-bold text-amber-700 uppercase bg-amber-50 px-1 rounded">Projected</span>
                </div>
                <span className="text-lg font-bold text-slate-900 font-mono">
                  {simulationResult.projected_outcomes.final_vitality} <span className="text-xs font-normal text-slate-500">/ 100</span>
                </span>
                <span className="block text-xs font-semibold text-teal-700">Projected Index</span>
              </div>
            </div>
          )}

          {/* Area Chart Canvas */}
          <div className="h-64 w-full pt-1">
            {isRunning ? (
              <div className="h-full flex flex-col items-center justify-center space-y-2 bg-slate-50/50 rounded-lg animate-pulse">
                <Sliders className="w-8 h-8 text-teal-600 animate-spin" />
                <span className="text-xs font-medium text-slate-600">Simulating physiological dynamics via backend API...</span>
              </div>
            ) : !simulationResult ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-lg">
                <Sliders className="w-8 h-8 text-teal-600/40 mb-2" />
                <p className="text-sm font-semibold text-slate-700">No Simulation Executed</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Adjust hypothetical sleep or activity sliders on the left and click "Run Simulation" to invoke the backend simulation model.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={simulationResult.trajectories} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="day" stroke="#94a3b8" tick={{ fontSize: 11 }} label={{ value: 'Day', position: 'insideBottomRight', offset: -5 }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const pt = payload[0].payload;
                        return (
                          <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-md text-xs space-y-1">
                            <p className="font-semibold text-slate-900 border-b border-slate-100 pb-1">
                              Day {label} ({pt.date}) <span className="text-[9px] text-amber-700 font-mono">[SIMULATED]</span>
                            </p>
                            <p className="text-teal-700 font-medium">Model Resting HR: <strong>{pt.resting_hr} bpm</strong></p>
                            <p className="text-slate-400 text-[10px]">90% CI: [{pt.resting_hr_lower} – {pt.resting_hr_upper}]</p>
                            <p className="text-slate-700">Systolic BP: <strong>{pt.systolic_bp} mmHg</strong></p>
                            <p className="text-slate-700">HRV: <strong>{pt.hrv_rmssd} ms</strong></p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="resting_hr_upper"
                    stroke="transparent"
                    fill="#0d9488"
                    fillOpacity={0.08}
                  />
                  <Area
                    type="monotone"
                    dataKey="resting_hr_lower"
                    stroke="transparent"
                    fill="#ffffff"
                    fillOpacity={1}
                  />
                  <Line
                    type="monotone"
                    dataKey="resting_hr"
                    stroke="#0d9488"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Model Assumptions and Guardrails (Dynamic from API) */}
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
            <div className="flex items-center gap-1.5 text-amber-700 font-semibold">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Model Assumptions & Scientific Guardrails</span>
            </div>
            {simulationResult?.model_assumptions && simulationResult.model_assumptions.length > 0 ? (
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600">
                {simulationResult.model_assumptions.map((assump, idx) => (
                  <li key={idx} className="leading-relaxed">{assump}</li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] leading-relaxed">
                Outputs are modelled physiological scenarios derived from exponential saturation kinetics (1 - exp(-t/τ)), not actual clinical measurements or guaranteed medical outcomes.
              </p>
            )}
            {simulationResult?.disclaimer && (
              <p className="text-[10px] text-slate-500 italic pt-1 border-t border-slate-200">
                {simulationResult.disclaimer}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
