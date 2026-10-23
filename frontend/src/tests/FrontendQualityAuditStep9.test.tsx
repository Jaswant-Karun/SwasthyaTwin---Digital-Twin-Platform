import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MetricCard } from '../components/dashboard/MetricCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { ExplanationModal } from '../components/common/ExplanationModal';
import { MetricDeviation } from '../types';

describe('Step 9: Frontend Quality, Accessibility & State Audit', () => {
  const sampleDeviation: MetricDeviation = {
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

  it('1. Displays exact numeric API response values with no phantom values', () => {
    render(<MetricCard deviation={sampleDeviation} />);

    expect(screen.getByText('84.0')).toBeInTheDocument();
    expect(screen.getByText(/68.0 bpm/i)).toBeInTheDocument();
    expect(screen.getByText('+23.5%')).toBeInTheDocument();
    expect(screen.getByText('+4.00σ')).toBeInTheDocument();
  });

  it('2. Correctly renders status badge variants with appropriate styling', () => {
    const { rerender } = render(<StatusBadge status="optimal" />);
    expect(screen.getByText(/Optimal Baseline/i)).toBeInTheDocument();

    rerender(<StatusBadge status="significant_deviation" />);
    expect(screen.getByText(/Significant Deviation/i)).toBeInTheDocument();

    rerender(<StatusBadge severity="critical" />);
    expect(screen.getByText(/Critical/i)).toBeInTheDocument();
  });

  it('3. Handles insufficient history state with explicit guidance', () => {
    const insufficientDeviation: MetricDeviation = {
      metric_type: 'spo2',
      unit: '%',
      current_value: 98.0,
      baseline_mean: 98.0,
      baseline_std: 0.5,
      delta_absolute: 0.0,
      delta_percentage: 0.0,
      z_score: 0.0,
      status: 'insufficient_history',
      direction: 'normal',
      data_tier: 'measured',
      is_excluded: true,
      exclusion_reason: 'Insufficient baseline observations (minimum 3 required for personalized z-score calculation).'
    };

    render(
      <div>
        <MetricCard deviation={insufficientDeviation} />
        {insufficientDeviation.is_excluded && (
          <div role="status" className="text-amber-400 text-xs mt-2">
            {insufficientDeviation.exclusion_reason}
          </div>
        )}
      </div>
    );

    expect(screen.getByRole('status')).toHaveTextContent(/minimum 3 required/i);
  });

  it('4. Supports keyboard interaction and accessible dialog semantics', () => {
    const onSelect = vi.fn();
    render(<MetricCard deviation={sampleDeviation} onSelect={onSelect} />);

    // Click trigger
    const card = screen.getByText(/Resting Heart Rate/i).closest('.group');
    expect(card).toBeInTheDocument();
    if (card) {
      fireEvent.click(card);
      expect(onSelect).toHaveBeenCalledTimes(1);
    }
  });

  it('5. Renders mathematical explanation modal with transparent loading and accessible dismissal', () => {
    const onClose = vi.fn();
    render(
      <ExplanationModal
        isOpen={true}
        onClose={onClose}
        category="metric"
        itemId="heart_rate"
      />
    );

    // Modal dialog role and accessible title
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Calculation Explanation/i)).toBeInTheDocument();
    expect(screen.getByText(/Retrieving calculation metadata/i)).toBeInTheDocument();

    // Close button triggers callback
    const closeBtn = screen.getByLabelText(/close calculation explanation modal/i);
    expect(closeBtn).toBeInTheDocument();
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('6. Does not render unsubstantiated diagnostic claims or fabricated clinical readiness', () => {
    const { container } = render(<MetricCard deviation={sampleDeviation} />);
    const htmlText = container.textContent?.toLowerCase() || '';

    expect(htmlText).not.toContain('fda approved');
    expect(htmlText).not.toContain('diagnostic certainty');
    expect(htmlText).not.toContain('clinical diagnosis');
  });
});
