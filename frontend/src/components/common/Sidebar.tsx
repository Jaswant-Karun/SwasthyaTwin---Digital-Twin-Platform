import React from 'react';
import {
  LayoutDashboard,
  LineChart,
  Sliders,
  AlertCircle,
  GitCompare,
  BookOpen,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { useTwin } from '../../context/TwinContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { currentPatient, alerts } = useTwin();
  const unreadAlerts = alerts.filter(a => !a.is_acknowledged).length;

  const navItems = [
    { id: 'dashboard', label: 'Digital Twin Hero', icon: LayoutDashboard },
    { id: 'comparison', label: 'Self vs Baseline', icon: GitCompare },
    { id: 'observations', label: 'Longitudinal Trends', icon: LineChart },
    { id: 'simulator', label: 'What-If Simulator', icon: Sliders },
    { id: 'alerts', label: 'Alert Center', icon: AlertCircle, badge: unreadAlerts },
    { id: 'methodology', label: 'Methodology & Math', icon: BookOpen },
    { id: 'privacy', label: 'Privacy & Data Tiers', icon: ShieldCheck },
  ];

  return (
    <aside className="w-full md:w-64 bg-slate-900/60 dark:bg-slate-950/60 border-b md:border-b-0 md:border-r border-slate-800 p-4 shrink-0">
      {/* Patient Mini Summary */}
      {currentPatient && (
        <div className="mb-6 p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 hidden md:block">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-xs">
              {currentPatient.full_name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="overflow-hidden">
              <h4 className="text-xs font-bold text-white truncate">{currentPatient.full_name}</h4>
              <p className="text-[11px] text-slate-400 font-mono">{currentPatient.patient_id} • {currentPatient.age}y</p>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-700/40 flex justify-between text-[11px]">
            <span className="text-slate-400">Baseline Window:</span>
            <span className="text-teal-400 font-semibold">{currentPatient.baseline_window_days} Days</span>
          </div>
        </div>
      )}

      {/* Nav List */}
      <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/25 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-slate-950 text-teal-300' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
