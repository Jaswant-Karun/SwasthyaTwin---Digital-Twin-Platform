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
import type { Alert } from '../../types';

export const AlertCenter: React.FC = () => {
  const { alerts, currentPatient, acknowledgeAlert } = useTwin();
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterAcknowledged, setFilterAcknowledged] = useState<string>('unacknowledged');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  const filteredAlerts = alerts.filter(a => {
    if (filterSeverity !== 'all' && a.severity !== filterSeverity) return false;
    if (filterAcknowledged === 'unacknowledged' && a.is_acknowledged) return false;
    if (filterAcknowledged === 'acknowledged' && !a.is_acknowledged) return false;
    if (searchQuery && !a.title.toLowerCase().includes(searchQuery.toLowerCase()) && !a.description.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  const handleAcknowledge = async (id: string) => {
    setAcknowledgingId(id);
    await acknowledgeAlert(id, 'Reviewed and acknowledged in Clinical Alert Center');
    setAcknowledgingId(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-amber-600" />
          Health Deviation Alert Center
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Surveillance alerts triggered strictly when telemetry breaches {currentPatient?.full_name}’s personal baseline limits.
        </p>
      </div>

      {/* Safety Notice */}
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2.5">
        <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0" />
        <span>
          <strong>Clinical Alert Policy:</strong> Alerts represent statistical deviations from self-baseline for early lifestyle awareness. They do not constitute acute emergency medical dispatches.
        </span>
      </div>

      {/* Filter Toolbar */}
      <div className="card-surface rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="bg-slate-50 text-slate-800 text-xs rounded-lg px-3 py-1.5 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical Severity</option>
            <option value="warning">Warning Severity</option>
            <option value="info">Informational</option>
          </select>

          <select
            value={filterAcknowledged}
            onChange={(e) => setFilterAcknowledged(e.target.value)}
            className="bg-slate-50 text-slate-800 text-xs rounded-lg px-3 py-1.5 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium"
          >
            <option value="unacknowledged">Action Required (Active)</option>
            <option value="acknowledged">Acknowledged History</option>
            <option value="all">All Statuses</option>
          </select>
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search alerts by biometric..."
            className="w-full bg-slate-50 text-slate-800 text-xs rounded-lg px-3 py-1.5 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium"
          />
        </div>
      </div>

      {/* Alert Items */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="card-surface rounded-xl p-8 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
            <h4 className="text-sm font-bold text-slate-800">No Alerts Found</h4>
            <p className="text-xs text-slate-500">
              There are no alerts matching the selected filter criteria for {currentPatient?.full_name}.
            </p>
          </div>
        ) : (
          filteredAlerts.map((a) => (
            <div
              key={a._id}
              className={`card-surface rounded-xl p-5 transition-all ${
                a.is_acknowledged ? 'opacity-70 bg-slate-50/50' : ''
              }`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5">
                  <StatusBadge severity={a.severity} />
                  <h3 className="text-sm font-bold text-slate-900">{a.title}</h3>
                </div>
                <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(a.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed mb-3">
                {a.description}
              </p>

              {/* Evidence Bar */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono mb-3">
                <div>
                  <span className="text-[10px] text-slate-400 block">Trigger Value</span>
                  <span className="font-bold text-slate-900">{a.current_value} {a.unit}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Personal Baseline</span>
                  <span className="font-semibold text-slate-700">{a.baseline_value} {a.unit}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Z-Score Divergence</span>
                  <span className={`font-bold ${Math.abs(a.z_score) >= 2 ? 'text-rose-600' : 'text-slate-700'}`}>
                    {a.z_score > 0 ? `+${a.z_score.toFixed(1)}` : a.z_score.toFixed(1)}σ
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Status</span>
                  <span className={`font-semibold ${a.is_acknowledged ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {a.is_acknowledged ? 'Acknowledged' : 'Pending Review'}
                  </span>
                </div>
              </div>

              {/* Footer suggested action & acknowledgement */}
              <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="text-xs text-slate-600 max-w-xl">
                  <strong className="text-slate-900 font-semibold">Recommended Guidance: </strong>
                  {a.suggested_action}
                </div>

                {!a.is_acknowledged ? (
                  <button
                    onClick={() => handleAcknowledge(a._id)}
                    disabled={acknowledgingId === a._id}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {acknowledgingId === a._id ? 'Saving...' : 'Acknowledge Alert'}
                  </button>
                ) : (
                  <span className="text-xs text-emerald-700 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Reviewed {a.acknowledged_at ? new Date(a.acknowledged_at).toLocaleDateString() : ''}
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
