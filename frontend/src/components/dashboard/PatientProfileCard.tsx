import React from 'react';
import { User, Calendar, HeartHandshake, ShieldAlert, Moon, Footprints, Stethoscope, Compass } from 'lucide-react';
import { useTwin } from '../../context/TwinContext';

export const PatientProfileCard: React.FC = () => {
  const { currentPatient } = useTwin();

  if (!currentPatient) return null;

  const lifestyle = currentPatient.lifestyle_profile;

  return (
    <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-sm">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">{currentPatient.full_name}</h3>
            <p className="text-xs text-slate-400 font-mono">ID: {currentPatient.patient_id} • {currentPatient.age} yrs • {currentPatient.biological_sex.toUpperCase()}</p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-[11px] font-mono text-teal-300 border border-slate-700">
          Window: {currentPatient.baseline_window_days}d
        </span>
      </div>

      {/* Conditions */}
      <div>
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
          <Stethoscope className="w-3.5 h-3.5 text-teal-400" />
          Clinical Context & Cohort Notes
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {currentPatient.chronic_conditions.map((c, i) => (
            <span key={i} className="px-2.5 py-1 rounded-md bg-slate-800/80 text-slate-200 text-xs border border-slate-700/60 font-medium">
              {c}
            </span>
          ))}
          {currentPatient.primary_physician && (
            <span className="px-2.5 py-1 rounded-md bg-teal-950/40 text-teal-300 text-xs border border-teal-800/40 font-medium flex items-center gap-1">
              Physician: {currentPatient.primary_physician}
            </span>
          )}
        </div>
      </div>

      {/* Lifestyle baseline profile */}
      <div className="pt-2 border-t border-slate-800/60">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-emerald-400" />
          Lifestyle Baseline Reference
        </h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/40 flex items-center gap-2">
            <Moon className="w-4 h-4 text-cyan-400" />
            <div>
              <span className="text-[10px] text-slate-400 block">Baseline Sleep</span>
              <span className="font-semibold text-white">{lifestyle?.baseline_sleep_hours || 7.5} hrs/night</span>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/40 flex items-center gap-2">
            <Footprints className="w-4 h-4 text-emerald-400" />
            <div>
              <span className="text-[10px] text-slate-400 block">Baseline Steps</span>
              <span className="font-semibold text-white">{lifestyle?.baseline_daily_steps?.toLocaleString() || '7,000'} steps</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
