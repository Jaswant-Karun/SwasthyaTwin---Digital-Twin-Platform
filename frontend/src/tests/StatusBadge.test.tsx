import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../components/common/StatusBadge';

describe('StatusBadge Component', () => {
  it('renders optimal status correctly', () => {
    render(<StatusBadge status="optimal" />);
    expect(screen.getByText(/Optimal Baseline/i)).toBeInTheDocument();
  });

  it('renders significant deviation status correctly', () => {
    render(<StatusBadge status="significant_deviation" />);
    expect(screen.getByText(/Significant Deviation/i)).toBeInTheDocument();
  });

  it('renders critical alert severity correctly', () => {
    render(<StatusBadge severity="critical" />);
    expect(screen.getByText(/Critical Alert/i)).toBeInTheDocument();
  });
});
