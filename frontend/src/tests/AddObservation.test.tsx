import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddObservationPage } from '../components/pages/AddObservationPage';
import { TwinProvider } from '../context/TwinContext';

describe('AddObservationPage Component', () => {
  it('renders observation sub-tabs and single observation input form', () => {
    render(
      <TwinProvider>
        <AddObservationPage />
      </TwinProvider>
    );

    expect(screen.getByRole('heading', { name: /Add Health Observation/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Single Observation/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daily Lifestyle Log/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Wearable CSV Import/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Data History & Corrections/i })).toBeInTheDocument();

    // Measurement Type and Numeric Value
    expect(screen.getByText(/Measurement Type/i)).toBeInTheDocument();
    expect(screen.getByText(/Numeric Value/i)).toBeInTheDocument();
    expect(screen.getByText(/Data Classification/i)).toBeInTheDocument();
  });

  it('renders calculation engine explanation when switching to Daily Lifestyle Log tab', async () => {
    render(
      <TwinProvider>
        <AddObservationPage />
      </TwinProvider>
    );

    const lifestyleTab = screen.getByRole('button', { name: /Daily Lifestyle Log/i });
    fireEvent.click(lifestyleTab);

    expect(
      screen.getByText(/How Lifestyle Inputs Contribute to the Calculation Engine/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/1\. Sleep Duration \(hours\):/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. Activity \/ Daily Steps:/i)).toBeInTheDocument();
    expect(screen.getByText(/3\. General Activity Level:/i)).toBeInTheDocument();
  });

  it('renders Wearable CSV Import tab with sample template download button', async () => {
    render(
      <TwinProvider>
        <AddObservationPage />
      </TwinProvider>
    );

    const csvTab = screen.getByRole('button', { name: /Wearable CSV Import/i });
    fireEvent.click(csvTab);

    expect(screen.getByText(/Wearable & Sensor CSV Import/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download Sample Template/i })).toBeInTheDocument();
    expect(screen.getByText(/Select CSV File/i)).toBeInTheDocument();
  });
});
