import React, { useState } from 'react';
import {
  HeartPulse,
  Sliders,
  Clock,
  Layers,
  Sparkles,
  ShieldAlert,
  Info,
  CheckCircle2,
  Calendar,
  Zap,
  Activity,
  ArrowRight,
  User,
  ShieldCheck
} from 'lucide-react';
import { useTwin } from '../../context/TwinContext';
import { SpatialHumanTwin } from '../spatial/SpatialHumanTwin';
import { SpatialTimelineInspector } from '../spatial/SpatialTimelineInspector';
import { WhatIfScenarioPanel } from '../spatial/WhatIfScenarioPanel';
import { AIOpticalTwinScanner } from '../scanner/AIOpticalTwinScanner';
import { StatusBadge } from '../common/StatusBadge';
import { HowCalculatedButton } from '../common/HowCalculatedButton';

interface DigitalTwinPageProps {
  onNavigate?: (tab: string) => void;
}

export const DigitalTwinPage: React.FC<DigitalTwinPageProps> = ({ onNavigate }) => {
  const { currentPatient, twinState, assessment, latestUpdateInfo } = useTwin();

  // Spatial Twin state
  const [selectedNodeId, setSelectedNodeId] = useState<string>('cardiovascular');
  const [activeLayer, setActiveLayer] = useState<'all' | 'observed' | 'predicted' | 'autonomic'>('all');
  const [activeViewTab, setActiveViewTab] = useState<'spatial_twin' | 'bio_scan' | 'timeline' | 'scenario'>('spatial_twin');
  const [selectedTimelineMetric, setSelectedTimelineMetric] = useState<'heart_rate' | 'systolic_bp' | 'hrv_rmssd' | 'vitality'>('heart_rate');
  const [timelineDays, setTimelineDays] = useState<number>(30);

  if (!currentPatient || !twinState) {
    return (
      <div className="spatial-panel rounded-3xl p-12 text-center text-slate-400 font-mono text-xs">
        <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        Synchronizing Spatial Digital Twin with Patient Telemetry...
      </div>
    );
  }

  const metrics = Object.values(twinState.metrics);
  const lifestyle = currentPatient.lifestyle_profile;

  return (
    <div className="space-y-6">
      {/* 1. Spatial Experience Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 shadow-lg shadow-teal-500/10">
              <HeartPulse className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Autonomous Spatial Digital Twin
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-teal-500/20 text-teal-300 border border-teal-500/40">
                  SPATIAL v2.4
                </span>
                {currentPatient.demo_data || currentPatient.patient_id.startsWith('PT-100') ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-amber-500/20 text-amber-300 border border-amber-500/50 flex items-center gap-1">
                    🔬 RESEARCH DEMO COHORT
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 flex items-center gap-1">
                    👤 LIVE CLINICAL USER
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Multi-layer physiological model of <strong className="text-white">{currentPatient.full_name}</strong> calibrated to personal longitudinal baselines.
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center p-1 rounded-2xl bg-slate-900/90 border border-white/10 text-xs font-mono self-start md:self-auto">
          <button
            onClick={() => setActiveViewTab('spatial_twin')}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-2 ${
              activeViewTab === 'spatial_twin'
                ? 'bg-gradient-to-r from-teal-500/30 to-cyan-500/30 text-cyan-200 border border-cyan-500/40 font-bold shadow-md shadow-cyan-950/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>Spatial Twin</span>
          </button>
          <button
            onClick={() => setActiveViewTab('timeline')}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-2 ${
              activeViewTab === 'timeline'
                ? 'bg-gradient-to-r from-teal-500/30 to-cyan-500/30 text-cyan-200 border border-cyan-500/40 font-bold shadow-md shadow-cyan-950/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-teal-400" />
            <span>Telemetry Timeline</span>
          </button>
          <button
            onClick={() => setActiveViewTab('scenario')}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-2 ${
              activeViewTab === 'scenario'
                ? 'bg-gradient-to-r from-teal-500/30 to-cyan-500/30 text-cyan-200 border border-cyan-500/40 font-bold shadow-md shadow-cyan-950/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-blue-400" />
            <span>What-If Lab</span>
          </button>
          <button
            onClick={() => setActiveViewTab('bio_scan')}
            className={`px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-2 ${
              activeViewTab === 'bio_scan'
                ? 'bg-gradient-to-r from-teal-500/30 to-cyan-500/30 text-cyan-200 border border-cyan-500/40 font-bold shadow-md shadow-cyan-950/50'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span>AI Bio-Scan</span>
          </button>
        </div>
      </div>

      {/* 2. Patient Context Badge Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs font-mono">
        <div className="p-3 rounded-2xl spatial-panel border border-white/10 flex items-center justify-between">
          <span className="text-slate-400">PATIENT ID</span>
          <span className="text-white font-bold">{currentPatient.patient_id}</span>
        </div>
        <div className="p-3 rounded-2xl spatial-panel border border-white/10 flex items-center justify-between">
          <span className="text-slate-400">BASELINE CORRIDOR</span>
          <span className="text-teal-300 font-bold">{currentPatient.baseline_window_days} Days Rolling</span>
        </div>
        <div className="p-3 rounded-2xl spatial-panel border border-white/10 flex items-center justify-between">
          <span className="text-slate-400">VITALITY STATUS</span>
          <span className="text-emerald-300 font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {twinState.stability_status.replace(/_/g, ' ').toUpperCase()}
          </span>
        </div>
        <div className="p-3 rounded-2xl spatial-panel border border-white/10 flex items-center justify-between">
          <span className="text-slate-400">PROVENANCE INTEGRITY</span>
          <span className="text-cyan-300 font-bold flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            Zero Zero-Imputation
          </span>
        </div>
      </div>

      {/* 3. Primary Experience Views */}
      {activeViewTab === 'spatial_twin' && (
        <div className="space-y-6 animate-fade-in">
          {/* Spatial Human Twin Interactive Visualizer */}
          <SpatialHumanTwin
            patient={currentPatient}
            twinState={twinState}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            activeLayer={activeLayer}
            onLayerChange={setActiveLayer}
          />

          {/* Quick Timeline Preview Card Below Twin */}
          <SpatialTimelineInspector
            patient={currentPatient}
            twinState={twinState}
            selectedMetric={selectedTimelineMetric}
            onMetricChange={setSelectedTimelineMetric}
            timelineDays={timelineDays}
            onTimelineDaysChange={setTimelineDays}
          />
        </div>
      )}

      {activeViewTab === 'timeline' && (
        <div className="space-y-6 animate-fade-in">
          <SpatialTimelineInspector
            patient={currentPatient}
            twinState={twinState}
            selectedMetric={selectedTimelineMetric}
            onMetricChange={setSelectedTimelineMetric}
            timelineDays={timelineDays}
            onTimelineDaysChange={setTimelineDays}
          />

          {/* Chronological Measurements & Telemetry Audit Card */}
          <div className="rounded-3xl spatial-panel p-6 border border-white/10 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-teal-400" />
                Active Telemetry Packets & Ingestion Auditing
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                Showing latest verified observations
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {metrics.map(m => (
                <div key={m.metric_type} className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white capitalize">{m.metric_type.replace(/_/g, ' ')}</span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-white/10 text-slate-300 uppercase">
                      {m.data_tier}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-bold font-mono text-white">
                      {m.metric_type === 'daily_steps' ? Math.round(m.current_value).toLocaleString() : m.current_value.toFixed(1)}
                      <span className="text-xs text-slate-400 ml-1 font-sans">{m.unit}</span>
                    </span>
                    <span className={`text-xs font-bold font-mono ${m.delta_percentage > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {m.delta_percentage > 0 ? `+${m.delta_percentage}%` : `${m.delta_percentage}%`}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>Base: {m.baseline_mean.toFixed(1)} {m.unit}</span>
                    <span>Z: {m.z_score.toFixed(1)}σ</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeViewTab === 'scenario' && (
        <div className="space-y-6 animate-fade-in">
          <WhatIfScenarioPanel />
        </div>
      )}

      {activeViewTab === 'bio_scan' && (
        <div className="space-y-6 animate-fade-in">
          <AIOpticalTwinScanner />
        </div>
      )}

      {/* 4. Clinical Context & Conditions Footprint */}
      <div className="rounded-3xl spatial-panel p-6 border border-white/10 space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
            <User className="w-4 h-4 text-cyan-400" />
            Clinical Baseline & Demographic Grounding
          </h3>
          <span className="text-xs font-mono text-slate-400">
            Age: {currentPatient.age}y • Sex: {currentPatient.biological_sex.toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-2">
            <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Documented Conditions</span>
            <div className="flex flex-wrap gap-2">
              {currentPatient.chronic_conditions.map((c, i) => (
                <span key={i} className="px-3 py-1 rounded-xl bg-slate-900/80 border border-white/10 text-slate-200 font-medium">
                  {c}
                </span>
              ))}
              <span className="px-3 py-1 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-300">
                Physician: {currentPatient.primary_physician || 'Preventive Medicine'}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Target Lifestyle Envelope</span>
            <div className="grid grid-cols-2 gap-2 font-mono">
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5">
                <span className="text-[10px] text-slate-400 block">Sleep Target</span>
                <span className="font-bold text-white">{lifestyle?.baseline_sleep_hours || 7.5} hrs/night</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5">
                <span className="text-[10px] text-slate-400 block">Step Goal</span>
                <span className="font-bold text-white">{lifestyle?.baseline_daily_steps?.toLocaleString() || '7,000'} steps</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
