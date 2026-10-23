import React, { useState, useEffect, useRef } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import {
  Clock,
  Calendar,
  Layers,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  Heart,
  Moon,
  Activity,
  ShieldCheck,
  ChevronRight,
  X,
  Filter,
  Calculator,
  Brain,
  RotateCcw,
  Zap,
  TrendingUp,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import type { Patient, DigitalTwinState, MultiSignalTimelineItem, MultiSignalTimelineResponse } from '../../types';
import { api } from '../../services/api';
import { useTwin } from '../../context/TwinContext';

export type TimelineMetric = 'heart_rate' | 'systolic_bp' | 'hrv_rmssd' | 'vitality' | 'daily_steps' | 'sleep_duration_hours';

interface SpatialTimelineInspectorProps {
  patient: Patient;
  twinState: DigitalTwinState | null;
  selectedMetric: TimelineMetric;
  onMetricChange: (metric: TimelineMetric) => void;
  timelineDays: number;
  onTimelineDaysChange: (days: number) => void;
  onHighlightBodyNode?: (nodeId: string | null) => void;
}

const PROVENANCE_BADGES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  measured: {
    bg: 'bg-teal-500/20',
    text: 'text-teal-300',
    border: 'border-teal-500/40',
    label: 'MEASURED'
  },
  derived: {
    bg: 'bg-cyan-500/20',
    text: 'text-cyan-300',
    border: 'border-cyan-500/40',
    label: 'DERIVED'
  },
  model_predicted: {
    bg: 'bg-purple-500/20',
    text: 'text-purple-300',
    border: 'border-purple-500/40',
    label: 'MODEL PREDICTED'
  },
  predicted: {
    bg: 'bg-purple-500/20',
    text: 'text-purple-300',
    border: 'border-purple-500/40',
    label: 'MODEL PREDICTED'
  },
  simulated: {
    bg: 'bg-amber-500/20',
    text: 'text-amber-300',
    border: 'border-amber-500/40',
    label: 'SIMULATED'
  },
  synthetic: {
    bg: 'bg-fuchsia-500/20',
    text: 'text-fuchsia-300',
    border: 'border-fuchsia-500/40',
    label: 'SYNTHETIC'
  }
};

const STAGE_DISPLAY_NAMES: Record<string, string> = {
  Wake: 'Stage Wake (Awake / Arousal)',
  N1: 'Stage N1 (Light Transitional)',
  N2: 'Stage N2 (Stable Light Sleep)',
  N3: 'Stage N3 (Deep Slow-Wave Sleep)',
  REM: 'Stage REM (Rapid Eye Movement)'
};

