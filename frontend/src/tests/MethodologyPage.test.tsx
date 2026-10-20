import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MethodologyPage } from '../components/pages/MethodologyPage';

describe('MethodologyPage Component', () => {
  it('renders the calculation methodology header and synthetic worked example', () => {
    render(<MethodologyPage />);

    expect(screen.getByText(/SwasthyaTwin Calculation Engine Methodology/i)).toBeInTheDocument();
    expect(screen.getByText(/Worked Example: How a Personal Baseline Works/i)).toBeInTheDocument();
    expect(screen.getByText(/Median\(70, 71, 72, 73, 74\) = 72 bpm/i)).toBeInTheDocument();
    expect(screen.getByText(/Δ = 84 - 72 = \+12\.0 bpm/i)).toBeInTheDocument();
    expect(screen.getByText(/\(\(84 - 72\) \/ 72\) × 100 = \+16\.7%/i)).toBeInTheDocument();
  });

  it('renders explainable demonstration rules table and guardrails against misleading metrics', () => {
    render(<MethodologyPage />);

    expect(screen.getByText(/Where Relative Deviation is Excluded as Misleading/i)).toBeInTheDocument();
    expect(screen.getByText(/DEMO-HR-ELEV-01/i)).toBeInTheDocument();
    expect(screen.getByText(/DEMO-SPO2-DROP-01/i)).toBeInTheDocument();
    expect(screen.getByText(/Clinical & Ethical Boundaries/i)).toBeInTheDocument();
  });
});
