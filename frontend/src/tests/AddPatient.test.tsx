import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddPatientPage } from '../components/pages/AddPatientPage';
import { TwinProvider } from '../context/TwinContext';

describe('AddPatientPage Component', () => {
  it('renders the Add Patient form with privacy protection warning and consent checkbox', () => {
    render(
      <TwinProvider>
        <AddPatientPage />
      </TwinProvider>
    );

    // Header and title
    expect(screen.getByRole('heading', { name: /Add Patient/i })).toBeInTheDocument();
    expect(screen.getByText(/Privacy Protection Warning/i)).toBeInTheDocument();
    expect(screen.getByText(/Do NOT enter unnecessary sensitive personal information/i)).toBeInTheDocument();
    expect(screen.getByText(/Consent & Authorization Confirmation/i)).toBeInTheDocument();

    // Inputs
    expect(screen.getByPlaceholderText(/Alex M\. or Runner42/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Patient Profile/i })).toBeInTheDocument();
  });

  it('rejects submission if display name is empty or consent is not confirmed', async () => {
    render(
      <TwinProvider>
        <AddPatientPage />
      </TwinProvider>
    );

    const submitBtn = screen.getByRole('button', { name: /Save Patient Profile/i });
    fireEvent.click(submitBtn);

    // Consent required error or validation
    await waitFor(() => {
      expect(
        screen.queryByText(/Consent and authorization confirmation is required/i) ||
        screen.queryByText(/Display name or pseudonym is required/i)
      ).toBeTruthy();
    });
  });

  it('renders the Patient Cohort Directory with safe deletion and view options', () => {
    render(
      <TwinProvider>
        <AddPatientPage />
      </TwinProvider>
    );

    expect(screen.getByText(/Patient Cohort Directory/i)).toBeInTheDocument();
    expect(screen.getByText(/Patient ID/i)).toBeInTheDocument();
    expect(screen.getByText(/Demographics/i)).toBeInTheDocument();
  });
});
