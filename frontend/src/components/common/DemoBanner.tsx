import React, { useState } from 'react';
import {
  Sparkles,
  RefreshCw,
  Radio,
  Clock,
  User,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Database,
  WifiOff,
  Wifi
} from 'lucide-react';
import { useTwin } from '../../context/TwinContext';

export const DemoBanner: React.FC = () => {
  const {
    patients,
    currentPatient,
    setCurrentPatientId,
    systemHealth,
    dbReadiness,
    isOfflineDemo,
    setOfflineDemo,
    isSeeding,
    isLiveInjecting,
    latestUpdateInfo,
    seedDemoData,
    resetDemoCohort,
    injectLiveDemoObservation
  } = useTwin();

  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [liveSuccessMsg, setLiveSuccessMsg] = useState<string | null>(null);

  const handleLiveInject = async () => {
    try {
      const res = await injectLiveDemoObservation('heart_rate');
      if (res?.observation) {
        setLiveSuccessMsg(`Ingested: ${res.observation.value} ${res.observation.unit} for ${currentPatient?.full_name?.split(' ')[0] || 'Patient'}`);
        setTimeout(() => setLiveSuccessMsg(null), 5000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleConfirmReset = async () => {
    setShowResetConfirm(false);
    await resetDemoCohort();
    await seedDemoData(true);
  };

  const isDbConnected = dbReadiness?.ready || systemHealth?.database?.status === 'connected';

  // Explicit Offline Demo Banner
  if (isOfflineDemo) {
    return (
      <div className="bg-amber-950 text-amber-200 border-b border-amber-600/40 px-3 sm:px-4 py-2 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40">
              <WifiOff className="w-2.5 h-2.5 text-amber-400" />
              OFFLINE DEMO MODE ACTIVE
            </span>
            <span className="text-[11px] text-amber-200 font-medium">
              Operating on static cached demonstration dataset. Live MongoDB updates are disabled.
            </span>
          </div>

          <button
            onClick={() => setOfflineDemo(false)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition-colors"
          >
            <Wifi className="w-3 h-3" />
            Switch to Live Backend
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 text-slate-200 border-b border-teal-500/20 px-3 sm:px-4 py-2 text-xs">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-2.5">
        {/* Left: Badge & Synthetic Disclaimer */}
        <div className="flex items-center flex-wrap gap-2 text-center sm:text-left justify-center sm:justify-start">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-teal-500/20 text-teal-300 border border-teal-500/40">
            <Radio className="w-2.5 h-2.5 text-teal-400 animate-pulse" />
            SYNTHETIC DEMO ENVIRONMENT
          </span>
          <span className="text-[11px] text-slate-300 font-medium">
            Fictional profiles for longitudinal baseline analysis.
            <span className="hidden xl:inline text-slate-400 ml-1">
              Deterministic (seed=42), timezone-aware, with missing data & documented deviations.
            </span>
          </span>
        </div>

        {/* Center: Live Freshness / Database ping */}
        <div className="flex items-center gap-3 text-[11px]">
          {/* Real Database Health Indicator */}
          <div className="flex items-center gap-1.5 font-mono text-[10px]">
            <Database className="w-3 h-3 text-teal-400" />
            {isDbConnected ? (
              <span className="inline-flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                MongoDB: Connected {dbReadiness?.ping_ms !== undefined && dbReadiness.ping_ms >= 0 ? `(${dbReadiness.ping_ms}ms)` : ''}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-rose-400">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                MongoDB: Disconnected
              </span>
            )}
          </div>

          {liveSuccessMsg ? (
            <span className="inline-flex items-center gap-1 text-emerald-400 font-mono font-medium animate-fadeIn bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              {liveSuccessMsg}
            </span>
          ) : latestUpdateInfo ? (
            <div className="hidden md:flex items-center gap-1 text-slate-400 font-mono text-[10px]">
              <Clock className="w-3 h-3 text-teal-400" />
              <span>
                Latest: <strong className="text-teal-300">{latestUpdateInfo.metric.replace(/_/g, ' ')} {latestUpdateInfo.value} {latestUpdateInfo.unit}</strong>
              </span>
            </div>
          ) : null}
        </div>

        {/* Right: Controls (Patient Selector + Live Demo Ingest + Reset Cohort) */}
        <div className="flex items-center flex-wrap justify-center gap-2">
          {/* Quick Patient Switcher */}
          <div className="relative">
            <select
              value={currentPatient?.patient_id || ''}
              onChange={(e) => setCurrentPatientId(e.target.value)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold py-1 px-2.5 pr-7 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer appearance-none transition-colors"
              aria-label="Switch Synthetic Patient Profile"
            >
              {patients.map((p) => (
                <option key={p.patient_id} value={p.patient_id}>
                  {p.demo_data || p.patient_id.startsWith('PT-100') ? '[Demo] ' : '[User] '}{p.patient_id}: {p.full_name}
                </option>
              ))}
            </select>
            <User className="w-3 h-3 text-slate-400 absolute right-2 top-2 pointer-events-none" />
          </div>

          {/* Live Demonstration Mode Button */}
          <button
            onClick={handleLiveInject}
            disabled={isLiveInjecting}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-[11px] transition-all shadow-sm shadow-teal-500/20 disabled:opacity-50"
            title="Simulate incoming real-time telemetry observation and trigger digital twin recalculation"
          >
            <Sparkles className={`w-3 h-3 text-slate-950 ${isLiveInjecting ? 'animate-spin' : ''}`} />
            {isLiveInjecting ? 'Recalculating Twin...' : 'Live Ingest Demo'}
          </button>

          {/* Reset Demo Data Button with explicit confirmation prompt */}
          {!showResetConfirm ? (
            <button
              onClick={() => setShowResetConfirm(true)}
              disabled={isSeeding}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-medium transition-colors disabled:opacity-50"
              title="Safely reset demo cohort back to pristine 90-day baseline (real user data is preserved)"
            >
              <RotateCcw className={`w-3 h-3 text-slate-400 ${isSeeding ? 'animate-spin' : ''}`} />
              {isSeeding ? 'Resetting...' : 'Reset Cohort'}
            </button>
          ) : (
            <div className="flex items-center gap-1 bg-rose-950/80 border border-rose-500/40 px-2 py-0.5 rounded-lg text-[10px]">
              <span className="text-rose-200 font-semibold">Reset demo data?</span>
              <button
                onClick={handleConfirmReset}
                disabled={isSeeding}
                className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded font-bold transition-colors"
              >
                Yes, Reset
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
