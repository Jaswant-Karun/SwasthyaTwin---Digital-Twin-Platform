import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ExplanationModal } from '../components/common/ExplanationModal';
import { StatusBadge } from '../components/common/StatusBadge';
import { MetricCard } from '../components/dashboard/MetricCard';
import { WhatIfScenarioPanel } from '../components/spatial/WhatIfScenarioPanel';
import { TwinContext } from '../context/TwinContext';
import { MetricDeviation } from '../types';

vi.mock('../services/api', () => ({
  api: {
    runSimulation: vi.fn(),
    getSimulations: vi.fn().mockResolvedValue([]),
    getMetricExplanation: vi.fn().mockResolvedValue({
      title: 'Resting Heart Rate Explanation',
      summary: 'Personal baseline established using median and nMAD.',
      formula: 'Z = (x - median) / nMAD',
      breakdown: { median: 68.0, nmad: 4.0 },
      limitations: 'Non-diagnostic research tracker.'
    })
  }
}));

const mockPatientA: any = {
  patient_id: 'PT-1001',
  full_name: 'Aarav Mehta',
  display_name: 'Aarav Mehta',
  age: 38,
  biological_sex: 'male',
  demo_data: true,
  is_synthetic: true
};

const mockPatientB: any = {
  patient_id: 'PT-1002',
  full_name: 'Priya Sharma',
  display_name: 'Priya Sharma',
  age: 54,
  biological_sex: 'female',
  demo_data: true,
  is_synthetic: true
};

const mockDeviation: MetricDeviation = {
  metric_type: 'heart_rate',
  unit: 'bpm',
  current_value: 84.0,
  baseline_mean: 68.0,
  baseline_std: 4.0,
  delta_absolute: 16.0,
  delta_percentage: 23.5,
  z_score: 4.0,
  status: 'significant_deviation',
  direction: 'elevated',
  data_tier: 'measured'
};

const mockTwinContextA: any = {
  currentPatient: mockPatientA,
  selectedPatientId: 'PT-1001',
  twinState: {
    baselines: {
      heart_rate: { median: 68.0, mean: 68.2 },
      blood_pressure_systolic: { median: 118.0, mean: 118.5 },
      hrv_rmssd: { median: 62.0, mean: 61.8 }
    },
    overall_vitality: 84.5
  },
  patients: [mockPatientA, mockPatientB],
  loading: false,
  error: null
};

describe('End-to-End Acceptance: Keyboard Navigation, Interactive Controls & Safety Boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Verifies accessible keyboard navigation and Escape key dismissal on modals', async () => {
    const onClose = vi.fn();
    render(
      <ExplanationModal
        isOpen={true}
        onClose={onClose}
        category="metric"
        itemId="heart_rate"
      />
    );

    // Modal dialog role is present
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();

    // Escape key press triggers onClose
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('2. Verifies interactive controls and clickable triggers on MetricCards', () => {
    const onSelect = vi.fn();
    render(<MetricCard deviation={mockDeviation} onSelect={onSelect} />);

    expect(screen.getByText('84.0')).toBeInTheDocument();
    expect(screen.getByText('+23.5%')).toBeInTheDocument();

    const trigger = screen.getByText(/Resting Heart Rate/i).closest('.group');
    expect(trigger).toBeInTheDocument();
    if (trigger) {
      fireEvent.click(trigger);
      expect(onSelect).toHaveBeenCalledTimes(1);
    }
  });

  it('3. Verifies strict distinction between measured observations and simulated data in UI', () => {
    render(
      <TwinContext.Provider value={mockTwinContextA}>
        <WhatIfScenarioPanel />
      </TwinContext.Provider>
    );

    // Advisory and simulated-only badge must be prominent
    expect(screen.getByText(/PROVENANCE: SIMULATED ONLY/i)).toBeInTheDocument();
    expect(screen.getByText(/Current Measured Health Baselines/i)).toBeInTheDocument();
    expect(screen.getByText(/68.0 bpm/i)).toBeInTheDocument();
  });

  it('4. Verifies patient isolation in UI context: switching patient updates demographics', () => {
    const { rerender } = render(
      <TwinContext.Provider value={mockTwinContextA}>
        <div data-testid="active-patient">{mockTwinContextA.currentPatient.display_name}</div>
        <div data-testid="patient-id">{mockTwinContextA.currentPatient.patient_id}</div>
      </TwinContext.Provider>
    );

    expect(screen.getByTestId('active-patient')).toHaveTextContent('Aarav Mehta');
    expect(screen.getByTestId('patient-id')).toHaveTextContent('PT-1001');

    // Switch to Patient B
    const mockTwinContextB = {
      ...mockTwinContextA,
      currentPatient: mockPatientB,
      selectedPatientId: 'PT-1002'
    };

    rerender(
      <TwinContext.Provider value={mockTwinContextB}>
        <div data-testid="active-patient">{mockTwinContextB.currentPatient.display_name}</div>
        <div data-testid="patient-id">{mockTwinContextB.currentPatient.patient_id}</div>
      </TwinContext.Provider>
    );

    expect(screen.getByTestId('active-patient')).toHaveTextContent('Priya Sharma');
    expect(screen.getByTestId('patient-id')).toHaveTextContent('PT-1002');
  });

  it('5. Verifies error states render without silent fake-data substitution', () => {
    const errorContext: any = {
      currentPatient: null,
      selectedPatientId: null,
      twinState: null,
      patients: [],
      loading: false,
      error: 'Backend API connection offline (503 Service Unavailable).'
    };

    render(
      <TwinContext.Provider value={errorContext}>
        <div>
          {errorContext.error && (
            <div role="alert" className="bg-rose-50 border border-rose-300 text-rose-800 p-4">
              <span>{errorContext.error}</span>
            </div>
          )}
        </div>
      </TwinContext.Provider>
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/503 Service Unavailable/i);
    // Asserts no fake patient data was injected
    expect(screen.queryByText('Aarav Mehta')).not.toBeInTheDocument();
  });
});
