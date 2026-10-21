import React from 'react';
import { HelpCircle, Info, Calculator } from 'lucide-react';
import { useTwin } from '../../context/TwinContext';

interface HowCalculatedButtonProps {
  category: 'metric' | 'baseline' | 'trend' | 'alert' | 'simulation' | string;
  itemId: string;
  customPayload?: any;
  variant?: 'link' | 'icon' | 'button' | 'badge';
  label?: string;
  className?: string;
  stopPropagation?: boolean;
}

export const HowCalculatedButton: React.FC<HowCalculatedButtonProps> = ({
  category,
  itemId,
  customPayload,
  variant = 'link',
  label = 'How is this calculated?',
  className = '',
  stopPropagation = true
}) => {
  const { openExplanation } = useTwin();

  const handleClick = (e: React.MouseEvent) => {
    if (stopPropagation) {
      e.stopPropagation();
    }
    openExplanation(category, itemId, customPayload);
  };

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={`How is this ${itemId.replace(/_/g, ' ')} calculated?`}
        title={`How is this calculated?`}
        className={`p-1 rounded-md text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-colors inline-flex items-center justify-center focus:outline-none focus:ring-1 focus:ring-teal-500 ${className}`}
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
    );
  }

  if (variant === 'badge') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 hover:bg-teal-50 text-slate-600 hover:text-teal-700 border border-slate-200 hover:border-teal-300 transition-colors focus:outline-none focus:ring-1 focus:ring-teal-500 ${className}`}
      >
        <HelpCircle className="w-3 h-3 text-teal-600" />
        <span>{label}</span>
      </button>
    );
  }

  if (variant === 'button') {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-800 border border-slate-200 hover:border-teal-300 transition-all shadow-2xs focus:outline-none focus:ring-1 focus:ring-teal-500 ${className}`}
      >
        <Calculator className="w-3.5 h-3.5 text-teal-600" />
        <span>{label}</span>
      </button>
    );
  }

  // Default 'link' variant
  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:text-teal-800 hover:underline transition-colors focus:outline-none focus:ring-1 focus:ring-teal-500 rounded px-1 py-0.5 ${className}`}
    >
      <HelpCircle className="w-3 h-3 shrink-0" />
      <span>{label}</span>
    </button>
  );
};
