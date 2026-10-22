import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MLStudioPage } from '../components/pages/MLStudioPage';
import { TwinProvider } from '../context/TwinContext';
import { api } from '../services/api';

const mockManifest = {
  version: '2.4.0-ml-ensemble',
  trained_at: '2026-10-22T19:00:00Z',
  training_duration_seconds: 3.42,
  dataset_summary: {
    total_samples: 2500,
    train_samples: 2000,
    test_samples: 500,
    features_count: 12,
    feature_names: ['heart_rate', 'systolic_bp', 'hrv_rmssd']
  },
  classification_metrics: {
    algorithm: 'RandomForestClassifier(n_estimators=100)',
    test_accuracy: 84.2,
    test_precision: 84.5,
    test_recall: 84.2,
    test_f1_score: 84.1,
    roc_auc_ovr: 94.8,
    cross_validation_5fold: {
      fold_scores: [85.0, 83.5, 84.2, 86.1, 82.2],
      mean_score: 84.2,
      std_score: 1.3
    },
    confusion_matrix: [
      [180, 20, 5],
      [15, 150, 10],
      [3, 8, 109]
    ],
    class_labels: ['Low Risk (Resilient)', 'Moderate Drift', 'Elevated Strain']
  },
  baseline_comparison: {
    algorithm: 'LogisticRegression',
    test_accuracy: 74.0,
    test_f1_score: 73.5,
    accuracy_improvement_pct: 10.2
  },
  regression_metrics: {
    algorithm: 'GradientBoostingRegressor',
    mae: 1.72,
    rmse: 2.11,
    r2_score: 0.924,
    target: '14-Day Vitality Delta'
  },
  unsupervised_phenotypes: {
    algorithm: 'KMeans(k=4)',
    clusters: [
      {
        cluster_id: 0,
        name: 'High-Vagal Resilient',
        archetype: 'Parasympathetic Dominant',
        summary: 'Robust HRV and restorative sleep.',
        color: '#10b981',
        profile: {
          heart_rate: 68.5,
          systolic_bp: 118.0,
          diastolic_bp: 76.0,
          pulse_pressure: 42.0,
          hrv_rmssd: 85.0,
          sleep_duration: 7.8,
          daily_steps: 8500
        }
      }
    ]
  },
  dimensionality_reduction: {
    algorithm: 'PCA(n_components=2)',
    explained_variance_ratio: [28.2, 16.4],
    total_explained_variance_pct: 44.6,
    sample_scatter_points: [
      { x: 0.5, y: -0.2, cluster: 0, risk_class: 0 }
    ]
  },
  feature_importance: [
    { feature: 'hrv_rmssd', display_name: 'HRV RMSSD', importance_pct: 18.5 },
    { feature: 'systolic_bp', display_name: 'Systolic BP', importance_pct: 14.2 }
  ]
};

describe('MLStudioPage Component', () => {
  it('renders ML Studio page, title, and key model evaluation metrics', async () => {
    vi.spyOn(api, 'getMLModelInfo').mockResolvedValue(mockManifest as any);

    render(
      <TwinProvider>
        <MLStudioPage />
      </TwinProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Machine Learning Training & Phenotype Studio/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Test Set Accuracy/i)).toBeInTheDocument();
    expect(screen.getByText(/Multi-Class ROC-AUC/i)).toBeInTheDocument();
    expect(screen.getByText(/Weighted F1-Score/i)).toBeInTheDocument();
    expect(screen.getByText(/Trajectory Regressor \(R²\)/i)).toBeInTheDocument();
  });

  it('allows switching between ML concept tabs', async () => {
    vi.spyOn(api, 'getMLModelInfo').mockResolvedValue(mockManifest as any);

    render(
      <TwinProvider>
        <MLStudioPage />
      </TwinProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Machine Learning Training & Phenotype Studio/i)).toBeInTheDocument();
    });

    // Unsupervised tab
    const unsuperTab = screen.getByRole('button', { name: /Unsupervised Phenotyping & PCA/i });
    fireEvent.click(unsuperTab);

    expect(screen.getByText(/2D Principal Component Analysis/i)).toBeInTheDocument();
    expect(screen.getByText(/Discovered Latent Phenotypes/i)).toBeInTheDocument();

    // Feature Engineering tab
    const featTab = screen.getByRole('button', { name: /Feature Engineering & Importance/i });
    fireEvent.click(featTab);

    expect(screen.getByText(/Domain Feature Engineering Rationale/i)).toBeInTheDocument();
    expect(screen.getByText(/Mean Arterial Pressure \(MAP\)/i)).toBeInTheDocument();
  });
});
