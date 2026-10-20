import React, { useState } from 'react';
import { TwinProvider, useTwin } from './context/TwinContext';
import { DemoBanner } from './components/common/DemoBanner';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';

// Pages
import { DashboardPage } from './components/pages/DashboardPage';
import { ObservationsPage } from './components/pages/ObservationsPage';
import { WhatIfSimulator } from './components/simulator/WhatIfSimulator';
import { AlertCenter } from './components/alerts/AlertCenter';
import { SelfBaselineComparison } from './components/comparison/SelfBaselineComparison';
import { MethodologyPage } from './components/pages/MethodologyPage';
import { PrivacyPage } from './components/pages/PrivacyPage';
import { AlertCircle, RefreshCw } from 'lucide-react';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const { isLoading, errorMessage, refreshData, seedDemoData, isSeeding } = useTwin();

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-teal-500 selection:text-slate-950">
      {/* Demo Notice Banner */}
      <DemoBanner />

      {/* Main Top Header */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Global Error Alert Banner if API server is disconnected */}
      {errorMessage && (
        <div className="bg-rose-950/80 border-b border-rose-500/30 px-4 py-2.5 text-xs text-rose-300">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={refreshData}
              className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 text-[11px] font-semibold transition-colors"
            >
              Retry Connection
            </button>
          </div>
        </div>
      )}

      {/* Layout Body: Sidebar + Main Content */}
      <div className="flex-1 flex flex-col md:flex-row max-w-7xl w-full mx-auto">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {activeTab === 'dashboard' && <DashboardPage onNavigateTab={setActiveTab} />}
          {activeTab === 'comparison' && <SelfBaselineComparison />}
          {activeTab === 'observations' && <ObservationsPage />}
          {activeTab === 'simulator' && <WhatIfSimulator />}
          {activeTab === 'alerts' && <AlertCenter />}
          {activeTab === 'methodology' && <MethodologyPage />}
          {activeTab === 'privacy' && <PrivacyPage />}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/90 py-4 px-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <p>© 2026 SwasthyaTwin Digital Health Labs. Built for early risk detection and personalized preventive intervention.</p>
          <p className="text-[11px] text-slate-600">
            Hackathon Research Proof of Concept • Non-Diagnostic • Synthetic Cohorts
          </p>
        </div>
      </footer>
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
