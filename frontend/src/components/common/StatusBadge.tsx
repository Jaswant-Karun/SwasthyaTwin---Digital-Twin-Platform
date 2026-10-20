import React from 'react';
import type { StabilityStatus, SeverityLevel } from '../../types';

interface StatusBadgeProps {
  status?: StabilityStatus;
  severity?: SeverityLevel;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, severity, className = '' }) => {
  if (severity) {
    const config = {
      info: { bg: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Info' },
      warning: { bg: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Warning' },
      critical: { bg: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Critical' }
    }[severity] || { bg: 'bg-slate-100 text-slate-700 border-slate-200', label: severity };

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border ${config.bg} ${className}`}>
        {config.label}
      </span>
    );
  }

  if (status) {
    const config = {
      optimal: {
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dot: 'bg-emerald-500',
        label: 'Optimal Baseline'
      },
      mild_deviation: {
        bg: 'bg-cyan-50 text-cyan-700 border-cyan-200',
        dot: 'bg-cyan-500',
        label: 'Mild Deviation'
      },
      moderate_drift: {
        bg: 'bg-amber-50 text-amber-700 border-amber-200',
        dot: 'bg-amber-500',
        label: 'Moderate Drift'
      },
      significant_deviation: {
        bg: 'bg-rose-50 text-rose-700 border-rose-200',
        dot: 'bg-rose-500',
        label: 'Significant Deviation'
      }
    }[status] || { bg: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400', label: status };

    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${config.bg} ${className}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
        {config.label}
      </span>
    );
  }

  return null;
};
