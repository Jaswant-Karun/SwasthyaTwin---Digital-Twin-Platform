import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Search,
  Filter,
  Check,
  ChevronDown,
  Info
} from 'lucide-react';
import { useTwin } from '../../context/TwinContext';
import { StatusBadge } from '../common/StatusBadge';

export const AlertCenter: React.FC = () => {
  const { alerts, currentPatient, acknowledgeAlert } = useTwin();
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterAcknowledged, setFilterAcknowledged] = useState<string>('unacknowledged');
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  const filteredAlerts = alerts.filter(a => {
    if (filterSeverity !== 'all' && a.severity !== filterSeverity) return false;
    if (filterAcknowledged === 'unacknowledged' && a.is_acknowledged) return false;
    if (filterAcknowledged === 'acknowledged' && !a.is_acknowledged) return false;
    return true;
  });

  const handleAcknowledge = async (id: string) => {
    setAcknowledgingId(id);
    await acknowledgeAlert(id, 'Reviewed by clinician/patient');
    setAcknowledgingId(null);
  };

  return (
    <div className="space-y-5">
      {/* Header & Filter Controls */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            Explainable Health Deviation Alert Center
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Biometric breaches triggered exclusively when metrics deviate past {currentPatient?.full_name}’s personal baseline limits.
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="bg-slate-800 text-white text-xs rounded-lg px-2.5 py-1.5 border border-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical Only</option>
            <option value="warning">Warning Only</option>
            <option value="info">Info Only</option>
          </select>

          <select
            value={filterAcknowledged}
            onChange={(e) => setFilterAcknowledged(e.target.value)}
            className="bg-slate-800 text-white text-xs rounded-lg px-2.5 py-1.5 border border-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium"
          >
            <option value="unacknowledged">Action Required (Active)</option>
            <option value="acknowledged">Acknowledged History</option>
            <option value="all">All Statuses</option>
          </select>
        </div>
      </div>

      {/* Alert Cards List */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <h4 className="text-sm font-bold text-white">No Matching Alerts</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              There are no active alerts matching your current filter criteria for {currentPatient?.full_name}.
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div
              key={alert._id}
              className={`rounded-2xl border p-5 transition-all ${
                alert.is_acknowledged
                  ? 'bg-slate-900/30 border-slate-800/60 opacity-70'
                  : alert.severity === 'critical'
                  ? 'bg-slate-900/80 border-rose-500/40 shadow-lg shadow-rose-950/20'
                  : alert.severity === 'warning'
                  ? 'bg-slate-900/80 border-amber-500/30'
                  : 'bg-slate-900/80 border-slate-700'
              }`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <StatusBadge severity={alert.severity} />
                  <h3 className="text-sm font-bold text-white">{alert.title}</h3>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>{new Date(alert.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                {alert.description}
              </p>

              {/* Evidence Panel */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 block">Trigger Reading</span>
                  <span className="font-bold text-white text-sm">{alert.current_value} {alert.unit}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Personal Baseline</span>
                  <span className="font-bold text-slate-300 text-sm">{alert.baseline_value} {alert.unit}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Standardized Z-Score</span>
                  <span className={`font-bold text-sm ${Math.abs(alert.z_score) >= 2.0 ? 'text-rose-400' : 'text-slate-300'}`}>
                    {alert.z_score > 0 ? `+${alert.z_score.toFixed(2)}` : alert.z_score.toFixed(2)}σ
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Review Status</span>
                  <span className={`font-bold text-sm ${alert.is_acknowledged ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {alert.is_acknowledged ? 'Acknowledged' : 'Pending Action'}
                  </span>
                </div>
              </div>

              {/* Suggested Action & Acknowledge Button */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-slate-800/70">
                <div className="text-xs text-slate-300 max-w-2xl">
                  <strong className="text-teal-400 font-semibold">Suggested Non-Prescriptive Guidance: </strong>
                  {alert.suggested_action}
                </div>

                {!alert.is_acknowledged ? (
                  <button
                    onClick={() => handleAcknowledge(alert._id)}
                    disabled={acknowledgingId === alert._id}
                    className="shrink-0 px-3.5 py-1.5 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-xs font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {acknowledgingId === alert._id ? 'Saving...' : 'Acknowledge Alert'}
                  </button>
                ) : (
                  <span className="text-xs text-emerald-400/80 font-mono flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Acknowledged {alert.acknowledged_at ? new Date(alert.acknowledged_at).toLocaleDateString() : ''}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
