import React, { useState, useEffect } from 'react';
import {
  Heart,
  Activity,
  AlertTriangle,
  Info,
  Calendar,
  Filter,
  RefreshCw,
  HelpCircle,
  X,
  CheckCircle2,
  Clock,
  Database,
  Sliders,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  ShieldAlert
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import { api } from '../../services/api';

interface WorkspaceProps {
  patientId: string;
  patientName?: string;
}

export const CardiovascularIntelligenceWorkspace: React.FC<WorkspaceProps> = ({
  patientId,
  patientName = 'Patient'
}) => {
  const [windowDays, setWindowDays] = useState<number>(30);
  const [minObservations, setMinObservations] = useState<number>(10);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  // Explanation Drawer State
  const [selectedObsId, setSelectedObsId] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<any>(null);
  const [loadingExplanation, setLoadingExplanation] = useState<boolean>(false);
  const [explanationError, setExplanationError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getCardiovascularAnomalies(patientId, {
        windowDays,
        minObservations,
        status: statusFilter,
        source: sourceFilter,
        limit: 100
      });
      setData(res);
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Failed to retrieve cardiovascular telemetry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (patientId) {
      fetchData();
    }
  }, [patientId, windowDays, minObservations, statusFilter, sourceFilter]);

  const handleOpenExplanation = async (obsId: string) => {
    setSelectedObsId(obsId);
    setLoadingExplanation(true);
    setExplanationError(null);
    try {
      const res = await api.getCardiovascularExplanation(patientId, obsId, windowDays, minObservations);
      setExplanation(res);
    } catch (err: any) {
      setExplanationError(err?.detail || err?.message || 'Could not load explanation metadata.');
    } finally {
      setLoadingExplanation(false);
    }
  };

  const currentBaseline = data?.current_baseline;
  const metrics = data?.operational_metrics;
  const timeline = data?.timeline || [];
  const events = data?.events?.items || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'unusual_high':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <TrendingUp className="w-3 h-3" /> Unusual High
          </span>
        );
      case 'unusual_low':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/30">
            <TrendingDown className="w-3 h-3" /> Unusual Low
          </span>
        );
      case 'review_data_quality':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3" /> Data Quality
          </span>
        );
      case 'within_personal_range':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-teal-500/10 text-teal-300 border border-teal-500/20">
            <CheckCircle2 className="w-3 h-3 text-teal-400" /> In Corridor
          </span>
        );
      case 'insufficient_data':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
            <Clock className="w-3 h-3" /> Insufficient Data
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Context */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
              <Heart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Personalized Heart-Rate Anomaly Intelligence
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-950/70 text-teal-300 border border-teal-500/30">
                  nMAD v1.2.0
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Non-parametric corridor benchmarking for {patientName}. Identifies genuine statistical deviations without false-alarm population cutoffs.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action / Refresh */}
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal-400' : ''}`} />
            Refresh Analysis
          </button>
        </div>
      </div>

      {/* Safety Notice Banner */}
      <div className="p-3 rounded-lg bg-teal-950/25 border border-teal-500/20 flex items-start gap-2.5 text-xs text-slate-300">
        <Info className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5 leading-relaxed">
          <span className="font-semibold text-teal-300">Non-Diagnostic Research Notice: </span>
          Anomalies detected are mathematical deviations from {patientName}’s personal historical resting distribution. Wearable PPG pulse tracking does not substitute for clinical ECG and does not diagnose arrhythmia or myocardial infarction.
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="card-surface p-3.5 rounded-xl border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Time Window Buttons */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 flex items-center gap-1 mr-1">
            <Calendar className="w-3.5 h-3.5" /> Window:
          </span>
          {[7, 14, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setWindowDays(d)}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                windowDays === d
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-xs'
                  : 'text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800'
              }`}
            >
              {d} Days
            </button>
          ))}
        </div>

        {/* Min Observations Selector */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 flex items-center gap-1">
            <Sliders className="w-3.5 h-3.5" /> Min History:
          </span>
          <select
            value={minObservations}
            onChange={e => setMinObservations(Number(e.target.value))}
            className="bg-slate-900 border border-slate-800 text-slate-200 rounded px-2 py-1 text-xs focus:outline-hidden focus:border-teal-500"
          >
            <option value={5}>5 observations (provisional)</option>
            <option value={10}>10 observations (recommended)</option>
            <option value={14}>14 observations (conservative)</option>
            <option value={20}>20 observations (high confidence)</option>
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Status:
          </span>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-slate-200 rounded px-2 py-1 text-xs focus:outline-hidden focus:border-teal-500"
          >
            <option value="all">All Events</option>
            <option value="unusual_high">Unusual High</option>
            <option value="unusual_low">Unusual Low</option>
            <option value="review_data_quality">Data Quality Review</option>
            <option value="within_personal_range">Within Range</option>
            <option value="insufficient_data">Insufficient Data</option>
          </select>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="card-surface p-4 rounded-xl border border-slate-800/80 space-y-1">
          <span className="text-slate-400 text-xs flex items-center gap-1">
            <Heart className="w-3.5 h-3.5 text-teal-400" /> Personal Baseline
          </span>
          <div className="text-2xl font-bold text-white tracking-tight">
            {currentBaseline?.is_sufficient && currentBaseline?.median !== null ? (
              <span>
                {currentBaseline.median} <span className="text-xs font-normal text-slate-400">bpm</span>
              </span>
            ) : (
              <span className="text-sm font-medium text-amber-400">Insufficient Data</span>
            )}
          </div>
          <p className="text-[11px] text-slate-400">
            {currentBaseline?.is_sufficient
              ? `Median over ${currentBaseline.observation_count} readings`
              : `Requires min ${minObservations} valid readings`}
          </p>
        </div>

        <div className="card-surface p-4 rounded-xl border border-slate-800/80 space-y-1">
          <span className="text-slate-400 text-xs flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-sky-400" /> Robust Variability (nMAD)
          </span>
          <div className="text-2xl font-bold text-white tracking-tight">
            {currentBaseline?.is_sufficient && currentBaseline?.n_mad !== null ? (
              <span>
                ±{currentBaseline.n_mad} <span className="text-xs font-normal text-slate-400">bpm</span>
              </span>
            ) : (
              <span className="text-sm font-medium text-slate-400">—</span>
            )}
          </div>
          <p className="text-[11px] text-slate-400">
            {currentBaseline?.variability_floor_applied
              ? 'Safe floor applied (≥1.0 bpm)'
              : 'Normal-consistent scale factor (1.4826)'}
          </p>
        </div>

        <div className="card-surface p-4 rounded-xl border border-slate-800/80 space-y-1">
          <span className="text-slate-400 text-xs flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> Flagged Anomalies
          </span>
          <div className="text-2xl font-bold text-rose-400 tracking-tight">
            {metrics?.flagged_anomalies_count ?? 0}
            <span className="text-xs font-normal text-slate-400 ml-1.5">
              ({metrics?.flagged_rate_pct ?? 0}%)
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Divergences exceeding ±2.5 Modified Z
          </p>
        </div>

        <div className="card-surface p-4 rounded-xl border border-slate-800/80 space-y-1">
          <span className="text-slate-400 text-xs flex items-center gap-1">
            <Database className="w-3.5 h-3.5 text-emerald-400" /> Evaluated Volume
          </span>
          <div className="text-2xl font-bold text-white tracking-tight">
            {metrics?.total_observations_analyzed ?? 0}
          </div>
          <p className="text-[11px] text-slate-400">
            {metrics?.within_personal_range_count ?? 0} confirmed in normal corridor
          </p>
        </div>
      </div>

      {/* Main Interactive Timeline Chart */}
      <div className="card-surface p-5 rounded-xl border border-slate-800/80 space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-400" />
              Heart-Rate Trajectory vs. Personal Baseline Corridor
            </h3>
            <p className="text-xs text-slate-400">
              Shaded band represents ±2 nMAD around chronological median. Click any flagged point to view mathematical explanation.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-400" /> Measured HR
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-teal-300" /> Median Baseline
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-teal-500/20 border border-teal-500/40" /> ±2 nMAD Corridor
            </span>
          </div>
        </div>

        {loading ? (
          <div className="h-72 flex items-center justify-center text-slate-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin text-teal-400 mr-2" />
            Calculating chronological baseline corridors...
          </div>
        ) : error ? (
          <div className="h-72 flex flex-col items-center justify-center text-rose-400 text-xs space-y-2">
            <AlertTriangle className="w-6 h-6" />
            <p>{error}</p>
            <button
              onClick={fetchData}
              className="px-3 py-1 rounded bg-slate-800 text-slate-200 hover:bg-slate-700"
            >
              Retry
            </button>
          </div>
        ) : timeline.length === 0 ? (
          <div className="h-72 flex flex-col items-center justify-center text-slate-400 text-xs space-y-1">
            <Heart className="w-8 h-8 text-slate-600 mb-1" />
            <p className="font-semibold text-slate-300">No Heart-Rate Observations Recorded</p>
            <p className="text-slate-400">Log heart-rate telemetry to establish a personal baseline corridor.</p>
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={timeline} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={t => {
                    try {
                      return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                    } catch {
                      return t;
                    }
                  }}
                  stroke="#64748b"
                  fontSize={10}
                />
                <YAxis stroke="#64748b" domain={['auto', 'auto']} fontSize={10} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-900/95 border border-slate-700 p-2.5 rounded-lg shadow-xl text-xs space-y-1">
                          <div className="font-semibold text-white">
                            {new Date(d.timestamp).toLocaleString()}
                          </div>
                          <div className="text-teal-300">
                            Measured HR: <span className="font-bold">{d.measured_heart_rate} bpm</span>
                          </div>
                          {d.baseline_median !== null && (
                            <div className="text-slate-400 text-[11px]">
                              Baseline Median: {d.baseline_median} bpm
                            </div>
                          )}
                          {d.robust_score !== null && (
                            <div className="text-slate-400 text-[11px]">
                              Modified Z-Score: {d.robust_score > 0 ? `+${d.robust_score}` : d.robust_score}
                            </div>
                          )}
                          <div className="mt-1 pt-1 border-t border-slate-800">
                            {getStatusBadge(d.status)}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {/* Corridor Area Band */}
                <Area
                  type="monotone"
                  dataKey="upper_corridor"
                  stroke="none"
                  fill="#0d9488"
                  fillOpacity={0.12}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="lower_corridor"
                  stroke="none"
                  fill="#0a0f1d"
                  fillOpacity={1.0}
                  isAnimationActive={false}
                />
                {/* Median Baseline */}
                <Line
                  type="monotone"
                  dataKey="baseline_median"
                  stroke="#14b8a6"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                  isAnimationActive={false}
                />
                {/* Measured HR Line */}
                <Line
                  type="monotone"
                  dataKey="measured_heart_rate"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#38bdf8', strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: '#2dd4bf' }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Chronological Anomaly Events Table */}
      <div className="card-surface rounded-xl border border-slate-800/80 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-400" />
              Chronological Anomaly Event Stream
            </h3>
            <p className="text-xs text-slate-400">
              Evaluated sequentially against preceding historical baseline with zero future-data leakage.
            </p>
          </div>
          <span className="text-xs text-slate-400">
            Showing {events.length} of {data?.events?.total || 0} events
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Timestamp</th>
                <th className="px-4 py-2.5 font-semibold">Measured HR</th>
                <th className="px-4 py-2.5 font-semibold">Baseline Median</th>
                <th className="px-4 py-2.5 font-semibold">Delta (bpm / %)</th>
                <th className="px-4 py-2.5 font-semibold">Modified Z</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold text-right">Explanation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-xs">
                    No matching events found for current filter criteria.
                  </td>
                </tr>
              ) : (
                events.map((ev: any) => (
                  <tr
                    key={ev.observation_id}
                    className="hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-slate-300">
                      {new Date(ev.timestamp).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-4 py-3 font-semibold text-white">
                      {ev.measured_heart_rate} bpm
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {ev.baseline_median !== null ? `${ev.baseline_median} bpm` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {ev.delta_absolute !== null ? (
                        <span
                          className={
                            ev.delta_absolute > 0
                              ? 'text-rose-400 font-medium'
                              : ev.delta_absolute < 0
                              ? 'text-sky-400 font-medium'
                              : 'text-slate-400'
                          }
                        >
                          {ev.delta_absolute > 0 ? `+${ev.delta_absolute}` : ev.delta_absolute} bpm{' '}
                          <span className="text-[10px] text-slate-400">
                            ({ev.delta_percentage > 0 ? `+${ev.delta_percentage}` : ev.delta_percentage}%)
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px]">
                      {ev.robust_score !== null ? (
                        <span
                          className={
                            Math.abs(ev.robust_score) >= 2.5
                              ? 'text-rose-400 font-bold'
                              : 'text-slate-300'
                          }
                        >
                          {ev.robust_score > 0 ? `+${ev.robust_score}` : ev.robust_score}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(ev.status)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleOpenExplanation(ev.observation_id)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-400 hover:text-teal-300 transition-colors"
                      >
                        Explain <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Explanation Drawer / Modal ("Why was this flagged?") */}
      {selectedObsId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-white">Why was this reading flagged?</h4>
              </div>
              <button
                onClick={() => setSelectedObsId(null)}
                className="p-1 text-slate-400 hover:text-white rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingExplanation ? (
              <div className="py-8 flex items-center justify-center text-xs text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin text-teal-400 mr-2" />
                Retrieving stored calculation audit trail...
              </div>
            ) : explanationError ? (
              <div className="py-6 text-center text-xs text-rose-400 space-y-2">
                <AlertTriangle className="w-6 h-6 mx-auto" />
                <p>{explanationError}</p>
              </div>
            ) : explanation ? (
              <div className="space-y-3.5 text-xs">
                {/* Result Status Banner */}
                <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/80 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-400 block">Assessment Verdict</span>
                    <span className="font-semibold text-white">{explanation.reason}</span>
                  </div>
                  <div>{getStatusBadge(explanation.status)}</div>
                </div>

                {/* Mathematical Formula Box */}
                <div className="space-y-1.5">
                  <span className="font-semibold text-slate-300 block">Mathematical Formula Applied</span>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-teal-300 whitespace-pre-line leading-relaxed">
                    {explanation.formula}
                  </div>
                </div>

                {/* Calculation Breakdown Grid */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-0.5">
                    <span className="text-slate-400 block">Observed Reading</span>
                    <span className="font-bold text-white text-sm">
                      {explanation.measured_heart_rate} bpm
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-0.5">
                    <span className="text-slate-400 block">Prior Baseline Median</span>
                    <span className="font-bold text-white text-sm">
                      {explanation.calculation_breakdown.baseline_median !== null
                        ? `${explanation.calculation_breakdown.baseline_median} bpm`
                        : 'N/A'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-0.5">
                    <span className="text-slate-400 block">Baseline Variability (nMAD)</span>
                    <span className="font-mono text-slate-200">
                      ±{explanation.calculation_breakdown.variability_n_mad_bpm ?? '—'} bpm
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-0.5">
                    <span className="text-slate-400 block">Baseline Sample Size</span>
                    <span className="font-mono text-slate-200">
                      {explanation.baseline_summary.observation_count} readings (30d window)
                    </span>
                  </div>
                </div>

                {/* Sensor Source & Quality Audit */}
                <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800 text-[11px] space-y-1">
                  <span className="text-slate-400 font-medium block">Data Provenance</span>
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Source Channel:</span>
                    <span className="font-mono text-slate-200">
                      {explanation.data_quality_audit.source_type || 'wearable'}
                    </span>
                  </div>
                  {explanation.data_quality_audit.warnings?.length > 0 && (
                    <div className="text-amber-400 text-[10px] pt-1">
                      Warnings: {explanation.data_quality_audit.warnings.join(', ')}
                    </div>
                  )}
                </div>

                {/* Disclaimer */}
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-[10px] text-slate-400 leading-relaxed">
                  <span className="font-semibold text-slate-300">Clinical Limitation: </span>
                  {explanation.clinical_limitations}
                </div>
              </div>
            ) : null}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedObsId(null)}
                className="px-4 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors"
              >
                Close Explanation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
