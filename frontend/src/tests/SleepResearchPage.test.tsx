import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SleepResearchPage } from '../components/pages/SleepResearchPage';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
  api: {
    getSleepStageStatus: vi.fn(),
    getSleepStageEvaluation: vi.fn(),
    getResearchHypnogramSamples: vi.fn(),
    predictSleepStage: vi.fn(),
  }
}));

const mockStatus = {
  status: 'ready',
  model_name: 'BiDSleep Wearable Sleep-Stage Classifier',
  model_version: '1.0.0',
  features_count: 12,
  target_classes_5: ['Wake', 'N1', 'N2', 'N3', 'REM']
};

const mockSamples = {
  subject_id: 'Bidslab02',
  night_id: '1',
  sample_count: 2,
  epochs: [
    {
      sample_id: 'Bidslab02_N1_E0001',
      epoch_idx: 1,
      time_elapsed_minutes: 0.5,
      hr_mean: 62.0,
      hr_min: 58.0,
      hr_max: 66.0,
      hr_std: 1.8,
      hr_delta_baseline: 0.0,
      expert_label_5class: 'Wake',
      expert_label_3class: 'Wake',
      dreem_stage_id: 0,
      model_predicted_5class: 'Wake',
      model_predicted_3class: 'Wake',
      confidence_pct: 88.5
    },
    {
      sample_id: 'Bidslab02_N1_E0002',
      epoch_idx: 2,
      time_elapsed_minutes: 1.0,
      hr_mean: 55.0,
      hr_min: 52.0,
      hr_max: 58.0,
      hr_std: 0.9,
      hr_delta_baseline: -7.0,
      expert_label_5class: 'N3',
      expert_label_3class: 'NREM',
      dreem_stage_id: 3,
      model_predicted_5class: 'N3',
      model_predicted_3class: 'NREM',
      confidence_pct: 79.2
    }
  ]
};

const mockEval = {
  dataset_name: 'BiDSleep v1.0.1 (PhysioNet)',
  held_out_test_participants: ['Bidslab02'],
  held_out_test_epochs: 5280,
  metrics: {
    macro_f1: 0.2822,
    balanced_accuracy: 0.3470,
    overall_accuracy: 0.3623,
    cohens_kappa: 0.1989
  },
  baseline_comparison: {
    macro_f1_lift_over_baseline: 0.1869
  }
};

describe('SleepResearchPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.getSleepStageStatus as any).mockResolvedValue(mockStatus);
    (api.getResearchHypnogramSamples as any).mockResolvedValue(mockSamples);
    (api.getSleepStageEvaluation as any).mockResolvedValue(mockEval);
    (api.predictSleepStage as any).mockResolvedValue({
      predicted_stage_name: 'N3',
      predicted_stage_5class: 'N3',
      predicted_stage_3class: 'NREM',
      confidence_pct: 81.3,
      input_quality_status: 'VALID',
      model_version: '1.0.0',
      probabilities_5class: { Wake: 5.0, N1: 2.0, N2: 10.0, N3: 81.3, REM: 1.7 }
    });
  });

  it('renders research workspace title, AASM legend, and dual hypnogram tracks', async () => {
    render(<SleepResearchPage />);

    expect(screen.getByText(/Sleep Research Workspace & 5-Stage Hypnogram/i)).toBeInTheDocument();
    expect(screen.getByText(/PHYSIONET BIDSLEEP v1.0.1/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/TRACK 1 — EXPERT DREEM 2 EEG REFERENCE/i)).toBeInTheDocument();
      expect(screen.getByText(/TRACK 2 — SWASTHYATWIN ML PREDICTION/i)).toBeInTheDocument();
    });

    // Check AASM legend
    expect(screen.getByText(/Wake \(W\)/i)).toBeInTheDocument();
    expect(screen.getByText(/N3 \(Deep Slow-Wave\)/i)).toBeInTheDocument();
    expect(screen.getByText(/REM \(Dream Sleep\)/i)).toBeInTheDocument();
  });

  it('renders empirical evaluation summary and 5-class confusion matrix', async () => {
    render(<SleepResearchPage />);

    await waitFor(() => {
      expect(screen.getByText(/Empirical Model Evaluation & 5-Class Confusion Matrix/i)).toBeInTheDocument();
      expect(screen.getByText(/28.22%/i)).toBeInTheDocument(); // Macro F1
      expect(screen.getByText(/34.70%/i)).toBeInTheDocument(); // Balanced Acc
    });

    // Verify participant attribution
    expect(screen.getByText(/SUBJECT: Bidslab02/i)).toBeInTheDocument();
  });

  it('supports interactive sandbox inference including dropout / low PPG preset', async () => {
    render(<SleepResearchPage />);

    await waitFor(() => {
      expect(screen.getByText(/Live 30-Second Epoch Inference Engine/i)).toBeInTheDocument();
    });

    const deepPresetBtn = screen.getByText(/Deep N3 Preset/i);
    fireEvent.click(deepPresetBtn);

    const classifyBtn = screen.getByText(/Classify Sleep Stage via FastAPI/i);
    fireEvent.click(classifyBtn);

    await waitFor(() => {
      expect(api.predictSleepStage).toHaveBeenCalledWith(
        expect.objectContaining({
          hr_mean: 52.0,
          hr_std: 0.8,
          hr_delta_baseline: -8.0
        })
      );
    });

    // Test dropout preset
    const dropoutBtn = screen.getByText(/Dropout \/ Low PPG/i);
    fireEvent.click(dropoutBtn);
    fireEvent.click(classifyBtn);

    await waitFor(() => {
      expect(api.predictSleepStage).toHaveBeenCalledWith(
        expect.objectContaining({
          hr_valid_count: 0.5
        })
      );
    });
  });

  it('handles API loading and error states gracefully', async () => {
    (api.getResearchHypnogramSamples as any).mockRejectedValueOnce(new Error('Network connection timeout'));

    render(<SleepResearchPage />);

    await waitFor(() => {
      expect(screen.getByText(/Network connection timeout/i)).toBeInTheDocument();
    });
  });
});
