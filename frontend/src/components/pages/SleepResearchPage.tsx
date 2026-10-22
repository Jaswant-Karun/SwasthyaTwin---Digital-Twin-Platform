import React, { useState, useEffect } from 'react';
import {
  Moon,
  Activity,
  Brain,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Info,
  Clock,
  Layers,
  Database,
  BarChart2,
  CheckCircle2
} from 'lucide-react';
import { api } from '../../services/api';

// 5-Stage AASM Sleep Colors
const STAGE_COLORS: Record<string, { bg: string; text: string; border: string; hex: string }> = {
  Wake: { bg: 'bg-sky-500/20', text: 'text-sky-300', border: 'border-sky-500/40', hex: '#38bdf8' },
  N1: { bg: 'bg-indigo-500/20', text: 'text-indigo-300', border: 'border-indigo-500/40', hex: '#818cf8' },
  N2: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/40', hex: '#34d399' },
  N3: { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/40', hex: '#fbbf24' },
  REM: { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/40', hex: '#c084fc' },
  Unknown: { bg: 'bg-slate-700/30', text: 'text-slate-400', border: 'border-slate-700', hex: '#64748b' }
};

interface ResearchEpoch {
  sample_id: string;
  epoch_idx: number;
  time_elapsed_minutes: number;
  hr_mean: number;
  hr_min: number;
  hr_max: number;
  hr_std: number;
  hr_delta_baseline: number;
  expert_label_5class: string;
  expert_label_3class: string;
  dreem_stage_id: number;
  model_predicted_5class: string | null;
  model_predicted_3class: string | null;
  confidence_pct: number | null;
}

export const SleepResearchPage: React.FC = () => {
  const [selectedSubject, setSelectedSubject] = useState<string>('Bidslab02');
  const [selectedNight, setSelectedNight] = useState<string>('1');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [epochs, setEpochs] = useState<ResearchEpoch[]>([]);
  const [modelStatus, setModelStatus] = useState<any>(null);
  const [selectedEpoch, setSelectedEpoch] = useState<ResearchEpoch | null>(null);

  const [evaluationData, setEvaluationData] = useState<any | null>(null);

  // Live Sandbox state
  const [sandboxHrMean, setSandboxHrMean] = useState<number>(58.0);
  const [sandboxHrStd, setSandboxHrStd] = useState<number>(1.4);
  const [sandboxHrDelta, setSandboxHrDelta] = useState<number>(-2.0);
  const [sandboxTimeMin, setSandboxTimeMin] = useState<number>(120.0);
  const [sandboxResult, setSandboxResult] = useState<any | null>(null);
  const [sandboxLoading, setSandboxLoading] = useState<boolean>(false);

  useEffect(() => {
    loadResearchData();
    loadStatus();
    loadEvaluation();
  }, [selectedSubject, selectedNight]);

  const loadStatus = async () => {
    try {
      const st = await api.getSleepStageStatus();
      setModelStatus(st);
    } catch (e) {
      console.warn('Failed to load sleep stage model status', e);
    }
  };

  const loadEvaluation = async () => {
    try {
      const ev = await api.getSleepStageEvaluation();
      setEvaluationData(ev);
    } catch (e) {
      console.warn('Failed to load sleep stage evaluation', e);
    }
  };

  const loadResearchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getResearchHypnogramSamples(selectedSubject, selectedNight, 120);
      setEpochs(res.epochs || []);
      if (res.epochs && res.epochs.length > 0) {
        setSelectedEpoch(res.epochs[0]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load research samples from backend.');
    } finally {
      setLoading(false);
    }
  };

  const runSandboxInference = async (preset?: string) => {
    setSandboxLoading(true);
    let hrMean = sandboxHrMean;
    let hrStd = sandboxHrStd;
    let hrDelta = sandboxHrDelta;
    let timeMin = sandboxTimeMin;
    let validCount = 6.0;

    if (preset === 'deep') {
      hrMean = 52.0;
      hrStd = 0.8;
      hrDelta = -8.0;
      timeMin = 90.0;
    } else if (preset === 'rem') {
      hrMean = 65.5;
      hrStd = 4.2;
      hrDelta = +1.5;
      timeMin = 240.0;
    } else if (preset === 'wake') {
      hrMean = 82.0;
      hrStd = 6.5;
      hrDelta = +14.0;
      timeMin = 15.0;
    } else if (preset === 'dropout') {
      hrMean = 58.0;
      hrStd = 1.0;
      hrDelta = -2.0;
      timeMin = 60.0;
      validCount = 0.5; // Deliberate optical sensor dropout (< 2.0 valid samples)
    }

    setSandboxHrMean(hrMean);
    setSandboxHrStd(hrStd);
    setSandboxHrDelta(hrDelta);
    setSandboxTimeMin(timeMin);

    try {
      const res = await api.predictSleepStage({
        hr_mean: hrMean,
        hr_std: hrStd,
        hr_min: hrMean - 3.0,
        hr_max: hrMean + 4.0,
        hr_valid_count: validCount,
        hr_delta_baseline: hrDelta,
        hr_rolling_mean_5m: hrMean,
        hr_rolling_std_5m: hrStd,
        time_elapsed_minutes: timeMin
      });
      setSandboxResult(res);
    } catch (e: any) {
      console.error('Inference error', e);
    } finally {
      setSandboxLoading(false);
    }
  };

  // Compute hypnogram statistics
  const matchingEpochs = epochs.filter(
    ep => ep.model_predicted_5class && ep.expert_label_5class && ep.model_predicted_5class === ep.expert_label_5class
  ).length;
  const agreementPct = epochs.length > 0 ? Math.round((matchingEpochs / epochs.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 p-6 border border-slate-800 text-white shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                PHYSIONET BIDSLEEP v1.0.1
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-teal-500/20 text-teal-300 border border-teal-500/30">
                HELD-OUT TEST COHORT
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                ISOLATED FROM PATIENTS
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-3">
              <Moon className="w-7 h-7 text-indigo-400" />
              Sleep Research Workspace & 5-Stage Hypnogram
            </h1>
            <p className="text-slate-300 text-xs mt-1.5 max-w-3xl leading-relaxed">
              Evaluating multi-night polysomnography sleep architecture against Apple Watch instantaneous heart rate telemetry.
              Compares expert-reviewed Dreem 2 EEG annotations with our trained Random Forest classifier.
            </p>
          </div>

          {/* Subject & Night Controls */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
            <div>
              <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">Research Subject</label>
              <select
                value={selectedSubject}
                onChange={e => setSelectedSubject(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg text-xs px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-400"
              >
                <option value="Bidslab02">Bidslab02 (Held-Out Test)</option>
                <option value="Bidslab00">Bidslab00 (Training Cohort)</option>
                <option value="Bidslab01">Bidslab01 (Validation Cohort)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">Night Session</label>
              <select
                value={selectedNight}
                onChange={e => setSelectedNight(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg text-xs px-2.5 py-1.5 text-white focus:outline-none focus:border-indigo-400"
              >
                <option value="1">Night 1 (Full Polysomnography)</option>
                <option value="2">Night 2</option>
                <option value="3">Night 3</option>
              </select>
            </div>
            <button
              onClick={loadResearchData}
              className="mt-4 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all text-white shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reload
            </button>
          </div>
        </div>

        {/* 5-Stage Legend */}
        <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-slate-800 text-xs">
          <span className="text-[10px] font-mono uppercase text-slate-400 mr-2">AASM Sleep Stages:</span>
          {['Wake', 'N1', 'N2', 'N3', 'REM'].map(st => {
            const c = STAGE_COLORS[st];
            return (
              <span key={st} className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border ${c.bg} ${c.text} ${c.border}`}>
                {st === 'Wake' && 'Wake (W)'}
                {st === 'N1' && 'N1 (Light Transitional)'}
                {st === 'N2' && 'N2 (Intermediate NREM)'}
                {st === 'N3' && 'N3 (Deep Slow-Wave)'}
                {st === 'REM' && 'REM (Dream Sleep)'}
              </span>
            );
          })}
        </div>
      </div>

      {/* 2. Hypnogram Timeline (Side-by-Side Dual Tracks) */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              Dual-Track Polysomnography Hypnogram (30-Second Epochs)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Continuous sequence of 120 epochs (~60 minutes) comparing Expert Dreem 2 EEG reference with Apple Watch Heart Rate Model Prediction.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-slate-400">
              Session Epochs: <strong className="text-white">{epochs.length}</strong>
            </span>
            <span className="text-slate-400">
              Hypnogram Agreement: <strong className="text-emerald-400">{agreementPct}%</strong>
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-500 mb-2" />
            <p className="text-xs font-medium">Extracting authentic research epochs...</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-rose-950/40 border border-rose-800 rounded-xl text-rose-300 text-xs">
            <AlertTriangle className="w-4 h-4 text-rose-400 inline mr-2" />
            {error}
          </div>
        ) : epochs.length === 0 ? (
          <div className="p-4 bg-slate-800 rounded-xl text-slate-400 text-xs">
            No epochs found for selected subject/night session.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Track 1: Expert Reference Label (EEG Ground Truth) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-indigo-300 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-400" />
                  TRACK 1 — EXPERT DREEM 2 EEG REFERENCE (GROUND TRUTH)
                </span>
                <span className="text-slate-400">Gold-standard manual scoring</span>
              </div>
              <div className="grid grid-cols-12 sm:grid-cols-24 md:grid-cols-30 lg:grid-cols-60 gap-1 p-2 bg-slate-950 rounded-xl border border-slate-800/80 overflow-x-auto">
                {epochs.map(ep => {
                  const stage = ep.expert_label_5class || 'Unknown';
                  const c = STAGE_COLORS[stage] || STAGE_COLORS.Unknown;
                  const isSelected = selectedEpoch?.epoch_idx === ep.epoch_idx;
                  return (
                    <button
                      key={`exp_${ep.epoch_idx}`}
                      onClick={() => setSelectedEpoch(ep)}
                      title={`Epoch ${ep.epoch_idx} (${ep.time_elapsed_minutes}m) - Expert: ${stage}`}
                      className={`h-9 rounded-sm flex flex-col items-center justify-center text-[9px] font-bold font-mono transition-all ${c.bg} ${c.text} ${
                        isSelected ? 'ring-2 ring-white scale-110 z-10' : 'hover:opacity-80'
                      }`}
                    >
                      {stage[0]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Track 2: Model Prediction (Apple Watch PPG Dynamics) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="text-teal-300 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-teal-400" />
                  TRACK 2 — SWASTHYATWIN ML PREDICTION (APPLE WATCH WEARABLE PPG)
                </span>
                <span className="text-slate-400">Class-Weighted Random Forest (Seed 42)</span>
              </div>
              <div className="grid grid-cols-12 sm:grid-cols-24 md:grid-cols-30 lg:grid-cols-60 gap-1 p-2 bg-slate-950 rounded-xl border border-slate-800/80 overflow-x-auto">
                {epochs.map(ep => {
                  const stage = ep.model_predicted_5class || 'Unknown';
                  const isMatch = ep.model_predicted_5class === ep.expert_label_5class;
                  const c = STAGE_COLORS[stage] || STAGE_COLORS.Unknown;
                  const isSelected = selectedEpoch?.epoch_idx === ep.epoch_idx;
                  return (
                    <button
                      key={`pred_${ep.epoch_idx}`}
                      onClick={() => setSelectedEpoch(ep)}
                      title={`Epoch ${ep.epoch_idx} - Predicted: ${stage} (${ep.confidence_pct || 0}%) ${isMatch ? '✓ Match' : '✗ Discordant'}`}
                      className={`h-9 rounded-sm flex flex-col items-center justify-center text-[9px] font-bold font-mono transition-all ${c.bg} ${c.text} ${
                        isSelected ? 'ring-2 ring-white scale-110 z-10' : 'hover:opacity-80'
                      } ${!isMatch ? 'border-b-2 border-rose-500' : 'border-b-2 border-emerald-400'}`}
                    >
                      {stage[0]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Track 3: Continuous Wearable Heart Rate Curve */}
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span className="flex items-center gap-1.5 text-rose-300">
                  <Activity className="w-3.5 h-3.5 text-rose-400" />
                  CONCURRENT NOCTURNAL HEART RATE TELEMETRY (0.2 Hz PPG)
                </span>
                <span>Values: 45–95 bpm</span>
              </div>
              <div className="h-20 bg-slate-950 rounded-xl border border-slate-800 p-2 flex items-end gap-1">
                {epochs.map(ep => {
                  const minScale = 45;
                  const maxScale = 90;
                  const heightPct = Math.max(10, Math.min(100, ((ep.hr_mean - minScale) / (maxScale - minScale)) * 100));
                  const isSelected = selectedEpoch?.epoch_idx === ep.epoch_idx;
                  return (
                    <div
                      key={`hr_${ep.epoch_idx}`}
                      onClick={() => setSelectedEpoch(ep)}
                      title={`Epoch ${ep.epoch_idx}: ${ep.hr_mean} bpm`}
                      style={{ height: `${heightPct}%` }}
                      className={`flex-1 rounded-t-xs transition-all cursor-pointer ${
                        isSelected ? 'bg-white' : ep.hr_delta_baseline > 3 ? 'bg-rose-400/80' : 'bg-teal-500/60 hover:bg-teal-400'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Selected Epoch Detail Inspector & Live Sandbox */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card A: Epoch Telemetry Inspector */}
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-mono uppercase text-indigo-400 font-bold">Research Inspector</span>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Epoch #{selectedEpoch ? selectedEpoch.epoch_idx : '--'} Telemetry Analysis
              </h3>
            </div>
            {selectedEpoch && (
              <span className="text-xs font-mono text-slate-400">
                T+ {selectedEpoch.time_elapsed_minutes} min
              </span>
            )}
          </div>

          {selectedEpoch ? (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                    Dreem 2 EEG Label
                  </span>
                  <span className="text-lg font-black text-white">
                    {selectedEpoch.expert_label_5class}
                  </span>
                  <span className="text-[11px] text-indigo-400 block font-mono mt-0.5">
                    Stage ID: {selectedEpoch.expert_label_5class} (Ground Truth)
                  </span>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                    Apple Watch Model Prediction
                  </span>
                  <span className="text-lg font-black text-teal-300">
                    {selectedEpoch.model_predicted_5class || 'Pending'}
                  </span>
                  <span className="text-[11px] text-teal-400 block font-mono mt-0.5">
                    Confidence: {selectedEpoch.confidence_pct || 0}%
                  </span>
                </div>
              </div>

              {/* Epoch Features Table */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-[10px] font-mono uppercase text-slate-400 block mb-2 font-bold">
                  Extracted Wearable Features (30s Window)
                </span>
                <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
                  <div>
                    <span className="text-slate-500 block">hr_mean</span>
                    <strong className="text-white">{selectedEpoch.hr_mean} bpm</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">hr_min / max</span>
                    <strong className="text-white">{selectedEpoch.hr_min} / {selectedEpoch.hr_max}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">hr_std</span>
                    <strong className="text-white">{selectedEpoch.hr_std} bpm</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">delta_baseline</span>
                    <strong className={selectedEpoch.hr_delta_baseline >= 0 ? 'text-amber-400' : 'text-emerald-400'}>
                      {selectedEpoch.hr_delta_baseline > 0 ? `+${selectedEpoch.hr_delta_baseline}` : selectedEpoch.hr_delta_baseline} bpm
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">3-Class Group</span>
                    <strong className="text-white">{selectedEpoch.expert_label_3class}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Sample ID</span>
                    <strong className="text-slate-400 truncate block">{selectedEpoch.sample_id}</strong>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-800/40 text-[11px] text-slate-300">
                <strong className="text-indigo-300 font-bold block mb-1">Scientific Verification Note:</strong>
                This observation belongs to public participant <code>{selectedSubject}</code>. It is strictly segregated from personal patient records and never incorporated into MongoDB user health baselines.
              </div>
            </div>
          ) : (
            <div className="text-slate-400 text-xs">Click any epoch in the timeline above to inspect its metrics.</div>
          )}
        </div>

        {/* Card B: Live Single-Epoch Inference Sandbox */}
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-mono uppercase text-teal-400 font-bold">Interactive Sandbox</span>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-400" />
                Live 30-Second Epoch Inference Engine
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => runSandboxInference('wake')}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded text-[10px] font-mono"
              >
                Wake Preset
              </button>
              <button
                onClick={() => runSandboxInference('deep')}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded text-[10px] font-mono"
              >
                Deep N3 Preset
              </button>
              <button
                onClick={() => runSandboxInference('rem')}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-purple-300 rounded text-[10px] font-mono"
              >
                REM Preset
              </button>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1 font-mono text-[10px]">Heart Rate Mean (bpm): {sandboxHrMean}</label>
                <input
                  type="range"
                  min="45"
                  max="110"
                  step="0.5"
                  value={sandboxHrMean}
                  onChange={e => setSandboxHrMean(parseFloat(e.target.value))}
                  className="w-full accent-teal-400"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1 font-mono text-[10px]">Heart Rate Std Dev (bpm): {sandboxHrStd}</label>
                <input
                  type="range"
                  min="0.2"
                  max="10.0"
                  step="0.1"
                  value={sandboxHrStd}
                  onChange={e => setSandboxHrStd(parseFloat(e.target.value))}
                  className="w-full accent-teal-400"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1 font-mono text-[10px]">Delta from Baseline (bpm): {sandboxHrDelta}</label>
                <input
                  type="range"
                  min="-15"
                  max="25"
                  step="0.5"
                  value={sandboxHrDelta}
                  onChange={e => setSandboxHrDelta(parseFloat(e.target.value))}
                  className="w-full accent-teal-400"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1 font-mono text-[10px]">Elapsed Sleep Time (min): {sandboxTimeMin}</label>
                <input
                  type="range"
                  min="0"
                  max="480"
                  step="15"
                  value={sandboxTimeMin}
                  onChange={e => setSandboxTimeMin(parseFloat(e.target.value))}
                  className="w-full accent-teal-400"
                />
              </div>
            </div>

            <button
              onClick={() => runSandboxInference()}
              disabled={sandboxLoading}
              className="w-full py-2 bg-gradient-to-r from-teal-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-teal-500/20 disabled:opacity-50"
            >
              {sandboxLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
              Classify Sleep Stage via FastAPI (/api/v1/ml/sleep-stage/predict)
            </button>

            {sandboxResult && (
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Model Output</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Confidence: {sandboxResult.confidence_pct}%
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-xl font-black text-white">
                    {sandboxResult.predicted_stage_5class}{' '}
                    <span className="text-xs font-normal text-slate-400">({sandboxResult.predicted_stage_3class})</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Model: {sandboxResult.model_version} • Schema: {sandboxResult.feature_schema_version}
                  </div>
                </div>

                {/* 5-Stage Probability Breakdown */}
                {sandboxResult.probabilities_5class && (
                  <div className="pt-2 border-t border-slate-800 space-y-1">
                    <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                      Calibrated Stage Probabilities:
                    </span>
                    <div className="grid grid-cols-5 gap-1.5 text-center font-mono text-[10px]">
                      {Object.entries(sandboxResult.probabilities_5class).map(([stageName, pct]: [string, any]) => (
                        <div key={stageName} className="p-1.5 rounded bg-slate-900 border border-slate-800">
                          <span className="text-slate-400 block">{stageName}</span>
                          <strong className="text-white">{pct}%</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
