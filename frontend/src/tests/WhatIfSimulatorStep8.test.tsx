import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WhatIfScenarioPanel } from '../components/spatial/WhatIfScenarioPanel';
import { api } from '../services/api';
import { TwinContext } from '../context/TwinContext';

vi.mock('../services/api', () => ({
  api: {
    runSimulation: vi.fn(),
    getSimulations: vi.fn().mockResolvedValue([])
  }
}));

const mockPatient: any = {
  patient_id: 'PT-1001',
  full_name: 'Aarav Mehta',
  display_name: 'Aarav Mehta',
  age: 38,
  gender: 'male'
};

const mockTwinState: any = {
  baselines: {
    heart_rate: { median: 68.0, mean: 68.2 },
    blood_pressure_systolic: { median: 118.0, mean: 118.5 },
    hrv_rmssd: { median: 62.0, mean: 61.8 }
  },
  overall_vitality: 84.5
};

const mockTwinContext: any = {
  currentPatient: mockPatient,
  twinState: mockTwinState,
  selectedPatientId: 'PT-1001'
};

describe('Interactive What-If Simulator Workspace (Step 8)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders locked current measured health baselines and advisory disclaimer', () => {
    render(
      <TwinContext.Provider value={mockTwinContext}>
        <WhatIfScenarioPanel />
      </TwinContext.Provider>
    );

    // Advisory and provenance badges
    expect(screen.getByText(/PROVENANCE: SIMULATED ONLY/i)).toBeInTheDocument();
    expect(screen.getByText(/Hypothetical Simulation Advisory/i)).toBeInTheDocument();

    // Locked measured values
    expect(screen.getByText(/Current Measured Health Baselines/i)).toBeInTheDocument();
    expect(screen.getByText(/68.0 bpm/i)).toBeInTheDocument();
    expect(screen.getByText(/118.0 mmHg/i)).toBeInTheDocument();
    expect(screen.getByText(/62.0 ms/i)).toBeInTheDocument();
  });

  it('detects contradictory inputs and blocks simulation with a clear warning', async () => {
    render(
      <TwinContext.Provider value={mockTwinContext}>
        <WhatIfScenarioPanel />
      </TwinContext.Provider>
    );

    // Set sleep slider to -3.0 hrs
    const sleepSlider = screen.getByLabelText(/Hypothetical sleep duration adjustment in hours per night/i);
    fireEvent.change(sleepSlider, { target: { value: '-3.0' } });

    // Set steps slider to +12,000 steps (contradictory)
    const stepsSlider = screen.getByLabelText(/Hypothetical daily step count adjustment/i);
    fireEvent.change(stepsSlider, { target: { value: '11000' } });

    // Contradiction alert should appear
    await waitFor(() => {
      expect(screen.getByText(/Severe sleep loss \(-3h\) combined with high step volume/i)).toBeInTheDocument();
    });

    // Run button must be disabled
    const runBtn = screen.getByRole('button', { name: /Run Scenario Simulation/i });
    expect(runBtn).toBeDisabled();
  });

  it('executes simulation and displays side-by-side comparison, model version, and output classifications', async () => {
    (api.runSimulation as any).mockResolvedValue({
      _id: 'sim_test_123',
      patient_id: 'PT-1001',
      scenario_name: 'Aerobic Habit Shift',
      created_at: new Date().toISOString(),
      parameters: {
        delta_sleep_hours: 1.0,
        delta_daily_steps: 3000,
        delta_stress_level: -15,
        sodium_reduction_pct: 20,
        duration_days: 30
      },
      baseline_summary: { resting_hr: 68.0, systolic_bp: 118.0, hrv_rmssd: 62.0 },
      projected_outcomes: {
        final_resting_hr: 64.2,
        delta_resting_hr: -3.8,
        final_systolic_bp: 114.0,
        delta_systolic_bp: -4.0,
        final_hrv_rmssd: 76.5,
        delta_hrv_rmssd: 14.5,
        final_vitality: 89.2,
        ml_baseline_risk_tier: 'Moderate Strain',
        ml_projected_risk_tier: 'Optimal Resilience'
      },
      data_tier: 'simulated',
      model_version: 'v2.1.0',
      output_classifications: {
        resting_hr: 'deterministic_calculation',
        systolic_bp: 'deterministic_calculation',
        hrv_rmssd: 'deterministic_calculation',
        vitality_index: 'hybrid_calculation',
        ml_risk_tier: 'model_prediction',
        lifestyle_adherence: 'illustrative_assumption'
      },
      trajectories: [],
      model_assumptions: ['Exponential saturation kinetics'],
      disclaimer: 'Not clinical advice.'
    });

    render(
      <TwinContext.Provider value={mockTwinContext}>
        <WhatIfScenarioPanel />
      </TwinContext.Provider>
    );

    const runBtn = screen.getByRole('button', { name: /Run Scenario Simulation/i });
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(screen.getByText(/Side-by-Side Comparison: Current Measured vs. Simulated Scenario/i)).toBeInTheDocument();
    });

    // Verify side-by-side values
    expect(screen.getByText(/64.2 bpm/i)).toBeInTheDocument();
    expect(screen.getByText(/114.0 mmHg/i)).toBeInTheDocument();
    expect(screen.getByText(/Optimal Resilience/i)).toBeInTheDocument();

    // Verify semantic classifications
    expect(screen.getByText(/Output Semantic Classification/i)).toBeInTheDocument();
    expect(screen.getByText(/Deterministic Calculations:/i)).toBeInTheDocument();
    expect(screen.getByText(/Model Predictions:/i)).toBeInTheDocument();
    expect(screen.getByText(/Illustrative Assumptions:/i)).toBeInTheDocument();
  });

  it('resets levers to baseline zero perturbation when reset button is pressed', async () => {
    render(
      <TwinContext.Provider value={mockTwinContext}>
        <WhatIfScenarioPanel />
      </TwinContext.Provider>
    );

    // Adjust sleep slider
    const sleepSlider = screen.getByLabelText(/Hypothetical sleep duration adjustment in hours per night/i);
    fireEvent.change(sleepSlider, { target: { value: '2.5' } });
    expect(screen.getByText(/\+2.5 hrs\/night/i)).toBeInTheDocument();

    // Click Reset
    const resetBtn = screen.getByRole('button', { name: /Reset simulation levers/i });
    fireEvent.click(resetBtn);

    // Should return to 0 hrs/night
    expect(screen.getByText(/0 hrs\/night/i)).toBeInTheDocument();
  });
});
