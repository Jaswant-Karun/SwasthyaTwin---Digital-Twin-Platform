import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricCard } from '../components/dashboard/MetricCard';
import { MetricDeviation } from '../types';

describe('MetricCard Component', () => {
  const mockDeviation: MetricDeviation = {
    metric_type: 'heart_rate',
    unit: 'bpm',
    current_value: 78.0,
    baseline_mean: 65.0,
    baseline_std: 3.0,
    delta_absolute: 13.0,
    delta_percentage: 20.0,
    z_score: 4.33,
    status: 'significant_deviation',
    direction: 'elevated',
    data_tier: 'measured'
  };

  it('renders metric label and formatted values correctly', () => {
    render(<MetricCard deviation={mockDeviation} />);

    expect(screen.getByText(/Resting Heart Rate/i)).toBeInTheDocument();
    expect(screen.getByText('78.0')).toBeInTheDocument();
    expect(screen.getByText('+20%')).toBeInTheDocument();
    expect(screen.getByText(/Your Baseline:/i)).toBeInTheDocument();
    expect(screen.getByText(/65.0 bpm/i)).toBeInTheDocument();
    expect(screen.getByText('+4.33σ')).toBeInTheDocument();
  });

  it('displays the correct data tier badge', () => {
    render(<MetricCard deviation={mockDeviation} />);
    expect(screen.getByText(/measured/i)).toBeInTheDocument();
  });
});
