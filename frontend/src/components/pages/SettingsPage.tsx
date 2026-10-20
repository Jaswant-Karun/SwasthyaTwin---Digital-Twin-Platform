import React, { useState } from 'react';
import { Settings, RefreshCw, User, Sliders, Database, ShieldAlert, CheckCircle2, Lock } from 'lucide-react';
import { useTwin } from '../../context/TwinContext';
import { api } from '../../services/api';

export const SettingsPage: React.FC = () => {
  const { currentPatient, refreshData, seedDemoData, isSeeding, systemHealth } = useTwin();
  const [baselineDays, setBaselineDays] = useState<number>(currentPatient?.baseline_window_days || 30);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPatient) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await api.updatePatient(currentPatient.patient_id, {
        baseline_window_days: baselineDays
      });
      await refreshData();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to update baseline window:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-teal-600" />
          Platform Settings & Cohort Preferences
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure baseline window lengths, demo dataset parameters, and security policies.
        </p>
      </div>

      {/* Baseline Window Setting Form */}
      <form onSubmit={handleSaveProfile} className="card-surface rounded-xl p-5 space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-teal-600" />
            Personal Baseline Window Configuration
          </h2>
          <p className="text-xs text-slate-500">
            Define the historical rolling window duration used to calculate {currentPatient?.full_name}’s baseline mean ($\mu$) and variance ($\sigma$).
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700 block">Baseline Window (Days)</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[14, 30, 60, 90].map(d => (
              <button
                type="button"
                key={d}
                onClick={() => setBaselineDays(d)}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                  baselineDays === d
                    ? 'bg-teal-50 text-teal-800 border-teal-300 font-bold'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {d} Days Window
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Recommended: 30 days provides stable physiological variance while remaining sensitive to recent lifestyle changes.
          </p>
        </div>

        <div className="flex items-center justify-between pt-2">
          {saveSuccess && (
            <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Settings Updated Successfully
            </span>
          )}
          <button
            type="submit"
            disabled={isSaving}
            className="ml-auto px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs transition-colors shadow-2xs disabled:opacity-50"
          >
            {isSaving ? 'Updating...' : 'Save Configuration'}
          </button>
        </div>
      </form>

      {/* Demo Data Controls */}
      <div className="card-surface rounded-xl p-5 space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-teal-600" />
            Synthetic Demonstration Data Controls
          </h2>
          <p className="text-xs text-slate-500">
            Reset or regenerate deterministic 90-day continuous telemetry for hackathon presentations.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <span className="font-semibold text-slate-900 block">Reset Demonstration Cohorts</span>
            <p className="text-slate-500 text-[11px]">
              Overwrites current observations and re-seeds 3 distinct clinical scenarios with 2,184 clean data points.
            </p>
          </div>

          <button
            onClick={seedDemoData}
            disabled={isSeeding}
            className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs flex items-center gap-2 transition-colors disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSeeding ? 'animate-spin text-teal-400' : ''}`} />
            {isSeeding ? 'Seeding Database...' : 'Re-Seed Demo Cohorts'}
          </button>
        </div>
      </div>

      {/* System & Storage Diagnostics */}
      <div className="card-surface rounded-xl p-5 space-y-3 text-xs">
        <h3 className="font-bold text-slate-900 flex items-center gap-2">
          <Database className="w-4 h-4 text-slate-600" />
          System Diagnostics & Database Connectivity
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-600">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-[10px] text-slate-400 uppercase font-mono block">Database Engine</span>
            <span className="font-bold text-slate-900">{systemHealth?.database.engine || 'MongoDB Cluster (localhost:27017)'}</span>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-[10px] text-slate-400 uppercase font-mono block">Service Version</span>
            <span className="font-bold text-slate-900">SwasthyaTwin v1.0.0 (FastAPI + React 18)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
