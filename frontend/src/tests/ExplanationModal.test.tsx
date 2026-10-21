import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExplanationModal } from '../components/common/ExplanationModal';
import { CalculationExplanation } from '../types';

describe('ExplanationModal Component', () => {
  const mockExplanation: CalculationExplanation = {
    category: 'metric',
    item_id: 'heart_rate',
    title: 'Resting Heart Rate Deviation',
    current_value: 78.0,
    unit: 'bpm',
    baseline_value: 65.0,
    baseline_window_days: 14,
    observations_count: 14,
    formula: 'Z = (x - μ) / σ = (78.0 - 65.0) / 3.0 = +4.33σ',
    worked_example: [
      { step_number: 1, label: 'Retrieve Measured Telemetry', value: '78.0 bpm', note: 'Received from Apple Watch BLE' },
      { step_number: 2, label: 'Retrieve 14-Day Baseline Mean (μ)', value: '65.0 bpm', note: 'Aggregated from 14 verified morning readings' },
      { step_number: 3, label: 'Retrieve Baseline Standard Deviation (σ)', value: '3.0 bpm', note: 'Rolling standard deviation' },
      { step_number: 4, label: 'Compute Standardized Z-Score', value: '+4.33σ', formula_fragment: '(78.0 - 65.0) / 3.0' }
    ],
    data_source: 'Apple Watch Series 9 (BLE Continuous PPG)',
    latest_observation_time: '2026-10-21T07:30:00Z',
    trigger_reason: 'Current value exceeds self-baseline by +4.33σ (> 2.0σ threshold).',
    missing_data_warning: null,
    is_missing_data: false,
    limitations: 'Calculated from resting morning samples; acute caffeine or psychological stress may temporarily shift values.',
    methodology_type: 'statistical_estimate'
  };

  it('renders all 10 transparency items accurately', () => {
    const handleClose = vi.fn();
    render(<ExplanationModal isOpen={true} explanation={mockExplanation} onClose={handleClose} />);

    // 1. Current value and unit
    expect(screen.getByText('78')).toBeInTheDocument();
    expect(screen.getByText('bpm')).toBeInTheDocument();

    // 2. Patient baseline
    expect(screen.getByText(/65/)).toBeInTheDocument();

    // 3. Historical window used
    expect(screen.getByText(/14 Days/i)).toBeInTheDocument();

    // 4. Number of observations used
    expect(screen.getByText(/14 readings/i)).toBeInTheDocument();

    // 5. Formula applied
    expect(screen.getByText(/Z = \(x - μ\) \/ σ/i)).toBeInTheDocument();

    // 6. Worked numerical example
    expect(screen.getByText(/Retrieve Measured Telemetry/i)).toBeInTheDocument();
    expect(screen.getByText('+4.33σ')).toBeInTheDocument();

    // 7. Data source and latest timestamp
    expect(screen.getByText(/Apple Watch Series 9/i)).toBeInTheDocument();

    // 8. Trigger reason
    expect(screen.getByText(/exceeds self-baseline by \+4.33σ/i)).toBeInTheDocument();

    // 9. Freshness / Missing data status
    expect(screen.getByText(/Verified Telemetry/i)).toBeInTheDocument();

    // 10. Limitations and methodology classification
    expect(screen.getByText(/Calculated from resting morning samples/i)).toBeInTheDocument();
    expect(screen.getByText(/Statistical Estimate/i)).toBeInTheDocument();
  });

  it('handles missing telemetry and sparse baselines honestly without fabrication', () => {
    const sparseExplanation: CalculationExplanation = {
      category: 'metric',
      item_id: 'blood_glucose_fasting',
      title: 'Fasting Blood Glucose Deviation',
      current_value: null,
      unit: 'mg/dL',
      baseline_value: null,
      baseline_window_days: 14,
      observations_count: 0,
      formula: 'Z = (x - μ) / σ',
      worked_example: [
        { step_number: 1, label: 'Evaluate Sensor Influx', value: '0 Observations', note: 'Telemetry channel disconnected' }
      ],
      data_source: 'Continuous Glucose Monitor (Awaiting Sensor Pairing)',
      latest_observation_time: null,
      trigger_reason: 'Metric cannot be assessed due to absent telemetry.',
      missing_data_warning: 'Awaiting Telemetry: 0 observations available. Generic population norms are NOT substituted.',
      is_missing_data: true,
      limitations: 'Calculations require direct patient observations.',
      methodology_type: 'statistical_estimate'
    };

    render(<ExplanationModal isOpen={true} explanation={sparseExplanation} onClose={() => {}} />);

    expect(screen.getByText(/Awaiting Telemetry/i)).toBeInTheDocument();
    expect(screen.getByText(/Generic population norms are NOT substituted/i)).toBeInTheDocument();
    expect(screen.getByText(/Telemetry channel disconnected/i)).toBeInTheDocument();
  });

  it('closes when Escape key is pressed or close button is clicked', () => {
    const handleClose = vi.fn();
    render(<ExplanationModal isOpen={true} explanation={mockExplanation} onClose={handleClose} />);

    // Click close button
    const closeBtn = screen.getByLabelText(/Close explanation/i);
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    // Press Escape key
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(2);
  });
});
