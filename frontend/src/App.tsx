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
import { ModelEvaluationPage } from './components/pages/ModelEvaluationPage';
import { AlertCircle, X } from 'lucide-react';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const { errorMessage, refreshData, selectedRangeDays, setSelectedRangeDays } = useTwin();

  return (
    <div className="min-h-screen flex flex-col spatial-canvas text-slate-100 selection:bg-teal-500 selection:text-slate-950 font-sans">
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
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative flex-1 flex flex-col max-w-xs w-full sidebar-navy z-50">
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
            <div className="bg-amber-950/60 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-200">
              <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{errorMessage} — Using Centralized Synthetic Demonstration Dataset.</span>
                </div>
                <button
                  onClick={refreshData}
                  className="px-2 py-0.5 rounded bg-amber-900/60 hover:bg-amber-800 text-amber-200 border border-amber-500/40 text-[11px] font-semibold"
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
            {activeTab === 'digital-twin' && <DigitalTwinPage onNavigate={setActiveTab} />}
            {activeTab === 'ml-studio' && <MLStudioPage />}
            {activeTab === 'model-evaluation' && <ModelEvaluationPage />}
            {activeTab === 'health-trends' && <HealthTrendsPage />}
            {activeTab === 'risk-insights' && <RiskInsightsPage />}
            {activeTab === 'what-if' && <WhatIfSimulator />}
            {activeTab === 'timeline' && <PatientTimeline />}
            {activeTab === 'alerts' && <AlertCenter />}
            {activeTab === 'methodology' && <MethodologyPage />}
            {activeTab === 'data-sources' && <DataSourcesPage />}
            {activeTab === 'settings' && <SettingsPage />}
          </main>

          {/* Premium Spatial Footer */}
          <footer className="border-t border-white/10 bg-slate-950/80 backdrop-blur-md py-3 px-6 text-xs text-slate-400">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
              <p>© 2026 SwasthyaTwin Clinical Labs. Understand today. Prepare for tomorrow.</p>
              <p className="text-[11px] text-slate-500 font-mono">
                Spatial Healthcare Interface • Non-Diagnostic • Multi-Tier Telemetry Integrity
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