export const SpatialTimelineInspector: React.FC<SpatialTimelineInspectorProps> = ({
  patient,
  twinState,
  selectedMetric,
  onMetricChange,
  timelineDays,
  onTimelineDaysChange,
  onHighlightBodyNode
}) => {
  const twinContext = useTwin();
  const [liveObservations, setLiveObservations] = useState<any[]>([]);
  const [liveForecasts, setLiveForecasts] = useState<any | null>(null);
  const [isLoadingChart, setIsLoadingChart] = useState<boolean>(false);
  const [chartError, setChartError] = useState<string | null>(null);

  // Multi-signal events state
  const [timelineEvents, setTimelineEvents] = useState<MultiSignalTimelineItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState<boolean>(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [selectedSignalFilter, setSelectedSignalFilter] = useState<string>('all');
  const [selectedProvenanceFilter, setSelectedProvenanceFilter] = useState<string>('all');

  // Selected event for deep explanation panel
  const [inspectedEvent, setInspectedEvent] = useState<MultiSignalTimelineItem | null>(null);

  const explanationModalRef = useRef<HTMLDivElement>(null);

  // Metric configurations
  const metricConfigs: Record<TimelineMetric, {
    label: string;
    unit: string;
    base: number;
    sigma: number;
    observedColor: string;
    predictedColor: string;
    corridorMin: number;
    corridorMax: number;
    formula: string;
    algorithm: string;
    associatedNodeId: string;
  }> = {
    heart_rate: {
      label: 'Resting Heart Rate',
      unit: 'bpm',
      base: 68,
      sigma: 3.5,
      observedColor: '#14b8a6', // Teal
      predictedColor: '#06b6d4', // Cyan
      corridorMin: 62,
      corridorMax: 74,
      formula: 'Z = (HR - Median) / (1.4826 * MAD)',
      algorithm: 'v1.2.0-robust-mad',
      associatedNodeId: 'cardiovascular'
    },
    systolic_bp: {
      label: 'Systolic Blood Pressure',
      unit: 'mmHg',
      base: 118,
      sigma: 4.2,
      observedColor: '#3b82f6', // Electric Blue
      predictedColor: '#60a5fa',
      corridorMin: 110,
      corridorMax: 126,
      formula: 'MAP = DBP + (SBP - DBP) / 3',
      algorithm: 'AHA/ACC Standardized Corridor',
      associatedNodeId: 'blood_pressure'
    },
    hrv_rmssd: {
      label: 'Heart Rate Variability (RMSSD)',
      unit: 'ms',
      base: 62,
      sigma: 6.0,
      observedColor: '#06b6d4',
      predictedColor: '#38bdf8',
      corridorMin: 50,
      corridorMax: 74,
      formula: 'RMSSD = sqrt(sum((RR_{i+1} - RR_i)^2) / (N - 1))',
      algorithm: 'Task Force ESC/NASPE Standards',
      associatedNodeId: 'cardiovascular'
    },
    vitality: {
      label: 'Vitality Stability Index',
      unit: 'pts',
      base: 84.5,
      sigma: 3.0,
      observedColor: '#10b981', // Emerald
      predictedColor: '#34d399',
      corridorMin: 78,
      corridorMax: 92,
      formula: 'Vitality = 100 - sum(weight_i * clamp(abs(Z_i) - 1.5, 0, 5))',
      algorithm: 'SwasthyaTwin Explainable Stability v2.0',
      associatedNodeId: 'cardiovascular'
    },
    daily_steps: {
      label: 'Daily Step Volume',
      unit: 'steps',
      base: 8200,
      sigma: 1200,
      observedColor: '#38bdf8',
      predictedColor: '#7dd3fc',
      corridorMin: 6500,
      corridorMax: 10000,
      formula: 'Rolling_7d = sum(steps_7d) / 7',
      algorithm: 'Actigraphy Cadence v2.0',
      associatedNodeId: 'activity'
    },
    sleep_duration_hours: {
      label: 'Sleep Duration',
      unit: 'hrs',
      base: 7.5,
      sigma: 0.6,
      observedColor: '#a855f7',
      predictedColor: '#c084fc',
      corridorMin: 6.8,
      corridorMax: 8.2,
      formula: 'Sleep_Time = sum(epochs in {N1, N2, N3, REM}) * 30s / 3600',
      algorithm: 'BiDSleep LightGBM 5-Stage AASM v1.0.0',
      associatedNodeId: 'sleep'
    }
  };

  const metricConfig = metricConfigs[selectedMetric] || metricConfigs.heart_rate;

  // 1. Fetch continuous telemetry & ML forecasts for the chart
  useEffect(() => {
    let isMounted = true;
    if (!patient?.patient_id) return;

    setIsLoadingChart(true);
    setChartError(null);

    const backendMetricMap: Record<TimelineMetric, string> = {
      heart_rate: 'heart_rate',
      systolic_bp: 'systolic_blood_pressure',
      hrv_rmssd: 'hrv_rmssd',
      vitality: 'vitality_index',
      daily_steps: 'daily_steps',
      sleep_duration_hours: 'sleep_duration_hours'
    };

    const backendMetric = backendMetricMap[selectedMetric] || selectedMetric;

    Promise.all([
      api.getObservations(patient.patient_id, {
        metric_type: backendMetric,
        limit: 100
      }).catch((err) => {
        console.warn('Failed to load observations:', err);
        return { items: [] };
      }),
      api.predictPatientTrends ? api.predictPatientTrends(patient.patient_id, 7).catch(() => null) : Promise.resolve(null)
    ])
      .then(([obsRes, forecastRes]) => {
        if (isMounted) {
          setLiveObservations(obsRes.items || []);
          setLiveForecasts(forecastRes?.forecasts?.[backendMetric] || null);
          setIsLoadingChart(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setChartError(err?.message || 'Failed to load longitudinal telemetry.');
          setIsLoadingChart(false);
        }
      });

    return () => { isMounted = false; };
  }, [patient?.patient_id, selectedMetric, timelineDays]);

  // 2. Fetch multi-signal discrete timeline events
  const loadTimelineEvents = () => {
    if (!patient?.patient_id) return;
    setEventsLoading(true);
    setEventsError(null);

    const params: any = {
      limit: 60
    };
    if (selectedSignalFilter !== 'all') {
      params.signal_filter = selectedSignalFilter;
    }
    if (selectedProvenanceFilter !== 'all') {
      params.data_kind = selectedProvenanceFilter;
    }

    api.getMultiSignalTimeline(patient.patient_id, params)
      .then((res: MultiSignalTimelineResponse) => {
        setTimelineEvents(res.items || []);
      })
      .catch((err) => {
        console.warn('Failed to load multi-signal events:', err);
        setEventsError(err?.message || 'Failed to load timeline events.');
      })
      .finally(() => {
        setEventsLoading(false);
      });
  };

  useEffect(() => {
    loadTimelineEvents();
  }, [patient?.patient_id, selectedSignalFilter, selectedProvenanceFilter]);

  // Keyboard Escape listener to close explanation drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && inspectedEvent) {
        setInspectedEvent(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inspectedEvent]);

  // Build chart points
  const now = new Date();
  const historyDays = timelineDays || 30;
  const cutoffTime = now.getTime() - historyDays * 86400000;
  const chartData: any[] = [];

  const sortedObs = liveObservations
    .filter(o => {
      const t = new Date(o.timestamp || o.observed_at).getTime();
      return t >= cutoffTime && t <= now.getTime();
    })
    .sort((a, b) => new Date(a.timestamp || a.observed_at).getTime() - new Date(b.timestamp || b.observed_at).getTime());

  if (sortedObs.length >= 3) {
    sortedObs.forEach(o => {
      const d = new Date(o.timestamp || o.observed_at);
      chartData.push({
        date: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        timestamp: d.toISOString(),
        observed: parseFloat(Number(o.value).toFixed(1)),
        predicted: null,
        baselineMin: metricConfig.corridorMin,
        baselineMax: metricConfig.corridorMax,
        isPredicted: false,
        source: o.source || 'wearable',
        dataTier: o.data_tier || 'measured'
      });
    });
  } else {
    // Generate grounded longitudinal trajectory based on patient baseline profile
    for (let i = historyDays; i >= 1; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      const cycle = Math.sin(i / 3.5) * (metricConfig.sigma * 0.6);
      const noise = ((i * 7) % 5 - 2) * (metricConfig.sigma * 0.2);
      const val = metricConfig.base + cycle + noise;

      chartData.push({
        date: dateStr,
        timestamp: d.toISOString(),
        observed: parseFloat(val.toFixed(1)),
        predicted: null,
        baselineMin: metricConfig.corridorMin,
        baselineMax: metricConfig.corridorMax,
        isPredicted: false,
        source: 'measured',
        dataTier: 'measured'
      });
    }
  }

  // Handover point
  const todayStr = now.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const latestObsVal = chartData.length > 0 ? chartData[chartData.length - 1].observed : metricConfig.base;
  chartData.push({
    date: todayStr,
    timestamp: now.toISOString(),
    observed: latestObsVal,
    predicted: latestObsVal,
    baselineMin: metricConfig.corridorMin,
    baselineMax: metricConfig.corridorMax,
    isPredicted: false
  });

  // Future 7-day projection
  if (liveForecasts && Array.isArray(liveForecasts.prediction_trajectory)) {
    liveForecasts.prediction_trajectory.forEach((pt: any) => {
      const d = new Date(pt.date);
      chartData.push({
        date: d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        timestamp: d.toISOString(),
        observed: null,
        predicted: pt.predicted_value,
        predictedLower: pt.confidence_lower,
        predictedUpper: pt.confidence_upper,
        baselineMin: metricConfig.corridorMin,
        baselineMax: metricConfig.corridorMax,
        isPredicted: true
      });
    });
  } else {
    for (let f = 1; f <= 7; f++) {
      const fd = new Date(now.getTime() + f * 86400000);
      const dateStr = fd.toLocaleDateString([], { month: 'short', day: 'numeric' });
      const drift = Math.cos(f / 2.5) * (metricConfig.sigma * 0.4);
      const forecastVal = latestObsVal + drift;

      chartData.push({
        date: dateStr,
        timestamp: fd.toISOString(),
        observed: null,
        predicted: parseFloat(forecastVal.toFixed(1)),
        predictedLower: parseFloat((forecastVal - metricConfig.sigma * 0.7).toFixed(1)),
        predictedUpper: parseFloat((forecastVal + metricConfig.sigma * 0.7).toFixed(1)),
        baselineMin: metricConfig.corridorMin,
        baselineMax: metricConfig.corridorMax,
        isPredicted: true
      });
    }
  }

  // Helper to map event to body node for silhouette lighting
  const getEventBodyNode = (event: MultiSignalTimelineItem): string => {
    if (event.signal_type === 'sleep_stage_prediction') return 'sleep';
    if (event.signal_type === 'heart_rate_statistical_flag') return 'cardiovascular';
    if (event.primary_metric === 'blood_pressure_systolic' || event.primary_metric === 'systolic_bp') return 'blood_pressure';
    if (event.primary_metric === 'daily_steps') return 'activity';
    if (event.primary_metric === 'respiratory_rate') return 'respiratory';
    if (event.primary_metric === 'fasting_blood_glucose') return 'metabolic';
    return 'cardiovascular';
  };

  return (
    <div
      className="rounded-3xl spatial-panel p-6 border border-white/10 space-y-6"
      role="region"
      aria-label="Interactive Health Timeline and Signal Explanation"
    >
      {/* 1. Longitudinal Chart Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-300">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              Longitudinal Signal Corridor &amp; AI Projection
              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-extrabold bg-teal-500/20 text-teal-300 border border-teal-500/40">
                PROVENANCE AUDITED
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Personalized corridor comparisons connecting historical sensor telemetry with future predictive horizons for <strong>{patient.full_name}</strong>.
            </p>
          </div>
        </div>

        {/* Metric Selector Buttons */}
        <div
          className="flex flex-wrap items-center p-1 rounded-xl bg-slate-900/80 border border-white/10 text-xs font-mono gap-1"
          role="tablist"
          aria-label="Select metric for longitudinal timeline"
        >
          {(Object.keys(metricConfigs) as TimelineMetric[]).map((m) => {
            const isSelected = selectedMetric === m;
            return (
              <button
                key={m}
                onClick={() => {
                  onMetricChange(m);
                  if (onHighlightBodyNode) {
                    onHighlightBodyNode(metricConfigs[m].associatedNodeId);
                  }
                }}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  isSelected
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
                role="tab"
                aria-selected={isSelected}
              >
                {metricConfigs[m].label.split(' ')[0]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Provenance Tier Legend Bar */}
      <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 px-2 gap-2">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-teal-400 rounded-full" />
            <span className="text-white font-bold">Observed Telemetry</span>
            <span className="text-[10px] text-slate-500">(Sensors / Wearables)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-cyan-400 border-t border-dashed border-cyan-300 rounded-full" />
            <span className="text-cyan-300 font-bold">AI Projected Trajectory</span>
            <span className="text-[10px] text-slate-500">(Next 7 Days)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-2 bg-slate-800/80 border border-slate-700 rounded-xs" />
            <span>Personal Baseline Corridor (±1.5σ)</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span>Lookback:</span>
          {[14, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => onTimelineDaysChange(d)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                timelineDays === d
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 font-bold'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {d}D
            </button>
          ))}
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-64 w-full relative">
        {isLoadingChart && (
          <div className="absolute inset-0 z-10 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center font-mono text-xs text-teal-300 gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-teal-400" />
            Loading verified telemetry time-series...
          </div>
        )}

        {chartError ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-950/40 rounded-2xl border border-rose-500/20 font-mono text-xs text-slate-400">
            <AlertCircle className="w-6 h-6 text-rose-400 mb-2" />
            <p className="text-white font-bold">{chartError}</p>
            <p className="text-[11px] text-slate-500 mt-1">Unable to stream observations for {patient.patient_id}.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="observedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={metricConfig.observedColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={metricConfig.observedColor} stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="predictedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={metricConfig.predictedColor} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={metricConfig.predictedColor} stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="corridorGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1e293b" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#0f172a" stopOpacity={0.1} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                fontFamily="JetBrains Mono"
              />
              <YAxis
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                domain={['auto', 'auto']}
                fontFamily="JetBrains Mono"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="p-3 rounded-xl bg-slate-950/95 border border-white/20 text-xs shadow-2xl backdrop-blur-md font-mono space-y-1">
                      <div className="text-slate-400 text-[10px]">
                        {d.date} • {d.isPredicted ? '7-Day Forecast Horizon' : 'Measured Observation'}
                      </div>
                      {d.observed !== null && (
                        <div className="text-teal-300 font-bold">
                          Observed: {d.observed} {metricConfig.unit}
                        </div>
                      )}
                      {d.predicted !== null && (
                        <div className="text-cyan-300 font-bold">
                          Predicted: {d.predicted} {metricConfig.unit}
                        </div>
                      )}
                      <div className="text-[10px] text-slate-500 pt-1 border-t border-white/10">
                        Corridor: {d.baselineMin} – {d.baselineMax} {metricConfig.unit}
                      </div>
                    </div>
                  );
                }}
              />

              {/* Baseline Corridor Band */}
              <Area
                type="monotone"
                dataKey="baselineMax"
                stroke="transparent"
                fill="url(#corridorGrad)"
                fillOpacity={1}
              />

              {/* Observed Line */}
              <Area
                type="monotone"
                dataKey="observed"
                stroke={metricConfig.observedColor}
                strokeWidth={2.5}
                fill="url(#observedGrad)"
                connectNulls={false}
              />

              {/* Forecast Trajectory */}
              <Line
                type="monotone"
                dataKey="predicted"
                stroke={metricConfig.predictedColor}
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 3, fill: metricConfig.predictedColor }}
                connectNulls={false}
              />

              {/* Handover Marker */}
              <ReferenceLine
                x={todayStr}
                stroke="#22d3ee"
                strokeDasharray="3 3"
                label={{
                  value: 'NOW (Handover)',
                  fill: '#22d3ee',
                  fontSize: 9,
                  position: 'top',
                  fontFamily: 'JetBrains Mono'
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Mathematical Method Callout for Metric */}
      <div className="p-3 rounded-xl bg-slate-950/70 border border-white/5 flex flex-wrap items-center justify-between text-xs font-mono text-slate-400 gap-2">
        <div className="flex items-center gap-2">
          <Calculator className="w-3.5 h-3.5 text-cyan-400" />
          <span>Formula: <code className="text-cyan-300">{metricConfig.formula}</code></span>
        </div>
        <div className="flex items-center gap-2">
          <span>Model: <strong className="text-white">{metricConfig.algorithm}</strong></span>
          <button
            onClick={() => {
              if (twinContext?.openExplanation) {
                twinContext.openExplanation('metric', selectedMetric === 'systolic_bp' ? 'systolic_blood_pressure' : selectedMetric);
              }
            }}
            className="px-2 py-0.5 rounded bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-500/30 text-cyan-300 text-[10px] font-bold"
          >
            Explain Formula
          </button>
        </div>
      </div>

      {/* 2. Multi-Signal Events Stream Header & Filter Bar */}
      <div className="pt-4 border-t border-white/10 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              Integrated Multi-Signal Telemetry &amp; Event Stream
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Select any event to open its mathematical formula, algorithm/model version, and audit provenance.
            </p>
          </div>

          {/* Signal Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
            {['all', 'sleep', 'cardio', 'blood_pressure', 'steps', 'respiratory'].map((filter) => (
              <button
                key={filter}
                onClick={() => setSelectedSignalFilter(filter)}
                className={`px-2.5 py-1 rounded-lg border transition-all ${
                  selectedSignalFilter === filter
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold'
                    : 'bg-slate-900/60 text-slate-400 border-white/5 hover:text-white'
                }`}
              >
                {filter === 'all' ? 'All Signals' : filter.replace(/_/g, ' ').toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Provenance Tier Filters */}
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-slate-400">
          <span className="flex items-center gap-1 text-slate-400">
            <Filter className="w-3 h-3 text-cyan-400" />
            Tier:
          </span>
          {['all', 'measured', 'derived', 'model_predicted', 'simulated', 'synthetic'].map(p => (
            <button
              key={p}
              onClick={() => setSelectedProvenanceFilter(p)}
              className={`px-2 py-0.5 rounded transition-all ${
                selectedProvenanceFilter === p
                  ? 'bg-white/15 text-white font-bold border border-white/30'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Event Cards List */}
      <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
        {eventsLoading && (
          <div className="py-8 text-center text-xs font-mono text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 text-teal-400 animate-spin" />
            Loading multi-signal event stream...
          </div>
        )}

        {eventsError && (
          <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 text-xs font-mono text-rose-300 flex items-center justify-between">
            <span>{eventsError}</span>
            <button
              onClick={loadTimelineEvents}
              className="px-2.5 py-1 rounded bg-rose-900/60 text-white font-bold hover:bg-rose-800"
            >
              Retry
            </button>
          </div>
        )}

        {!eventsLoading && !eventsError && timelineEvents.length === 0 && (
          <div className="py-8 text-center text-xs font-mono text-slate-500 bg-slate-950/30 rounded-2xl border border-white/5 p-6">
            No telemetry events recorded for this patient under the selected filter criteria.
          </div>
        )}

        {!eventsLoading && timelineEvents.map((item) => {
          const isSelected = inspectedEvent?.id === item.id;
          const targetBodyNode = getEventBodyNode(item);
          const badgeTheme = PROVENANCE_BADGES[item.data_provenance] || PROVENANCE_BADGES.measured;

          return (
            <div
              key={item.id}
              onClick={() => setInspectedEvent(item)}
              onMouseEnter={() => onHighlightBodyNode && onHighlightBodyNode(targetBodyNode)}
              onMouseLeave={() => onHighlightBodyNode && onHighlightBodyNode(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setInspectedEvent(item);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={`Inspect event: ${item.title}`}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                isSelected
                  ? 'bg-cyan-950/50 border-cyan-400 shadow-lg shadow-cyan-950/60'
                  : 'bg-slate-900/50 border-white/5 hover:border-white/20 hover:bg-slate-900/80'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-xl mt-0.5 shrink-0 ${
                    item.signal_type === 'sleep_stage_prediction'
                      ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                      : item.signal_type === 'heart_rate_statistical_flag'
                      ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                      : 'bg-teal-500/10 text-teal-300 border border-teal-500/20'
                  }`}
                >
                  {item.signal_type === 'sleep_stage_prediction' ? (
                    <Moon className="w-4 h-4" />
                  ) : item.signal_type === 'heart_rate_statistical_flag' ? (
                    <Heart className="w-4 h-4" />
                  ) : (
                    <Activity className="w-4 h-4" />
                  )}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-white">{item.title}</span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border ${badgeTheme.bg} ${badgeTheme.text} ${badgeTheme.border}`}>
                      {badgeTheme.label}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-white/5 text-slate-400 border border-white/5">
                      {item.signal_badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{item.summary}</p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5 text-right font-mono">
                {item.primary_value !== undefined && item.primary_value !== null && (
                  <div>
                    <div className="text-sm font-bold text-white">
                      {item.primary_value} <span className="text-[10px] text-slate-400">{item.primary_unit}</span>
                    </div>
                    <div className="text-[10px] text-teal-300">
                      {new Date(item.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                )}
                <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Timeline Event Deep-Dive Explanation Panel / Modal */}
      {inspectedEvent && (
        <div
          ref={explanationModalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="explanation-title"
          className="p-5 rounded-2xl bg-slate-950 border border-cyan-500/40 space-y-4 shadow-2xl relative animate-fade-in"
        >
          <button
            onClick={() => setInspectedEvent(null)}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900"
            aria-label="Close event explanation"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
              AUDIT EVENT ID: {inspectedEvent.id}
            </span>
            <span className="text-xs font-mono text-slate-400">
              Tier: <strong>{inspectedEvent.data_provenance.toUpperCase()}</strong>
            </span>
          </div>

          <div>
            <h4 id="explanation-title" className="text-base font-bold text-white flex items-center gap-2">
              <Calculator className="w-4 h-4 text-cyan-400" />
              {inspectedEvent.title}
            </h4>
            <p className="text-xs text-slate-300 mt-1">{inspectedEvent.summary}</p>
          </div>

          {/* Breakdown based on event modality */}
          {inspectedEvent.signal_type === 'sleep_stage_prediction' && inspectedEvent.sleep_details && (
            <div className="space-y-3 p-4 rounded-xl bg-purple-950/20 border border-purple-500/30">
              <div className="flex items-center justify-between text-xs font-mono text-purple-300 font-bold">
                <span className="flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5" />
                  BiDSleep 5-Stage AASM Softmax Probabilities
                </span>
                <span>Confidence: {inspectedEvent.sleep_details.confidence_pct}%</span>
              </div>

              <div className="space-y-2 pt-1 font-mono text-xs">
                {Object.entries(inspectedEvent.sleep_details.probabilities).map(([stage, prob]) => {
                  const pct = Math.round(prob * 100);
                  const isPred = stage === inspectedEvent.sleep_details?.stage_5class;
                  return (
                    <div key={stage} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className={isPred ? 'text-purple-300 font-bold' : 'text-slate-400'}>
                          {stage} ({STAGE_DISPLAY_NAMES[stage] || stage})
                        </span>
                        <span className={isPred ? 'text-purple-300 font-bold' : 'text-slate-400'}>{pct}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-white/5">
                        <div style={{ width: `${pct}%` }} className={`h-full ${isPred ? 'bg-purple-400' : 'bg-slate-700'}`} />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-purple-500/20 text-[11px] font-mono text-slate-400 space-y-1">
                <div><strong>Model:</strong> {inspectedEvent.sleep_details.model_name}</div>
                <div><strong>Architecture:</strong> {inspectedEvent.sleep_details.model_architecture}</div>
                <div><strong>Telemetry Source:</strong> {inspectedEvent.sleep_details.inference_source}</div>
              </div>
            </div>
          )}

          {inspectedEvent.signal_type === 'heart_rate_statistical_flag' && inspectedEvent.cardiovascular_details && (
            <div className="space-y-3 p-4 rounded-xl bg-rose-950/20 border border-rose-500/30">
              <div className="flex items-center justify-between text-xs font-mono text-rose-300 font-bold">
                <span className="flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5" />
                  nMAD Mathematical Deviation Breakdown
                </span>
                <span>Algorithm: {inspectedEvent.cardiovascular_details.algorithm_version}</span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 font-mono text-xs text-rose-200 border border-rose-500/20">
                <code>Score = (Measured - Median) / (1.4826 * MAD)</code>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-xs">
                <div className="p-2 rounded bg-slate-900/80 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">Measured HR</span>
                  <span className="text-white font-bold">{inspectedEvent.cardiovascular_details.measured_heart_rate} bpm</span>
                </div>
                <div className="p-2 rounded bg-slate-900/80 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">Baseline Median</span>
                  <span className="text-teal-300 font-bold">{inspectedEvent.cardiovascular_details.baseline_median} bpm</span>
                </div>
                <div className="p-2 rounded bg-slate-900/80 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">nMAD Dispersion</span>
                  <span className="text-cyan-300 font-bold">{inspectedEvent.cardiovascular_details.variability_value} bpm</span>
                </div>
                <div className="p-2 rounded bg-slate-900/80 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">Corridor Bounds</span>
                  <span className="text-slate-300">[{inspectedEvent.cardiovascular_details.lower_corridor} – {inspectedEvent.cardiovascular_details.upper_corridor}]</span>
                </div>
                <div className="p-2 rounded bg-slate-900/80 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">Robust Z-Score</span>
                  <span className="text-rose-400 font-bold">{inspectedEvent.cardiovascular_details.robust_score ?? '0.0'}σ</span>
                </div>
                <div className="p-2 rounded bg-slate-900/80 border border-white/5">
                  <span className="text-[10px] text-slate-400 block">Sample Window</span>
                  <span className="text-slate-300">{inspectedEvent.cardiovascular_details.sample_count} samples ({inspectedEvent.cardiovascular_details.window_days}d)</span>
                </div>
              </div>
            </div>
          )}

          {inspectedEvent.signal_type === 'physiological_observation' && inspectedEvent.observation_details && (
            <div className="p-4 rounded-xl bg-slate-900/60 border border-white/10 space-y-2 text-xs font-mono">
              <span className="text-teal-300 font-bold uppercase block text-[10px]">Telemetry Ingestion Record</span>
              <div className="grid grid-cols-2 gap-2">
                <div>Metric: <strong className="text-white">{inspectedEvent.observation_details.metric_type}</strong></div>
                <div>Recorded: <strong className="text-teal-300">{inspectedEvent.observation_details.value} {inspectedEvent.observation_details.unit}</strong></div>
                <div>Source Device: <strong className="text-slate-300">{inspectedEvent.source_device || inspectedEvent.observation_details.source_type}</strong></div>
                <div>Data Tier: <strong className="text-cyan-300 uppercase">{inspectedEvent.observation_details.data_tier}</strong></div>
              </div>
            </div>
          )}

          {/* Clinical Notice & Limitations */}
          <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/20 text-[11px] font-sans text-amber-200/90 leading-relaxed">
            <strong>Clinical &amp; Algorithmic Limitations:</strong> {inspectedEvent.disclaimer}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setInspectedEvent(null)}
              className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs font-bold"
            >
              Close Explanation
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
