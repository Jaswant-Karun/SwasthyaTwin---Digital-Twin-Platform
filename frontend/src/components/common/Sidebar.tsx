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
  PlusCircle
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
    { id: 'digital-twin', label: 'Digital Twin', icon: HeartPulse },
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
      <div className="px-3 py-4 flex-1 space-y-1">
        <div className="px-3 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
          Clinical Platform
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleSelect(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30 font-semibold'
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
              ) : isActive ? (
                <ChevronRight className="w-3.5 h-3.5 text-teal-400" />
              ) : null}
            </button>
          );
        })}
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
