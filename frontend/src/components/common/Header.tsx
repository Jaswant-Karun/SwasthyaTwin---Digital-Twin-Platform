import React from 'react';
import {
  Activity,
  Bell,
  Moon,
  Sun,
  User,
  RefreshCw,
  Search,
  Sparkles
} from 'lucide-react';
import { useTwin } from '../../context/TwinContext';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const {
    patients,
    currentPatient,
    setCurrentPatientId,
    twinState,
    alerts,
    isLoading,
    refreshData,
    isDarkMode,
    toggleDarkMode
  } = useTwin();

  const activeAlertCount = alerts.filter(a => !a.is_acknowledged).length;

  return (
    <header className="sticky top-0 z-40 bg-slate-900/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Platform Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <Activity className="w-6 h-6 text-slate-950 animate-heartbeat" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg text-white tracking-tight">Swasthya<span className="text-teal-400">Twin</span></span>
                <span className="text-[10px] font-mono uppercase bg-teal-500/10 text-teal-400 border border-teal-500/20 px-1.5 py-0.2 rounded font-semibold">
                  v1.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">Personalized Healthcare Digital Twin Engine</p>
            </div>
          </div>

          {/* Patient Selector */}
          <div className="flex items-center gap-3">
            <div className="relative hidden md:flex items-center">
              <label htmlFor="patient-select" className="text-xs text-slate-400 mr-2 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-teal-400" />
                Active Cohort:
              </label>
              <select
                id="patient-select"
                value={currentPatient?.patient_id || ''}
                onChange={(e) => setCurrentPatientId(e.target.value)}
                className="bg-slate-800/90 hover:bg-slate-800 text-white text-xs rounded-lg px-3 py-1.5 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all font-medium cursor-pointer"
              >
                {patients.map(p => (
                  <option key={p.patient_id} value={p.patient_id}>
                    {p.full_name} ({p.patient_id}) - {p.chronic_conditions[0] || 'Standard Profile'}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Actions: Refresh, Alerts, Theme */}
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={refreshData}
                disabled={isLoading}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
                title="Refresh Digital Twin Data"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-teal-400' : ''}`} />
              </button>

              <button
                onClick={() => setActiveTab('alerts')}
                className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
                title="View Health Deviation Alerts"
              >
                <Bell className="w-4 h-4" />
                {activeAlertCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-[9px] font-bold text-white flex items-center justify-center animate-pulse">
                    {activeAlertCount}
                  </span>
                )}
              </button>

              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
                title="Toggle Theme"
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-slate-200" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
