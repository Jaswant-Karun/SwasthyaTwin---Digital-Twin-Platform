import React from 'react';
import { describe, it, expect } from 'vitest';
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
    expect(screen.getByText(/Only non-identifying clinical and lifestyle observations/i)).toBeInTheDocument();
    expect(screen.getByText(/Consent & Authorization Confirmation/i)).toBeInTheDocument();

    // Inputs
    expect(screen.getByPlaceholderText(/Alex M\. or Runner42/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Patient Profile/i })).toBeInTheDocument();
  });

  it('rejects submission if consent is not confirmed', async () => {
    render(
      <TwinProvider>
        <AddPatientPage />
      </TwinProvider>
    );

    const nameInput = screen.getByPlaceholderText(/Alex M\. or Runner42/i);
    fireEvent.change(nameInput, { target: { value: 'Jane Doe' } });

    const submitBtn = screen.getByRole('button', { name: /Save Patient Profile/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Consent and authorization confirmation is required/i)
      ).toBeInTheDocument();
    });
  });

  it('renders the Patient Cohort Directory with safe deletion and view options', () => {
    render(
      <TwinProvider>
        <AddPatientPage />
      </TwinProvider>
    );

    expect(screen.getByText(/Patient Cohort Directory/i)).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Patient ID/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Demographics/i })).toBeInTheDocument();
  });
});
