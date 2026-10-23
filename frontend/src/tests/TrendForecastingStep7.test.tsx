import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SpatialTimelineInspector } from '../components/spatial/SpatialTimelineInspector';
import { api } from '../services/api';
import { TwinContext } from '../context/TwinContext';

vi.mock('../services/api', () => ({
  api: {
    getObservations: vi.fn(),
    predictPatientTrends: vi.fn(),
    getMultiSignalTimeline: vi.fn().mockResolvedValue({
      patient_id: 'PT-1001',
      total_items: 0,
      active_signals_count: 0,
      items: [],
      data_layer_summary: {}
    })
  }
}));

const mockPatient: any = {
  patient_id: 'PT-1001',
  full_name: 'Aarav Mehta',
  display_name: 'Aarav Mehta',
  age: 38,
  gender: 'male'
};

const mockTwinContext: any = {
  selectedPatientId: 'PT-1001',
  setSelectedPatientId: vi.fn(),
  twinState: null,
  refreshTwinState: vi.fn(),
  openExplanation: vi.fn()
};

describe('Personal Trend Forecasting Module (Step 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders validated forecast card for supported daily steps target with model version and baselines', async () => {
    (api.getObservations as any).mockResolvedValue({
      items: Array.from({ length: 30 }, (_, i) => ({
        observation_id: `obs_${i}`,
        patient_id: 'PT-1001',
        metric_type: 'daily_steps',
        value: 7500 + i * 20,
        unit: 'steps',
        observed_at: new Date(Date.now() - (30 - i) * 86400000).toISOString()
      }))
    });

    (api.predictPatientTrends as any).mockResolvedValue({
      patient_id: 'PT-1001',
      forecasts: {
        daily_steps: {
          metric_type: 'daily_steps',
          unit: 'steps',
          target_horizon_days: 7,
          model_version: 'v2.1-autoregressive-trend',
          prediction_trajectory: Array.from({ length: 7 }, (_, i) => ({
            day: i + 1,
            date: new Date(Date.now() + (i + 1) * 86400000).toISOString().split('T')[0],
            predicted_value: 8100 + i * 10,
            confidence_lower: 7200,
            confidence_upper: 9000
          })),
          evaluation_metrics: {
            model_name: 'Autoregressive Exponential Trend Model',
            mae: 420.5,
            rmse: 510.2,
            baseline_mae: 650.0,
            baseline_rmse: 780.0,
            evaluation_window_days: 7,
            improvement_vs_persistence_pct: 35.3,
            acceptance_status: 'passed',
            acceptance_reason: 'Model beats persistence baseline.'
          },
          uncertainty_method: 'Empirical residual variance scaled with expanding forecast horizon (95% CI)',
          forecast_generated_at: new Date().toISOString()
        }
      }
    });

    render(
      <TwinContext.Provider value={mockTwinContext}>
        <SpatialTimelineInspector
          patient={mockPatient}
          twinState={null}
          selectedMetric="daily_steps"
          onMetricChange={vi.fn()}
          timelineDays={30}
          onTimelineDaysChange={vi.fn()}
        />
      </TwinContext.Provider>
    );

    // Wait for forecast card to render
    await waitFor(() => {
      expect(screen.getByText(/Personal 7-Day Trend Forecast \(daily_steps\)/i)).toBeInTheDocument();
    });

    // Verify model version, baseline MAE, model MAE, and provenance
    expect(screen.getByText(/v2.1-autoregressive-trend/i)).toBeInTheDocument();
    expect(screen.getByText(/420.5 steps/i)).toBeInTheDocument();
    expect(screen.getByText(/650 steps/i)).toBeInTheDocument();
    expect(screen.getByText(/\+35.3%/i)).toBeInTheDocument();
    expect(screen.getByText(/EVALUATED & VALIDATED/i)).toBeInTheDocument();
    expect(screen.getByText(/Correlations do not demonstrate causal outcomes/i)).toBeInTheDocument();
  });

  it('flags forecast as EXPERIMENTAL if held-out evaluation fails acceptance criterion', async () => {
    (api.getObservations as any).mockResolvedValue({
      items: Array.from({ length: 30 }, (_, i) => ({
        observation_id: `obs_${i}`,
        patient_id: 'PT-1001',
        metric_type: 'daily_steps',
        value: 7500,
        unit: 'steps',
        observed_at: new Date(Date.now() - (30 - i) * 86400000).toISOString()
      }))
    });

    (api.predictPatientTrends as any).mockResolvedValue({
      patient_id: 'PT-1001',
      forecasts: {
        daily_steps: {
          metric_type: 'daily_steps',
          unit: 'steps',
          target_horizon_days: 7,
          model_version: 'v2.1-autoregressive-trend',
          prediction_trajectory: [
            { day: 1, date: '2026-10-24', predicted_value: 8000, confidence_lower: 7000, confidence_upper: 9000 }
          ],
          evaluation_metrics: {
            model_name: 'Autoregressive Exponential Trend Model',
            mae: 1200.0,
            rmse: 1400.0,
            baseline_mae: 900.0,
            baseline_rmse: 1000.0,
            evaluation_window_days: 7,
            improvement_vs_persistence_pct: -33.3,
            acceptance_status: 'experimental',
            acceptance_reason: 'Model error exceeds persistence baseline.'
          },
          uncertainty_method: 'Empirical residual variance scaled with expanding forecast horizon (95% CI)',
          forecast_generated_at: new Date().toISOString()
        }
      }
    });

    render(
      <TwinContext.Provider value={mockTwinContext}>
        <SpatialTimelineInspector
          patient={mockPatient}
          twinState={null}
          selectedMetric="daily_steps"
          onMetricChange={vi.fn()}
          timelineDays={30}
          onTimelineDaysChange={vi.fn()}
        />
      </TwinContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText(/EXPERIMENTAL/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/-33.3%/i)).toBeInTheDocument();
  });

  it('renders explicit explanation when unsupported metric like blood pressure is selected', async () => {
    (api.getObservations as any).mockResolvedValue({ items: [] });
    (api.predictPatientTrends as any).mockResolvedValue({ forecasts: {} });

    render(
      <TwinContext.Provider value={mockTwinContext}>
        <SpatialTimelineInspector
          patient={mockPatient}
          twinState={null}
          selectedMetric="systolic_bp"
          onMetricChange={vi.fn()}
          timelineDays={30}
          onTimelineDaysChange={vi.fn()}
        />
      </TwinContext.Provider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Trend Forecasting Unavailable for Systolic Blood Pressure/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Blood pressure and cardiovascular disease risk are strictly excluded/i)).toBeInTheDocument();
  });
});
