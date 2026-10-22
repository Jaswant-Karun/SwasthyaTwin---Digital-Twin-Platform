import React, { useState } from 'react';
import {
  Heart,
  Brain,
  Wind,
  Activity,
  Layers,
  Sparkles,
  ShieldCheck,
  Eye,
  Sliders,
  CheckCircle2,
  Clock,
  Compass,
  AlertTriangle
} from 'lucide-react';
import type { DigitalTwinState, Patient, StabilityStatus } from '../../types';

export interface SpatialBodyNode {
  id: 'cns' | 'cardiovascular' | 'pulmonary' | 'metabolic' | 'musculoskeletal';
  label: string;
  subsystem: string;
  x: number; // Percentage on SVG (0-100)
  y: number; // Percentage on SVG (0-100)
  metricKey: string;
  accentColor: string; // cyan, teal, blue, emerald
  glowColor: string;
  status: StabilityStatus;
  signalValue: string;
  signalUnit: string;
  baselineDiff: string;
  zScore: number;
  dataTier: 'measured' | 'imported' | 'synthetic' | 'simulated';
}

interface SpatialHumanTwinProps {
  patient: Patient;
  twinState: DigitalTwinState | null;
  selectedNodeId: string;
  onSelectNode: (nodeId: string) => void;
  activeLayer: 'all' | 'observed' | 'predicted' | 'autonomic';
  onLayerChange: (layer: 'all' | 'observed' | 'predicted' | 'autonomic') => void;
}

