import React, { useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  Check,
  CheckCircle2,
  BookOpen,
  ArrowRight,
  ExternalLink,
  Info
} from 'lucide-react';
import { useTwin } from '../../context/TwinContext';
import { StatusBadge } from '../common/StatusBadge';

export const OverviewTrendAndAlerts: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const { assessment, alerts, acknowledgeAlert, currentPatient } = useTwin();
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  const unreadAlerts = alerts.filter(a => !a.is_acknowledged);

  const handleAcknowledge = async (id: string) => {
    setAcknowledgingId(id);
    await acknowledgeAlert(id, 'Acknowledged from Overview');
    setAcknowledgingId(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Explainable Health Trend & Methodology Link */}
      <div className="card-surface rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-teal-600" />
              Transparent Vitality Index Deductions
            </h3>
            <p className="text-xs text-slate-500">
              Mathematical decomposition of points deducted from 100 based on personal baseline Z-scores.
            </p>
          </div>

          <button
            onClick={() => onNavigate('data-sources')}
            className="text-xs text-teal-700 hover:text-teal-800 font-semibold inline-flex items-center gap-1"
          >
            Data Sources <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        {assessment?.explainability_factors.length === 0 ? (
          <div className="p-4 rounded-lg bg-emerald-50 text-xs text-emerald-800 border border-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>All monitored biometrics are within 1.0 standard deviation of your personalized baseline. Full vitality preserved.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {assessment?.explainability_factors.map((f, i) => (
              <div
                key={i}
                className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 capitalize">{f.metric_type.replace(/_/g, ' ')}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                      -{f.impact_score} pts
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">{f.rationale}</p>
                </div>
                <StatusBadge severity={f.severity} />
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1 text-[11px]">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            100% Deterministic rule attribution
          </span>
          <button
            onClick={() => onNavigate('risk-insights')}
            className="text-teal-700 hover:text-teal-800 font-semibold inline-flex items-center gap-1"
          >
            Review Risk Insights <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Right: Active Health Deviation Alerts */}
      <div className="card-surface rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Active Biometric Deviation Alerts
            </h3>
            <p className="text-xs text-slate-500">
              Triggered exclusively when biometrics exceed {currentPatient?.full_name}’s personalized thresholds.
            </p>
          </div>

          <button
            onClick={() => onNavigate('alerts')}
            className="text-xs text-teal-700 hover:text-teal-800 font-semibold inline-flex items-center gap-1"
          >
            All Alerts ({alerts.length}) →
          </button>
        </div>

        {unreadAlerts.length === 0 ? (
          <div className="p-6 rounded-lg bg-slate-50 border border-slate-200 text-center space-y-1">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
            <h4 className="text-xs font-semibold text-slate-800">All Alerts Acknowledged</h4>
            <p className="text-[11px] text-slate-500">
              No pending unacknowledged alerts for {currentPatient?.full_name}.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {unreadAlerts.slice(0, 3).map((a) => (
              <div
                key={a._id}
                className="p-3.5 rounded-lg bg-white border border-slate-200 shadow-2xs space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StatusBadge severity={a.severity} />
                    <span className="font-semibold text-slate-900">{a.title}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {a.description}
                </p>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 truncate max-w-xs">
                    {a.suggested_action}
                  </span>
                  <button
                    onClick={() => handleAcknowledge(a._id)}
                    disabled={acknowledgingId === a._id}
                    className="shrink-0 px-2.5 py-1 rounded bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-[11px] font-semibold transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    <Check className="w-3 h-3" />
                    {acknowledgingId === a._id ? 'Saving...' : 'Acknowledge'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
