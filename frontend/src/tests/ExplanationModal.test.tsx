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
    current_value_formatted: '78.0 bpm',
    unit: 'bpm',
    baseline_value: 65.0,
    baseline_formatted: '65.0 bpm (σ = 3.0)',
    historical_window: 'Past 14 Days Rolling Window',
    window_days: 14,
    observations_count: 14,
    observations_sufficiency: '14 readings (100% complete)',
    is_sufficient: true,
    formula_name: 'Personal Standardized Z-Score',
    formula_latex_or_text: 'Z = (x - μ) / σ',
    formula_explanation: 'Standardizes divergence against personal baseline distribution.',
    worked_example_steps: [
      {
        step_number: 1,
        title: 'Retrieve Measured Telemetry',
        description: 'Received from Apple Watch BLE',
        calculation: 'x = 78.0 bpm',
        result: '78.0 bpm'
      },
      {
        step_number: 2,
        title: 'Retrieve Personal Baseline (μ)',
        description: 'Aggregated 14-day morning readings',
        calculation: 'μ = 65.0 bpm',
        result: '65.0 bpm'
      },
      {
        step_number: 3,
        title: 'Compute Standardized Z-Score',
        description: 'Apply self-baseline normalization',
        calculation: 'Z = (78.0 - 65.0) / 3.0',
        result: '+4.33σ'
      }
    ],
    worked_example_summary: 'Z = (78.0 - 65.0) / 3.0 = +4.33σ (Divergence of +20.0%)',
    data_source: 'Apple Watch Series 9 (BLE Continuous PPG)',
    latest_timestamp: '2026-10-21T07:30:00Z',
    latest_timestamp_formatted: 'Today at 07:30 AM',
    reason_flag_or_alert: 'Current value exceeds self-baseline by +4.33σ (> 2.0σ threshold).',
    flag_severity: 'critical',
    warnings: ['Continuous telemetry active: Fresh data synchronized within rolling window.'],
    is_stale: false,
    is_missing_data: false,
    result_type: 'Statistical Estimate',
    limitations: 'Calculated from resting morning samples; acute caffeine or psychological stress may temporarily shift values.'
  };

  it('renders all 10 transparency items accurately', () => {
    const handleClose = vi.fn();
    render(<ExplanationModal isOpen={true} explanation={mockExplanation} onClose={handleClose} />);

    // 1. Current value and unit
    expect(screen.getAllByText('78.0 bpm').length).toBeGreaterThanOrEqual(1);

    // 2. Patient baseline
    expect(screen.getAllByText('65.0 bpm').length).toBeGreaterThanOrEqual(1);

    // 3. Historical window used
    expect(screen.getByText(/14 Days/i)).toBeInTheDocument();

    // 4. Number of observations used
    expect(screen.getByText(/14 Readings/i)).toBeInTheDocument();

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
    expect(screen.getByText(/Continuous telemetry active/i)).toBeInTheDocument();

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
      current_value_formatted: 'Awaiting Telemetry',
      unit: 'mg/dL',
      baseline_value: null,
      baseline_formatted: 'Not Established (0 readings)',
      historical_window: 'Past 14 Days Rolling Window',
      window_days: 14,
      observations_count: 0,
      observations_sufficiency: '0 readings (Insufficient)',
      is_sufficient: false,
      formula_name: 'Personal Standardized Z-Score',
      formula_latex_or_text: 'Z = (x - μ) / σ',
      formula_explanation: 'Standardizes divergence against personal baseline distribution.',
      worked_example_steps: [
        {
          step_number: 1,
          title: 'Telemetry Evaluation',
          description: 'No telemetry packets recorded for Kabir Sen in active baseline window',
          calculation: 'Available n = 0',
          result: 'Zero Data'
        }
      ],
      worked_example_summary: 'Unable to evaluate deviation formula: Telemetry missing.',
      data_source: 'Continuous Glucose Monitor (Awaiting Sensor Pairing)',
      latest_timestamp: null,
      latest_timestamp_formatted: 'No Telemetry Recorded',
      reason_flag_or_alert: 'Metric cannot be assessed due to absent telemetry.',
      flag_severity: 'warning',
      warnings: ['Awaiting Telemetry: 0 observations available. Generic population norms are NOT substituted.'],
      is_stale: false,
      is_missing_data: true,
      result_type: 'Statistical Estimate',
      limitations: 'Calculations require direct patient observations. No synthetic population values are imputed.'
    };

    render(<ExplanationModal isOpen={true} explanation={sparseExplanation} onClose={() => {}} />);

    expect(screen.getByText(/Awaiting Telemetry: 0 observations available/i)).toBeInTheDocument();
    expect(screen.getByText(/Generic population norms are NOT substituted/i)).toBeInTheDocument();
    expect(screen.getByText(/No telemetry packets recorded for Kabir Sen/i)).toBeInTheDocument();
  });

  it('closes when Escape key is pressed or close button is clicked', () => {
    const handleClose = vi.fn();
    render(<ExplanationModal isOpen={true} explanation={mockExplanation} onClose={handleClose} />);

    // Click close button
    const closeBtn = screen.getByLabelText(/close/i);
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    // Press Escape key
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(2);
  });
});
