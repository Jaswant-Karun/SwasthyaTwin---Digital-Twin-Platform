import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { Sliders, Play, RotateCcw, Sparkles, TrendingDown, TrendingUp, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useTwin } from '../../context/TwinContext';
import { api } from '../../services/api';
import { SimulationResult, InterventionParams } from '../../types';

export const WhatIfSimulator: React.FC = () => {
  const { currentPatient } = useTwin();

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

  const handleRunSimulation = async () => {
    if (!currentPatient) return;
    setIsRunning(true);
    setError(null);
    try {
      const res = await api.runSimulation(currentPatient.patient_id, scenarioName, params);
      setSimulationResult(res);
    } catch (err: any) {
      setError(err.message || 'Simulation execution failed.');
    } finally {
      setIsRunning(false);
    }
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
  };

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-teal-950/40 via-slate-900 to-indigo-950/30 border border-teal-500/20">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 shrink-0">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              What-If Counterfactual Simulator
              <span className="text-[10px] bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded font-mono uppercase font-bold">
                Digital Twin In Silico
              </span>
            </h3>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Adjust hypothetical lifestyle levers to model how targeted behavioral interventions propagate through {currentPatient?.full_name}’s autonomic and cardiovascular regulatory loops over time.
            </p>
          </div>
        </div>
      </div>

      {/* Control Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sliders Panel */}
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-5">
          <div className="border-b border-slate-800 pb-3">
            <label className="text-xs font-bold text-slate-300 block mb-1">Scenario Label</label>
            <input
              type="text"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              className="w-full bg-slate-800 text-white text-xs rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium"
              placeholder="e.g. +1.5h Sleep & 8k Daily Steps"
            />
          </div>

          {/* Sleep Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-semibold">Sleep Modification:</span>
              <span className={`font-mono font-bold ${params.delta_sleep_hours > 0 ? 'text-teal-400' : params.delta_sleep_hours < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                {params.delta_sleep_hours > 0 ? `+${params.delta_sleep_hours} hrs` : `${params.delta_sleep_hours} hrs`}/night
              </span>
            </div>
            <input
              type="range"
              min="-2.0"
              max="3.0"
              step="0.5"
              value={params.delta_sleep_hours}
              onChange={(e) => setParams({ ...params, delta_sleep_hours: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>-2.0h</span>
              <span>Baseline</span>
              <span>+3.0h</span>
            </div>
          </div>

          {/* Daily Steps Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-semibold">Daily Physical Activity:</span>
              <span className={`font-mono font-bold ${params.delta_daily_steps > 0 ? 'text-emerald-400' : params.delta_daily_steps < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                {params.delta_daily_steps > 0 ? `+${params.delta_daily_steps.toLocaleString()} steps` : `${params.delta_daily_steps.toLocaleString()} steps`}
              </span>
            </div>
            <input
              type="range"
              min="-4000"
              max="8000"
              step="500"
              value={params.delta_daily_steps}
              onChange={(e) => setParams({ ...params, delta_daily_steps: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>-4k</span>
              <span>Baseline</span>
              <span>+8k</span>
            </div>
          </div>

          {/* Stress Reduction Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-semibold">Stress Mitigation:</span>
              <span className="font-mono font-bold text-cyan-400">
                {params.delta_stress_level < 0 ? `${Math.abs(params.delta_stress_level)}% Reduction` : `${params.delta_stress_level}%`}
              </span>
            </div>
            <input
              type="range"
              min="-50"
              max="20"
              step="5"
              value={params.delta_stress_level}
              onChange={(e) => setParams({ ...params, delta_stress_level: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>-50% (Calm)</span>
              <span>0%</span>
              <span>+20% (Stress)</span>
            </div>
          </div>

          {/* Sodium Reduction Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-300 font-semibold">Dietary Sodium Reduction:</span>
              <span className="font-mono font-bold text-purple-400">
                {params.sodium_reduction_pct}% Lower
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="40"
              step="5"
              value={params.sodium_reduction_pct}
              onChange={(e) => setParams({ ...params, sodium_reduction_pct: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>Standard</span>
              <span>-20%</span>
              <span>-40% (Strict DASH)</span>
            </div>
          </div>

          {/* Duration Horizon Buttons */}
          <div className="space-y-1.5">
            <span className="text-xs text-slate-300 font-semibold block">Projection Horizon:</span>
            <div className="grid grid-cols-3 gap-2">
              {[14, 30, 60].map(days => (
                <button
                  key={days}
                  onClick={() => setParams({ ...params, duration_days: days })}
                  className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    params.duration_days === days
                      ? 'bg-teal-500/20 text-teal-300 border-teal-500'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
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
              className="flex-1 py-2.5 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-500/25 transition-all disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 fill-current ${isRunning ? 'animate-spin' : ''}`} />
              {isRunning ? 'Calculating In Silico...' : 'Run What-If Model'}
            </button>
            <button
              onClick={handleReset}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors"
              title="Reset Sliders"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {error && (
            <p className="text-xs text-rose-400 font-medium">{error}</p>
          )}
        </div>

        {/* Results & Trajectory Graph */}
        <div className="lg:col-span-2 rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white">Projected Physiological Trajectory</h3>
              <p className="text-xs text-slate-400">Resting Heart Rate forecast with 90% confidence uncertainty envelope</p>
            </div>
            {simulationResult && (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/20 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                Model Converged
              </span>
            )}
          </div>

          {/* Projected Outcome Metric Cards */}
          {simulationResult && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <span className="text-[10px] text-slate-400 block uppercase font-mono">Resting HR</span>
                <span className="text-lg font-black text-white font-mono">
                  {simulationResult.projected_outcomes.final_resting_hr} <span className="text-xs font-normal text-slate-400">bpm</span>
                </span>
                <span className={`block text-xs font-bold ${simulationResult.projected_outcomes.delta_resting_hr <= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
                  {simulationResult.projected_outcomes.delta_resting_hr > 0 ? `+${simulationResult.projected_outcomes.delta_resting_hr}` : simulationResult.projected_outcomes.delta_resting_hr} bpm
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <span className="text-[10px] text-slate-400 block uppercase font-mono">Systolic BP</span>
                <span className="text-lg font-black text-white font-mono">
                  {simulationResult.projected_outcomes.final_systolic_bp} <span className="text-xs font-normal text-slate-400">mmHg</span>
                </span>
                <span className={`block text-xs font-bold ${simulationResult.projected_outcomes.delta_systolic_bp <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {simulationResult.projected_outcomes.delta_systolic_bp > 0 ? `+${simulationResult.projected_outcomes.delta_systolic_bp}` : simulationResult.projected_outcomes.delta_systolic_bp} mmHg
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <span className="text-[10px] text-slate-400 block uppercase font-mono">HRV (RMSSD)</span>
                <span className="text-lg font-black text-white font-mono">
                  {simulationResult.projected_outcomes.final_hrv_rmssd} <span className="text-xs font-normal text-slate-400">ms</span>
                </span>
                <span className={`block text-xs font-bold ${simulationResult.projected_outcomes.delta_hrv_rmssd >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
                  {simulationResult.projected_outcomes.delta_hrv_rmssd > 0 ? `+${simulationResult.projected_outcomes.delta_hrv_rmssd}` : simulationResult.projected_outcomes.delta_hrv_rmssd} ms
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <span className="text-[10px] text-slate-400 block uppercase font-mono">Projected Vitality</span>
                <span className="text-lg font-black text-white font-mono">
                  {simulationResult.projected_outcomes.final_vitality} <span className="text-xs font-normal text-slate-400">/ 100</span>
                </span>
                <span className="block text-xs font-bold text-teal-400">
                  Target Trajectory
                </span>
              </div>
            </div>
          )}

          {/* Trajectory Forecast Chart */}
          <div className="h-64 w-full pt-1">
            {!simulationResult ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-xl">
                <Sliders className="w-8 h-8 text-teal-500/40 mb-2" />
                <p className="text-sm font-semibold text-slate-300">No Simulation Executed Yet</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Adjust the intervention sliders on the left and click "Run What-If Model" to project autonomic adaptation curves.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={simulationResult.trajectories} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 11 }} label={{ value: 'Day', position: 'insideBottomRight', offset: -5 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const pt = payload[0].payload;
                        return (
                          <div className="bg-slate-950/95 border border-slate-800 p-3 rounded-xl shadow-xl text-xs space-y-1">
                            <p className="font-bold text-white border-b border-slate-800 pb-1">Day {label} ({pt.date})</p>
                            <p className="text-teal-400">Forecast RHR: <strong>{pt.resting_hr} bpm</strong></p>
                            <p className="text-slate-400 text-[10px]">90% CI: [{pt.resting_hr_lower} – {pt.resting_hr_upper}]</p>
                            <p className="text-emerald-400">Systolic BP: <strong>{pt.systolic_bp} mmHg</strong></p>
                            <p className="text-cyan-400">HRV (RMSSD): <strong>{pt.hrv_rmssd} ms</strong></p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  {/* Confidence Interval Ribbon */}
                  <Area
                    type="monotone"
                    dataKey="resting_hr_upper"
                    stroke="transparent"
                    fill="#14b8a6"
                    fillOpacity={0.12}
                  />
                  <Area
                    type="monotone"
                    dataKey="resting_hr_lower"
                    stroke="transparent"
                    fill="#0f172a"
                    fillOpacity={0.9}
                  />
                  {/* Projected Expected Value */}
                  <Line
                    type="monotone"
                    dataKey="resting_hr"
                    stroke="#2dd4bf"
                    strokeWidth={2.5}
                    dot={false}
                    name="Projected Resting HR"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Model Assumptions and Healthcare Safety Notice */}
          <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Simulation Guardrails & Model Assumptions</span>
            </div>
            <p>
              Projections reflect mathematical pharmacodynamic exponential response curves ($1 - e^{-t/\tau}$) with physiological saturation.
              Simulated outcomes do not guarantee clinical response; individual neurohormonal adaptation varies.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
