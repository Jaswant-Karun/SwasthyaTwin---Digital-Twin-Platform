import React, { useState } from 'react';
import {
  ChevronRight,
  User,
  Calendar,
  Bell,
  RefreshCw,
  CheckCircle2,
  Database,
  Menu,
  ShieldCheck,
  Check
} from 'lucide-react';
import { useTwin } from '../../context/TwinContext';

interface TopNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedRange: number;
  setSelectedRange: (days: number) => void;
  onToggleMobileMenu?: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  activeTab,
  setActiveTab,
  selectedRange,
  setSelectedRange,
  onToggleMobileMenu
}) => {
  const {
    patients,
    currentPatient,
    setCurrentPatientId,
    alerts,
    systemHealth,
    dbReadiness,
    isOfflineDemo,
    selectedRangeDays,
    setSelectedRangeDays,
    refreshData,
    isLoading
  } = useTwin();

  const [showNotifications, setShowNotifications] = useState(false);
  const unreadAlerts = alerts.filter(a => !a.is_acknowledged);

  const effectiveRange = selectedRangeDays || selectedRange;

  const handleRangeChange = (days: number) => {
    setSelectedRange(days);
    setSelectedRangeDays(days);
  };

  const getBreadcrumbLabel = (tab: string) => {
    switch (tab) {
      case 'overview': return 'Overview Dashboard';
      case 'digital-twin': return 'Digital Twin Profile';
      case 'health-trends': return 'Health Trends & Analytics';
      case 'risk-insights': return 'Risk Insights';
      case 'what-if': return 'What-if Simulator';
      case 'timeline': return 'Patient Timeline';
      case 'alerts': return 'Alert Center';
      case 'data-sources': return 'Data Sources & Governance';
      case 'settings': return 'Platform Settings';
      default: return 'Overview';
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between shadow-xs">
      {/* Left: Mobile Menu Toggle + Breadcrumbs */}
      <div className="flex items-center gap-3">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 lg:hidden"
            aria-label="Toggle Navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <nav className="flex items-center gap-1.5 text-xs text-slate-500" aria-label="Breadcrumb">
          <span className="font-semibold text-slate-800">SwasthyaTwin</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-medium text-slate-600 hidden sm:inline">
            {currentPatient?.full_name || 'Patient'}
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
          <span className="font-semibold text-teal-600">
            {getBreadcrumbLabel(activeTab)}
          </span>
        </nav>
      </div>

      {/* Right Controls: Patient Selector + Date Range + Notifications + Profile */}
      <div className="flex items-center gap-3">
        {/* Patient Selector */}
        <div className="relative">
          <select
            value={currentPatient?.patient_id || ''}
            onChange={(e) => setCurrentPatientId(e.target.value)}
            className="text-xs bg-slate-50 hover:bg-slate-100 text-slate-800 font-medium py-1.5 px-3 pr-8 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer appearance-none"
            aria-label="Select Patient"
          >
            {patients.map((p) => (
              <option key={p.patient_id} value={p.patient_id}>
                {p.full_name} ({p.patient_id})
              </option>
            ))}
          </select>
          <User className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
        </div>

        {/* Date Range Selector */}
        <div className="hidden md:flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200 text-xs">
          {[7, 14, 30, 90].map((days) => (
            <button
              key={days}
              onClick={() => handleRangeChange(days)}
              className={`px-2.5 py-1 rounded-md font-medium text-xs transition-colors ${
                effectiveRange === days
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {days}D
            </button>
          ))}
        </div>

        {/* Refresh Action */}
        <button
          onClick={refreshData}
          disabled={isLoading}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          title="Refresh Telemetry"
          aria-label="Refresh Telemetry"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-teal-600' : ''}`} />
        </button>

        {/* Notifications Control */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors relative"
            title="Notifications"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadAlerts.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                {unreadAlerts.length}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Drawer */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg p-3 z-50 text-xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-slate-900">Active Health Alerts</span>
                <span className="text-[10px] bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded font-semibold">
                  {unreadAlerts.length} Pending
                </span>
              </div>
              {unreadAlerts.length === 0 ? (
                <p className="text-slate-500 py-3 text-center">No unacknowledged alerts</p>
              ) : (
                <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                  {unreadAlerts.map(a => (
                    <div key={a._id} className="py-2 hover:bg-slate-50 rounded px-1 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900 truncate">{a.title}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-slate-500 text-[11px] truncate mt-0.5">{a.description}</p>
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => {
                  setShowNotifications(false);
                  setActiveTab('alerts');
                }}
                className="w-full text-center py-1.5 text-xs text-teal-600 hover:text-teal-700 font-semibold block border-t border-slate-100"
              >
                Go to Alert Center →
              </button>
            </div>
          )}
        </div>

        {/* Database & Real Connection Indicator */}
        <div className={`hidden xl:flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border font-mono transition-colors ${
          dbReadiness?.ready
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : isOfflineDemo
            ? 'bg-amber-50 text-amber-800 border-amber-200'
            : 'bg-rose-50 text-rose-800 border-rose-200 animate-pulse'
        }`}>
          <Database className={`w-3.5 h-3.5 ${
            dbReadiness?.ready ? 'text-emerald-600' : isOfflineDemo ? 'text-amber-600' : 'text-rose-600'
          }`} />
          <span className="text-[10px] font-semibold">
            {dbReadiness?.ready
              ? `MongoDB (${dbReadiness.ping_ms}ms)`
              : isOfflineDemo
              ? 'Demo Mode (Offline)'
              : 'DB Connecting...'}
          </span>
        </div>

        {/* User Profile Avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xs border border-teal-200">
            AS
          </div>
          <div className="hidden lg:block text-left">
            <span className="block text-xs font-semibold text-slate-800 leading-tight">Dr. Ananya Sen</span>
            <span className="block text-[10px] text-slate-500 leading-tight">Clinical Lead</span>
          </div>
        </div>
      </div>
    </header>
  );
};