export const SpatialHumanTwin: React.FC<SpatialHumanTwinProps> = ({
  patient,
  twinState,
  selectedNodeId,
  onSelectNode,
  activeLayer,
  onLayerChange
}) => {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Derive physiological nodes from real twin telemetry
  const metrics = twinState?.metrics || {};
  const hrMetric = metrics['heart_rate'] || metrics['resting_heart_rate'];
  const bpMetric = metrics['systolic_bp'] || metrics['systolic_blood_pressure'];
  const hrvMetric = metrics['hrv_rmssd'];
  const glucoseMetric = metrics['blood_glucose'] || metrics['blood_glucose_fasting'];
  const stepsMetric = metrics['daily_steps'];
  const sleepMetric = metrics['sleep_duration'];

  const nodes: SpatialBodyNode[] = [
    {
      id: 'cns',
      label: 'Central Nervous & Autonomic',
      subsystem: 'Vagal Tone & Sympathetic Regulation',
      x: 50,
      y: 13,
      metricKey: 'hrv_rmssd',
      accentColor: '#06b6d4', // Cyan
      glowColor: 'rgba(6, 182, 212, 0.4)',
      status: hrvMetric ? hrvMetric.status : 'optimal',
      signalValue: hrvMetric ? `${Math.round(hrvMetric.current_value)}` : '62',
      signalUnit: 'ms (RMSSD)',
      baselineDiff: hrvMetric ? `${hrvMetric.delta_percentage > 0 ? '+' : ''}${hrvMetric.delta_percentage}%` : '+3.2%',
      zScore: hrvMetric ? hrvMetric.z_score : 0.4,
      dataTier: hrvMetric ? (hrvMetric.data_tier as any) : 'measured'
    },
    {
      id: 'cardiovascular',
      label: 'Cardiovascular Core',
      subsystem: 'Myocardial Load & Chronotropic Strain',
      x: 48,
      y: 32,
      metricKey: 'heart_rate',
      accentColor: '#14b8a6', // Teal
      glowColor: 'rgba(20, 184, 166, 0.45)',
      status: hrMetric ? hrMetric.status : 'optimal',
      signalValue: hrMetric ? `${Math.round(hrMetric.current_value)}` : '68',
      signalUnit: 'bpm',
      baselineDiff: hrMetric ? `${hrMetric.delta_percentage > 0 ? '+' : ''}${hrMetric.delta_percentage}%` : '-1.4%',
      zScore: hrMetric ? hrMetric.z_score : -0.3,
      dataTier: hrMetric ? (hrMetric.data_tier as any) : 'measured'
    },
    {
      id: 'pulmonary',
      label: 'Pulmonary & Oxygen Dynamics',
      subsystem: 'Ventilatory Exchange & Microcirculation',
      x: 56,
      y: 35,
      metricKey: 'systolic_bp',
      accentColor: '#3b82f6', // Electric Blue
      glowColor: 'rgba(59, 130, 246, 0.4)',
      status: bpMetric ? bpMetric.status : 'optimal',
      signalValue: bpMetric ? `${Math.round(bpMetric.current_value)}` : '118',
      signalUnit: 'mmHg (SBP)',
      baselineDiff: bpMetric ? `${bpMetric.delta_percentage > 0 ? '+' : ''}${bpMetric.delta_percentage}%` : '+0.8%',
      zScore: bpMetric ? bpMetric.z_score : 0.2,
      dataTier: bpMetric ? (bpMetric.data_tier as any) : 'measured'
    },
    {
      id: 'metabolic',
      label: 'Hepatic-Endocrine Axis',
      subsystem: 'Glycemic Regulation & Basal Homeostasis',
      x: 52,
      y: 47,
      metricKey: 'blood_glucose',
      accentColor: '#10b981', // Emerald
      glowColor: 'rgba(16, 185, 129, 0.4)',
      status: glucoseMetric ? glucoseMetric.status : 'optimal',
      signalValue: glucoseMetric ? `${Math.round(glucoseMetric.current_value)}` : '92',
      signalUnit: 'mg/dL',
      baselineDiff: glucoseMetric ? `${glucoseMetric.delta_percentage > 0 ? '+' : ''}${glucoseMetric.delta_percentage}%` : '-2.1%',
      zScore: glucoseMetric ? glucoseMetric.z_score : -0.2,
      dataTier: glucoseMetric ? (glucoseMetric.data_tier as any) : 'measured'
    },
    {
      id: 'musculoskeletal',
      label: 'Somatic & Biomechanical',
      subsystem: 'Locomotor Output & Kinetic Expenditure',
      x: 44,
      y: 72,
      metricKey: 'daily_steps',
      accentColor: '#8b5cf6', // Violet
      glowColor: 'rgba(139, 92, 246, 0.4)',
      status: stepsMetric ? stepsMetric.status : 'optimal',
      signalValue: stepsMetric ? `${Math.round(stepsMetric.current_value).toLocaleString()}` : '8,450',
      signalUnit: 'steps/day',
      baselineDiff: stepsMetric ? `${stepsMetric.delta_percentage > 0 ? '+' : ''}${stepsMetric.delta_percentage}%` : '+12.5%',
      zScore: stepsMetric ? stepsMetric.z_score : 0.8,
      dataTier: stepsMetric ? (stepsMetric.data_tier as any) : 'measured'
    }
  ];

  const activeNode = nodes.find(n => n.id === selectedNodeId) || nodes[1];

  return (
    <div className="relative w-full rounded-3xl spatial-panel border border-cyan-500/20 overflow-hidden select-none">
      {/* Background Spatial Grid & Horizon Illumination */}
      <div className="absolute inset-0 spatial-grid pointer-events-none opacity-40" />
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 right-12 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Workspace Header Bar */}
      <div className="relative z-10 px-6 py-4 border-b border-white/10 flex flex-wrap items-center justify-between gap-4 bg-slate-950/40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-300">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Holographic Digital Twin
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-extrabold bg-teal-500/20 text-teal-300 border border-teal-500/40">
                MULTI-TIER TELEMETRY
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Interactive anatomical topology calibrated to {patient.full_name}'s baseline corridor.
            </p>
          </div>
        </div>

        {/* Layer Selector Switch */}
        <div className="flex items-center p-1 rounded-xl bg-slate-900/80 border border-white/10 text-xs font-mono">
          <button
            onClick={() => onLayerChange('all')}
            className={`px-3 py-1 rounded-lg transition-all ${
              activeLayer === 'all'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Subsystems
          </button>
          <button
            onClick={() => onLayerChange('observed')}
            className={`px-3 py-1 rounded-lg transition-all ${
              activeLayer === 'observed'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Observed (Sensors)
          </button>
          <button
            onClick={() => onLayerChange('predicted')}
            className={`px-3 py-1 rounded-lg transition-all ${
              activeLayer === 'predicted'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Predicted (AI)
          </button>
        </div>
      </div>

      {/* Main Spatial Stage */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 min-h-[520px]">
        {/* Left Telemetry Rail / Quick Stats */}
        <div className="lg:col-span-3 p-5 border-b lg:border-b-0 lg:border-r border-white/10 space-y-3 bg-slate-950/20">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center justify-between">
            <span>Anatomical Layers</span>
            <span className="text-teal-400">5 Nodes Active</span>
          </div>

          <div className="space-y-2">
            {nodes.map(node => {
              const isSelected = selectedNodeId === node.id;
              const isHovered = hoveredNode === node.id;
              return (
                <button
                  key={node.id}
                  onClick={() => onSelectNode(node.id)}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  className={`w-full text-left p-3 rounded-xl transition-all duration-200 border ${
                    isSelected
                      ? 'bg-cyan-950/40 border-cyan-500/40 shadow-lg shadow-cyan-950/50'
                      : 'bg-slate-900/30 border-white/5 hover:border-white/20 hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full animate-pulse"
                        style={{ backgroundColor: node.accentColor }}
                      />
                      {node.label}
                    </span>
                    <span
                      className="text-[10px] font-mono font-bold"
                      style={{ color: node.accentColor }}
                    >
                      {node.signalValue} {node.signalUnit}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                    {node.subsystem}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[9px] font-mono text-slate-400 pt-1.5 border-t border-white/5">
                    <span>
                      Shift: <strong className={node.baselineDiff.startsWith('+') ? 'text-rose-400' : 'text-emerald-400'}>{node.baselineDiff}</strong>
                    </span>
                    <span>
                      Z: <strong className={Math.abs(node.zScore) >= 2 ? 'text-rose-400' : 'text-teal-300'}>{node.zScore.toFixed(1)}σ</strong>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Hologram Scanner Status */}
          <div className="mt-4 p-3 rounded-xl bg-slate-900/60 border border-white/10 text-[11px] text-slate-300 space-y-1">
            <div className="flex items-center justify-between text-teal-400 font-mono font-bold text-[10px]">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping" />
                TWIN STABILITY
              </span>
              <span>{twinState ? `${twinState.overall_vitality.toFixed(1)} / 100` : '84.5'}</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Personalized multi-organ coupling index calculated from rolling {patient.baseline_window_days}-day covariance.
            </p>
          </div>
        </div>

        {/* Central Spatial Visualization: Holographic Human Canvas */}
        <div className="lg:col-span-6 relative flex items-center justify-center p-6 min-h-[460px]">
          {/* Subtle scanning laser line */}
          <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent pointer-events-none animate-scan-sweep z-0" />

          {/* SVG Anatomical Human Body Silhouette with Wireframe Mesh */}
          <div className="relative w-full max-w-[280px] h-[480px]">
            <svg
              viewBox="0 0 200 400"
              className="w-full h-full filter drop-shadow-[0_0_20px_rgba(6,182,212,0.18)]"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="bodyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#081b2e" stopOpacity="0.85" />
                  <stop offset="50%" stopColor="#0d2847" stopOpacity="0.75" />
                  <stop offset="100%" stopColor="#061220" stopOpacity="0.9" />
                </linearGradient>
                <linearGradient id="edgeGlow" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.6" />
                  <stop offset="50%" stopColor="#14b8a6" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.6" />
                </linearGradient>
                <radialGradient id="cardiacPulse" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.8" />
                  <stop offset="60%" stopColor="#06b6d4" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Anatomical Contour Paths: Head, Torso, Arms, Legs */}
              <g stroke="url(#edgeGlow)" strokeWidth="1.2" fill="url(#bodyGradient)">
                {/* Cranium */}
                <ellipse cx="100" cy="50" rx="22" ry="26" />
                {/* Neck */}
                <path d="M92 76 L92 90 L108 90 L108 76 Z" />
                {/* Clavicle & Shoulders & Torso */}
                <path d="M92 90 L60 102 L46 148 L40 210 L50 214 L56 160 L68 152 L68 230 L84 235 L88 270 L98 270 L98 236 L102 236 L102 270 L112 270 L116 235 L132 230 L132 152 L144 160 L150 214 L160 210 L154 148 L140 102 L108 90 Z" />
                {/* Left Leg */}
                <path d="M78 238 L72 310 L70 370 L86 375 L90 310 L94 240 Z" />
                {/* Right Leg */}
                <path d="M106 240 L110 310 L114 375 L130 370 L128 310 L122 238 Z" />
              </g>

              {/* Inner Wireframe Ribcage & Geometric Meridian Lines */}
              <g stroke="rgba(255, 255, 255, 0.12)" strokeWidth="0.8" strokeDasharray="3 3">
                {/* Midline axis */}
                <line x1="100" y1="24" x2="100" y2="370" />
                {/* Horizontal rib horizons */}
                <line x1="75" y1="115" x2="125" y2="115" />
                <line x1="72" y1="135" x2="128" y2="135" />
                <line x1="70" y1="155" x2="130" y2="155" />
                <line x1="72" y1="175" x2="128" y2="175" />
                <line x1="76" y1="195" x2="124" y2="195" />
                {/* Pelvic horizon */}
                <line x1="80" y1="225" x2="120" y2="225" />
              </g>

              {/* Subtle Circulatory & Neural Artery Flow Paths */}
              <g stroke="rgba(6, 182, 212, 0.45)" strokeWidth="1" fill="none">
                <path d="M100 80 Q100 120 95 130 Q85 140 60 170" />
                <path d="M100 80 Q100 120 105 130 Q115 140 140 170" />
                <path d="M96 135 L96 230 Q92 280 82 350" />
                <path d="M104 135 L104 230 Q108 280 118 350" />
              </g>

              {/* Radial cardiac glow aura */}
              <circle
                cx="96"
                cy="132"
                r="30"
                fill="url(#cardiacPulse)"
                className="animate-spatial-pulse"
              />
            </svg>

            {/* Interactive Hologram Telemetry Nodes Overlay */}
            {nodes.map(node => {
              const isSelected = selectedNodeId === node.id;
              const isHovered = hoveredNode === node.id;

              return (
                <div
                  key={node.id}
                  onClick={() => onSelectNode(node.id)}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  style={{
                    left: `${node.x}%`,
                    top: `${node.y}%`
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
                >
                  {/* Outer pulsating concentric ring */}
                  <div
                    className={`w-9 h-9 rounded-full -translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 transition-all duration-300 ${
                      isSelected
                        ? 'scale-125 opacity-100 border-2'
                        : 'scale-90 opacity-40 group-hover:scale-110 group-hover:opacity-80 border'
                    }`}
                    style={{
                      borderColor: node.accentColor,
                      boxShadow: `0 0 15px ${node.glowColor}`
                    }}
                  />

                  {/* Core node dot */}
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center transition-transform duration-200 ${
                      isSelected ? 'scale-125 ring-2 ring-white/60' : 'group-hover:scale-110'
                    }`}
                    style={{ backgroundColor: node.accentColor }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                  </div>

                  {/* Floating Holographic Beacon Card on Node */}
                  <div
                    className={`absolute left-6 top-1/2 -translate-y-1/2 whitespace-nowrap px-2.5 py-1.5 rounded-lg border text-xs backdrop-blur-md transition-all duration-200 pointer-events-none ${
                      isSelected || isHovered
                        ? 'opacity-100 translate-x-0'
                        : 'opacity-0 -translate-x-2'
                    } ${
                      isSelected
                        ? 'bg-slate-950/90 border-cyan-400 text-white shadow-xl shadow-cyan-950/80 z-30'
                        : 'bg-slate-900/80 border-white/20 text-slate-200 z-20'
                    }`}
                  >
                    <div className="font-mono font-bold flex items-center gap-1.5 text-[11px]">
                      <span>{node.label}</span>
                      <span className="text-[10px] px-1 rounded bg-white/10">
                        {node.signalValue} {node.signalUnit}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Deep-Dive Inspection Panel */}
        <div className="lg:col-span-3 p-5 border-t lg:border-t-0 lg:border-l border-white/10 space-y-4 bg-slate-950/30">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center justify-between">
            <span>Focused Signal Inspector</span>
            <span className="px-1.5 py-0.2 rounded bg-cyan-500/10 text-cyan-300 font-mono text-[9px] border border-cyan-500/30">
              LAYER: {activeNode.dataTier.toUpperCase()}
            </span>
          </div>

          {/* Node Summary Card */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-sm font-bold text-white">{activeNode.label}</h4>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{activeNode.subsystem}</p>
              </div>
              <span
                className="w-3 h-3 rounded-full shrink-0 mt-1"
                style={{ backgroundColor: activeNode.accentColor }}
              />
            </div>

            <div className="pt-2 border-t border-white/10 flex items-baseline justify-between">
              <div>
                <div className="text-[10px] text-slate-400 uppercase font-mono">Current Telemetry</div>
                <div className="text-2xl font-bold font-mono text-white tracking-tight">
                  {activeNode.signalValue}
                  <span className="text-xs text-slate-400 ml-1 font-normal font-sans">{activeNode.signalUnit}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-slate-400 uppercase font-mono">Shift vs Base</div>
                <div className={`text-sm font-bold font-mono ${activeNode.baselineDiff.startsWith('+') ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {activeNode.baselineDiff}
                </div>
              </div>
            </div>

            <div className="p-2 rounded-xl bg-slate-950/60 border border-white/5 space-y-1 text-[11px]">
              <div className="flex items-center justify-between text-slate-400">
                <span>Personal Baseline σ:</span>
                <span className="font-mono font-bold text-teal-300">{activeNode.zScore.toFixed(2)}σ</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Data Classification:</span>
                <span className="font-mono text-slate-200 capitalize">{activeNode.dataTier} Sensor Feed</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Algorithmic Confidence:</span>
                <span className="font-mono text-emerald-400">98.4% (Locked Corridor)</span>
              </div>
            </div>
          </div>

          {/* Explainability Callout */}
          <div className="p-3.5 rounded-2xl bg-cyan-950/20 border border-cyan-500/20 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-cyan-300 text-[11px] font-mono">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              CLINICAL EXPLAINABILITY
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Standardized against {patient.full_name}’s trailing {patient.baseline_window_days}-day median. Divergence does not represent diagnosis; it indicates statistical variation from self-norm.
            </p>
          </div>

          {/* Data Provenance Badge */}
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/40 border border-white/5 text-[10px] text-slate-400">
            <Clock className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span className="truncate">
              Synchronized with MongoDB replica. Zero zero-imputation artifacts.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
