import React from 'react';
import { StabilityStatus, SeverityLevel } from '../../types';

interface StatusBadgeProps {
  status?: StabilityStatus;
  severity?: SeverityLevel;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, severity, className = '' }) => {
  if (severity) {
    const config = {
      info: { bg: 'bg-blue-500/10 text-blue-400 border-blue-500/20', label: 'Info' },
      warning: { bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20', label: 'Warning' },
      critical: { bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20', label: 'Critical Alert' }
    }[severity] || { bg: 'bg-slate-500/10 text-slate-400 border-slate-500/20', label: severity };

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${config.bg} ${className}`}>
        {config.label}
      </span>
    );
  }

  if (status) {
    const config = {
      optimal: {
        bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        dot: 'bg-emerald-400',
        label: 'Optimal Baseline'
      },
      mild_deviation: {
        bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
        dot: 'bg-cyan-400',
        label: 'Mild Deviation'
      },
      moderate_drift: {
        bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        dot: 'bg-amber-400',
        label: 'Moderate Drift'
      },
      significant_deviation: {
        bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        dot: 'bg-rose-400',
        label: 'Significant Deviation'
      }
    }[status] || { bg: 'bg-slate-500/10 text-slate-400 border-slate-500/20', dot: 'bg-slate-400', label: status };

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.bg} ${className}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
        {config.label}
      </span>
    );
  }

  return null;
};
