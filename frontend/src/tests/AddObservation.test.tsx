import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddObservationPage } from '../components/pages/AddObservationPage';
import { TwinProvider } from '../context/TwinContext';
import { api } from '../services/api';
import { MOCK_PATIENTS } from '../services/mockData';

describe('AddObservationPage Component', () => {
  beforeEach(() => {
    vi.spyOn(api, 'getPatients').mockResolvedValue(MOCK_PATIENTS);
    vi.spyOn(api, 'getHealth').mockResolvedValue({
      status: 'healthy',
      service: 'SwasthyaTwin',
      version: '1.0.0',
      database: { status: 'connected', engine: 'mongodb' }
    } as any);
    vi.spyOn(api, 'getReadiness').mockResolvedValue({
      ready: true,
      database: 'connected',
      ping_ms: 5
    });
    vi.spyOn(api, 'getTwinState').mockResolvedValue({} as any);
    vi.spyOn(api, 'getTwinAssessment').mockResolvedValue({} as any);
    vi.spyOn(api, 'getAlerts').mockResolvedValue([]);
    vi.spyOn(api, 'getExplanations').mockResolvedValue(null as any);
  });

  it('renders observation sub-tabs including Review Data Quality and single observation form', () => {
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
    expect(screen.getByRole('button', { name: /Review Data Quality/i })).toBeInTheDocument();

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

  it('renders Review Data Quality tab with provenance matrix, baseline isolation, corridors, and prediction safeguards', async () => {
    render(
      <TwinProvider>
        <AddObservationPage />
      </TwinProvider>
    );

    const qualityTab = screen.getByRole('button', { name: /Review Data Quality/i });
    fireEvent.click(qualityTab);

    // Section 1: Provenance & Patient Isolation Guarantee
    expect(screen.getByText(/Health Data & Ingestion Quality Architecture/i)).toBeInTheDocument();
    expect(screen.getByText(/1\. Provenance Architecture & Five Ingestion Channels/i)).toBeInTheDocument();
    expect(screen.getByText(/Strict Personal Baseline Isolation Guarantee:/i)).toBeInTheDocument();
    expect(screen.getByText(/never merged into a real user's personal baseline corridor/i)).toBeInTheDocument();

    // Section 2: Clinical Corridor Reference Standards
    expect(screen.getByText(/2\. Configurable Plausibility Corridors & Medical Reference Sources/i)).toBeInTheDocument();
    expect(screen.getByText(/American Diabetes Association \(ADA\)/i)).toBeInTheDocument();
    expect(screen.getByText(/AHA Guidelines & ISO 81060-2/i)).toBeInTheDocument();

    // Section 3: Prediction Safeguards & Feature Readiness Inspector
    expect(screen.getByText(/3\. Pre-Inference Prediction Safeguards Inspector/i)).toBeInTheDocument();
    expect(screen.getByText(/Core Machine Learning Safeguard: Zero-Imputation Prohibition/i)).toBeInTheDocument();

    // Section 4: Clinical Disclaimer
    expect(screen.getByText(/Algorithmic Data Quality & Plausibility Disclaimer/i)).toBeInTheDocument();
    expect(screen.getByText(/Validation checks do not guarantee medical correctness/i)).toBeInTheDocument();
  });

  it('supports explicit unit selection including mmol/L and kPa with conversion guidance', async () => {
    render(
      <TwinProvider>
        <AddObservationPage />
      </TwinProvider>
    );

    // Select Fasting Blood Glucose
    const metricSelect = screen.getByLabelText(/Measurement Type/i);
    fireEvent.change(metricSelect, { target: { value: 'blood_glucose' } });

    // Verify unit selector has mg/dL and mmol/L
    expect(screen.getByText(/Auto-converts mmol\/L/i)).toBeInTheDocument();
    const unitSelect = screen.getByLabelText(/Unit/i);
    expect(unitSelect).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'mmol/L' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'mg/dL' })).toBeInTheDocument();

    // Select Systolic Blood Pressure
    fireEvent.change(metricSelect, { target: { value: 'systolic_blood_pressure' } });
    expect(screen.getByRole('option', { name: 'kPa' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'mmHg' })).toBeInTheDocument();
    expect(screen.getByText(/Auto-converts kPa/i)).toBeInTheDocument();
  });

  it('rejects values outside plausible bounds with a clear data-quality error message', async () => {
    render(
      <TwinProvider>
        <AddObservationPage />
      </TwinProvider>
    );

    // Wait for patient to load and be ready
    await waitFor(() => {
      expect(screen.getByText(/PT-1001/i)).toBeInTheDocument();
    });

    const valueInput = screen.getByPlaceholderText(/e\.g\. 68/i);
    // Resting heart rate bounds are 20 - 300 bpm
    fireEvent.change(valueInput, { target: { value: '999' } });

    const submitBtn = screen.getByRole('button', { name: /Save Observation/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/outside plausible physiological bounds/i)
      ).toBeInTheDocument();
    });
  });

  it('triggers suspicious value confirmation modal when a 409 unusual observation conflict is returned', async () => {
    // Mock addObservation throwing 409 Conflict
    const spy = vi.spyOn(api, 'addObservation').mockRejectedValueOnce({
      status: 409,
      data: {
        requires_confirmation: true,
        warnings: ['Resting Heart Rate of 175.0 bpm is unusually elevated compared to typical resting corridor (35-180 bpm).'],
        suggested_correction: 75
      },
      message: 'Unusual observation requires user confirmation'
    });

    render(
      <TwinProvider>
        <AddObservationPage />
      </TwinProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/PT-1001/i)).toBeInTheDocument();
    });

    const valueInput = screen.getByPlaceholderText(/e\.g\. 68/i);
    fireEvent.change(valueInput, { target: { value: '175' } });

    const submitBtn = screen.getByRole('button', { name: /Save Observation/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Unusual Health Measurement Detected/i)).toBeInTheDocument();
      expect(screen.getByText(/Confirmation Required Before Saving/i)).toBeInTheDocument();
      expect(screen.getByText(/Confirm & Record As Is/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Edit Measurement/i })).toBeInTheDocument();
      expect(screen.getByText(/Possible digit transposition detected\?/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Use 75/i })).toBeInTheDocument();
    });

    spy.mockRestore();
  });
});
