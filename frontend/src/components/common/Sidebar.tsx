import React from 'react';
import {
  LayoutDashboard,
  Activity,
  LineChart,
  ShieldAlert,
  Sliders,
  Clock,
  AlertCircle,
  Database,
  Settings,
  ChevronRight,
  HeartPulse,
  BookOpen,
  UserPlus,
  PlusCircle,
  Brain,
  BarChart3
} from 'lucide-react';
import { useTwin } from '../../context/TwinContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isOpen, onClose }) => {
  const { currentPatient, alerts } = useTwin();
  const unreadAlerts = alerts.filter(a => !a.is_acknowledged).length;

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'add-patient', label: 'Add Patient', icon: UserPlus },
    { id: 'add-observation', label: 'Add Health Data', icon: PlusCircle },
    { id: 'digital-twin', label: 'AI Digital Twin', icon: HeartPulse, badgeText: 'LIVE' },
    { id: 'ml-studio', label: 'ML Training Studio', icon: Brain, badgeText: 'AI' },
    { id: 'model-evaluation', label: 'Model Evaluation', icon: BarChart3, badgeText: 'ML' },
    { id: 'health-trends', label: 'Health Trends', icon: LineChart },
    { id: 'risk-insights', label: 'Risk Insights', icon: ShieldAlert },
    { id: 'what-if', label: 'What-if Simulator', icon: Sliders },
    { id: 'timeline', label: 'Patient Timeline', icon: Clock },
    { id: 'alerts', label: 'Alerts', icon: AlertCircle, badge: unreadAlerts },
    { id: 'methodology', label: 'Methodology', icon: BookOpen },
    { id: 'data-sources', label: 'Data Sources', icon: Database },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleSelect = (id: string) => {
    setActiveTab(id);
    if (onClose) onClose();
  };

  return (
    <aside className="w-64 sidebar-navy text-slate-300 flex flex-col shrink-0 min-h-screen border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500 to-teal-400 flex items-center justify-center text-slate-950 font-black shadow-md shadow-teal-500/20">
            <Activity className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base text-white tracking-tight">Swasthya<span className="text-teal-400">Twin</span></span>
              <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">v1.0</span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">Understand today. Prepare for tomorrow.</p>
          </div>
        </div>
      </div>

      {/* Patient Card Preview */}
      {currentPatient && (
        <div className="mx-4 mt-4 p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
          <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1 font-medium">
            <span>ACTIVE PROFILE</span>
            <span className="font-mono text-teal-400">{currentPatient.patient_id}</span>
          </div>
          <div className="font-semibold text-white truncate text-sm">{currentPatient.full_name}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {currentPatient.age}y • {currentPatient.biological_sex.toUpperCase()} • {currentPatient.baseline_window_days}d Baseline
          </div>
        </div>
      )}

      {/* Navigation List */}
      <div className="px-3 py-4 flex-1 space-y-4 overflow-y-auto">
        {/* Spatial Core Workspace */}
        <div className="space-y-1">
          <div className="px-3 pb-1 text-[9px] font-extrabold text-cyan-400 uppercase tracking-widest font-mono">
            Spatial Workspace
          </div>
          {[
            { id: 'digital-twin', label: 'Spatial Digital Twin', icon: HeartPulse, badgeText: 'LIVE' },
            { id: 'timeline', label: 'Health Timeline', icon: Clock },
            { id: 'what-if', label: 'What-If Lab', icon: Sliders, badgeText: 'SIM' },
            { id: 'risk-insights', label: 'AI Risk Insights', icon: ShieldAlert },
          ].map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-teal-500/20 to-cyan-500/20 text-cyan-200 border border-cyan-500/40 font-bold shadow-md shadow-cyan-950/60'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badgeText && (
                  <span className="px-1.5 py-0.2 text-[9px] font-extrabold rounded bg-teal-500/20 text-teal-300 border border-teal-500/40 font-mono tracking-wider">
                    {item.badgeText}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Clinical Data Ingestion */}
        <div className="space-y-1">
          <div className="px-3 pb-1 text-[9px] font-extrabold text-slate-500 uppercase tracking-widest font-mono">
            Data & Provenance
          </div>
          {[
            { id: 'overview', label: 'Overview Dashboard', icon: LayoutDashboard },
            { id: 'add-observation', label: 'Add Observation', icon: PlusCircle },
            { id: 'add-patient', label: 'Patient Cohort', icon: UserPlus },
            { id: 'data-sources', label: 'Data Sources', icon: Database },
            { id: 'alerts', label: 'Safety Alerts', icon: AlertCircle, badge: unreadAlerts },
          ].map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-teal-500/20 to-cyan-500/20 text-cyan-200 border border-cyan-500/40 font-bold shadow-md shadow-cyan-950/60'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-teal-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 ? (
                  <span className="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Machine Learning & Research */}
        <div className="space-y-1">
          <div className="px-3 pb-1 text-[9px] font-extrabold text-slate-500 uppercase tracking-widest font-mono">
            AI Research & Models
          </div>
          {[
            { id: 'ml-studio', label: 'ML Training Studio', icon: Brain, badgeText: 'AI' },
            { id: 'model-evaluation', label: 'Model Evaluation', icon: BarChart3, badgeText: 'BENCH' },
            { id: 'health-trends', label: 'Baseline Trends', icon: LineChart },
            { id: 'methodology', label: 'Methodology & Ethics', icon: BookOpen },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-teal-500/20 to-cyan-500/20 text-cyan-200 border border-cyan-500/40 font-bold shadow-md shadow-cyan-950/60'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-teal-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badgeText && (
                  <span className="px-1.5 py-0.2 text-[9px] font-extrabold rounded bg-teal-500/20 text-teal-300 border border-teal-500/40 font-mono tracking-wider">
                    {item.badgeText}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sidebar Footer System Status */}
      <div className="p-4 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1">
        <div className="flex items-center justify-between">
          <span>Engine Status:</span>
          <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Connected
          </span>
        </div>
        <p className="text-[10px] text-slate-400">Research & Demonstration Build</p>
      </div>
    </aside>
  );
};
