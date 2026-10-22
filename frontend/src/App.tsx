import React, { useState } from 'react';
import { TwinProvider, useTwin } from './context/TwinContext';
import { DemoBanner } from './components/common/DemoBanner';
import { TopNav } from './components/common/TopNav';
import { Sidebar } from './components/common/Sidebar';

// Pages
import { OverviewPage } from './components/pages/OverviewPage';
import { AddPatientPage } from './components/pages/AddPatientPage';
import { AddObservationPage } from './components/pages/AddObservationPage';
import { DigitalTwinPage } from './components/pages/DigitalTwinPage';
import { HealthTrendsPage } from './components/pages/HealthTrendsPage';
import { RiskInsightsPage } from './components/pages/RiskInsightsPage';
import { WhatIfSimulator } from './components/simulator/WhatIfSimulator';
import { PatientTimeline } from './components/timeline/PatientTimeline';
import { AlertCenter } from './components/alerts/AlertCenter';
import { DataSourcesPage } from './components/pages/DataSourcesPage';
import { SettingsPage } from './components/pages/SettingsPage';
import { MethodologyPage } from './components/pages/MethodologyPage';
import { MLStudioPage } from './components/pages/MLStudioPage';
import { AlertCircle, X } from 'lucide-react';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const { errorMessage, refreshData, selectedRangeDays, setSelectedRangeDays } = useTwin();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-teal-500 selection:text-white">
      {/* 1. Compact Demo Disclosure Banner */}
      <DemoBanner />

      {/* Main Shell Container */}
      <div className="flex-1 flex min-h-screen">
        {/* Desktop Sidebar (Midnight Navy) */}
        <div className="hidden lg:block shrink-0">
          <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>

        {/* Mobile Sidebar Overlay Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative flex-1 flex flex-col max-w-xs w-full bg-[#0b132b] z-50">
              <div className="absolute top-2 right-2">
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 text-slate-400 hover:text-white"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <Sidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                isOpen={mobileMenuOpen}
                onClose={() => setMobileMenuOpen(false)}
              />
            </div>
          </div>
        )}

        {/* Main Application Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top Navigation Bar */}
          <TopNav
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            selectedRange={selectedRangeDays}
            setSelectedRange={setSelectedRangeDays}
            onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
          />

          {/* Global API Connection Warning (if backend is degraded) */}
          {errorMessage && (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800">
              <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{errorMessage} — Using Centralized Synthetic Demonstration Dataset.</span>
                </div>
                <button
                  onClick={refreshData}
                  className="px-2 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-[11px] font-semibold"
                >
                  Retry Connection
                </button>
              </div>
            </div>
          )}

          {/* Active Page Canvas */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl w-full mx-auto">
            {activeTab === 'overview' && (
              <OverviewPage onNavigate={setActiveTab} selectedRange={selectedRangeDays} />
            )}
            {activeTab === 'add-patient' && <AddPatientPage onNavigate={setActiveTab} />}
            {activeTab === 'add-observation' && <AddObservationPage onNavigate={setActiveTab} />}
            {activeTab === 'digital-twin' && <DigitalTwinPage />}
            {activeTab === 'ml-studio' && <MLStudioPage />}
            {activeTab === 'health-trends' && <HealthTrendsPage />}
            {activeTab === 'risk-insights' && <RiskInsightsPage />}
            {activeTab === 'what-if' && <WhatIfSimulator />}
            {activeTab === 'timeline' && <PatientTimeline />}
            {activeTab === 'alerts' && <AlertCenter />}
            {activeTab === 'methodology' && <MethodologyPage />}
            {activeTab === 'data-sources' && <DataSourcesPage />}
            {activeTab === 'settings' && <SettingsPage />}
          </main>

          {/* Clean SaaS Footer */}
          <footer className="border-t border-slate-200 bg-white py-3 px-6 text-xs text-slate-500">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
              <p>© 2026 SwasthyaTwin Clinical Labs. Understand today. Prepare for tomorrow.</p>
              <p className="text-[11px] text-slate-400">
                Hackathon Research Prototype • Non-Diagnostic • Synthetic Cohorts
              </p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
};

export function App() {
  return (
    <TwinProvider>
      <AppContent />
    </TwinProvider>
  );
}

export default App;
