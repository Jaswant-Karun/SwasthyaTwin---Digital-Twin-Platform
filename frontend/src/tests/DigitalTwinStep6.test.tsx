import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SpatialHumanTwin } from '../components/spatial/SpatialHumanTwin';
import { SpatialTimelineInspector } from '../components/spatial/SpatialTimelineInspector';
import { DigitalTwinPage } from '../components/pages/DigitalTwinPage';
import { TwinProvider } from '../context/TwinContext';
import { Patient, DigitalTwinState } from '../types';
import { MOCK_PATIENTS, MOCK_TWIN_STATE } from '../services/mockData';
import { api } from '../services/api';

// Mock API calls to return reliable data
vi.mock('../services/api', () => ({
  api: {
    getActiveLayers: vi.fn().mockResolvedValue({
      layers: {
        cardiovascular: { is_active: true, observation_count: 30, label: 'Cardiovascular' },
        sleep: { is_active: true, observation_count: 28, label: 'Sleep' },
        blood_pressure: { is_active: true, observation_count: 24, label: 'Blood Pressure' },
        activity: { is_active: true, observation_count: 30, label: 'Activity' }
      }
    }),
    getHealthModules: vi.fn().mockResolvedValue({
      modules: {
        cardiovascular_trends: {
          latest_hr_bpm: 68,
          baseline_median_bpm: 68,
          relative_deviation_pct: 0.0,
          z_score: 0.0,
          disclaimer: 'Longitudinal resting HR trends; does not diagnose arrhythmias.'
        },
        sleep_intelligence: {
          latest_duration_hours: 7.5,
          baseline_median_hours: 7.5,
          sleep_regularity_score: 88,
          disclaimer: 'Wearable optical PPG sleep staging; does not measure EEG.'
        }
      }
    }),
    getObservations: vi.fn().mockResolvedValue({
      items: [
        {
          _id: 'obs_1',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          metric_type: 'heart_rate',
          value: 68,
          unit: 'bpm',
          source: 'Apple Watch Series 9',
          data_tier: 'measured'
        },
        {
          _id: 'obs_2',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          metric_type: 'heart_rate',
          value: 70,
          unit: 'bpm',
          source: 'Apple Watch Series 9',
          data_tier: 'measured'
        },
        {
          _id: 'obs_3',
          timestamp: new Date(Date.now() - 10800000).toISOString(),
          metric_type: 'heart_rate',
          value: 66,
          unit: 'bpm',
          source: 'Apple Watch Series 9',
          data_tier: 'measured'
        }
      ]
    }),
    predictPatientTrends: vi.fn().mockResolvedValue({
      forecasts: {
        heart_rate: {
          prediction_trajectory: [
            {
              date: new Date(Date.now() + 86400000).toISOString(),
              predicted_value: 69.2,
              confidence_lower: 65.0,
              confidence_upper: 73.0
            }
          ]
        }
      }
    }),
    getMultiSignalTimeline: vi.fn().mockResolvedValue({
      patient_id: 'PT-1001',
      patient_name: 'Aarav Mehta',
      generated_at: new Date().toISOString(),
      total_items: 2,
      filter_applied: 'all',
      summary: {},
      items: [
        {
          id: 'sig_sleep_1',
          signal_type: 'sleep_stage_prediction',
          signal_category: 'BiDSleep Wearable Sleep ML',
          signal_badge: 'BiDSLEEP ML',
          data_provenance: 'model_predicted',
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          title: 'Stage N3 (Deep Sleep) Inferred',
          summary: 'LightGBM 5-class AASM classifier assigned 84% probability to Slow-Wave Stage N3.',
          status_level: 'deep_sleep',
          status_label: 'Deep Sleep',
          primary_metric: 'sleep_stage',
          primary_value: 'N3',
          primary_unit: 'stage',
          sleep_details: {
            stage_5class: 'N3',
            stage_3class: 'NREM',
            stage_display_name: 'Stage N3 (Deep Slow-Wave Sleep)',
            confidence_pct: 84.0,
            probabilities: { Wake: 0.02, N1: 0.04, N2: 0.10, N3: 0.84, REM: 0.0 },
            model_name: 'BiDSleep LightGBM 5-Stage AASM v1.0.0',
            model_architecture: 'Gradient Boosted Trees (LightGBM)',
            inference_source: 'Apple Watch Optical PPG Heart Rate Dynamics',
            ppg_features: { hr_mean: 58.2, hr_rolling_mean_5m: 57.8 }
          },
          disclaimer: 'Probabilistic machine learning sleep staging inference; does not replace EEG polysomnography.'
        },
        {
          id: 'sig_cardio_1',
          signal_type: 'heart_rate_statistical_flag',
          signal_category: 'Cardiovascular Anomaly Intelligence',
          signal_badge: 'nMAD STATS',
          data_provenance: 'derived',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          title: 'Elevated Resting Pulse Deviation',
          summary: 'Heart rate reading of 88 bpm diverged from 30-day baseline median by +3.2σ nMAD.',
          status_level: 'elevated',
          status_label: 'Elevated',
          primary_metric: 'heart_rate',
          primary_value: 88,
          primary_unit: 'bpm',
          cardiovascular_details: {
            measured_heart_rate: 88.0,
            unit: 'bpm',
            baseline_median: 68.0,
            baseline_unit: 'bpm',
            variability_measure: 'nMAD',
            variability_value: 4.2,
            upper_corridor: 76.5,
            lower_corridor: 59.5,
            robust_score: 3.2,
            anomaly_status: 'unusual_high',
            algorithm_version: 'v1.2.0-robust-mad',
            sample_count: 30,
            window_days: 30
          },
          disclaimer: 'Statistical anomaly detection distinguishes numeric shifts from medical pathology.'
        }
      ]
    }),
    getPatients: vi.fn().mockResolvedValue(MOCK_PATIENTS),
    getPatient: vi.fn().mockImplementation((id: string) => {
      const found = MOCK_PATIENTS.find(p => p.patient_id === id);
      return Promise.resolve(found || MOCK_PATIENTS[0]);
    }),
    getTwinState: vi.fn().mockResolvedValue(MOCK_TWIN_STATE),
    getHealth: vi.fn().mockResolvedValue({ status: 'healthy', version: '1.0.0' }),
    getReadiness: vi.fn().mockResolvedValue({ ready: true, ping_ms: 1 }),
    getPatientAssessment: vi.fn().mockResolvedValue(null),
    getAlerts: vi.fn().mockResolvedValue([]),
    getPatientExplanations: vi.fn().mockResolvedValue(null)
  }
}));

describe('Step 6: Interactive Spatial Human Digital Twin', () => {
  const patient = MOCK_PATIENTS[0]; // Aarav Mehta PT-1001
  const twinState = MOCK_TWIN_STATE;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. SpatialHumanTwin Central Visualization & Grounded Subsystems', () => {
    it('renders the central holographic silhouette and non-diagnostic locator disclosure', () => {
      render(
        <TwinProvider>
          <SpatialHumanTwin
            patient={patient}
            twinState={twinState}
            selectedNodeId="cardiovascular"
            onSelectNode={vi.fn()}
            activeLayer="all"
            onLayerChange={vi.fn()}
          />
        </TwinProvider>
      );

      // Verify the non-diagnostic locator notice is prominently displayed (Requirement 5)
      expect(screen.getByText(/LOCATOR NOTICE/i)).toBeInTheDocument();
      expect(screen.getByText(/Schematic Vector Topology/i)).toBeInTheDocument();
      expect(screen.getByText(/Not a clinical medical scan/i)).toBeInTheDocument();

      // Verify human silhouette SVG container exists
      const region = screen.getByRole('region', { name: /Interactive Human Digital Twin/i });
      expect(region).toBeInTheDocument();
    });

    it('renders all 6 grounded anatomical subsystems linked only to supported data', () => {
      render(
        <TwinProvider>
          <SpatialHumanTwin
            patient={patient}
            twinState={twinState}
            selectedNodeId="cardiovascular"
            onSelectNode={vi.fn()}
            activeLayer="all"
            onLayerChange={vi.fn()}
          />
        </TwinProvider>
      );

      // All 6 subsystems must exist and be clearly named
      expect(screen.getByText('Cardiovascular Dynamics')).toBeInTheDocument();
      expect(screen.getByText('Sleep & Autonomic Core')).toBeInTheDocument();
      expect(screen.getByText('Hemodynamic Arterial Pressure')).toBeInTheDocument();
      expect(screen.getByText('Respiratory Dynamics')).toBeInTheDocument();
      expect(screen.getByText('Glycemic Regulation')).toBeInTheDocument();
      expect(screen.getByText('Kinetic & Locomotor Ambulation')).toBeInTheDocument();
    });

    it('displays deep-dive telemetry with formula, algorithm version, and limitations when selected', () => {
      const handleSelect = vi.fn();
      render(
        <TwinProvider>
          <SpatialHumanTwin
            patient={patient}
            twinState={twinState}
            selectedNodeId="cardiovascular"
            onSelectNode={handleSelect}
            activeLayer="all"
            onLayerChange={vi.fn()}
          />
        </TwinProvider>
      );

      // Verify cardiovascular deep dive
      expect(screen.getByText(/Signal Deep-Dive Inspector/i)).toBeInTheDocument();
      expect(screen.getByText(/Tukey's IQR Fences/i)).toBeInTheDocument();
      expect(screen.getByText(/v1.2.0-robust-mad/i)).toBeInTheDocument();
      expect(screen.getByText(/CLINICAL GUARDRAILS & LIMITATIONS/i)).toBeInTheDocument();
      expect(screen.getByText(/Measures wearable optical pulse rate; does not diagnose arrhythmias/i)).toBeInTheDocument();
    });

    it('invokes onSelectNode when a subsystem node or button is clicked', () => {
      const handleSelect = vi.fn();
      render(
        <TwinProvider>
          <SpatialHumanTwin
            patient={patient}
            twinState={twinState}
            selectedNodeId="cardiovascular"
            onSelectNode={handleSelect}
            activeLayer="all"
            onLayerChange={vi.fn()}
          />
        </TwinProvider>
      );

      const sleepBtn = screen.getByText('Sleep & Autonomic Core');
      fireEvent.click(sleepBtn);
      expect(handleSelect).toHaveBeenCalledWith('sleep');
    });

    it('supports rapid hotkey navigation (keys 1-6)', () => {
      const handleSelect = vi.fn();
      render(
        <TwinProvider>
          <SpatialHumanTwin
            patient={patient}
            twinState={twinState}
            selectedNodeId="cardiovascular"
            onSelectNode={handleSelect}
            activeLayer="all"
            onLayerChange={vi.fn()}
          />
        </TwinProvider>
      );

      // Press hotkey '2' for Sleep
      fireEvent.keyDown(window, { key: '2' });
      expect(handleSelect).toHaveBeenCalledWith('sleep');

      // Press hotkey '3' for Blood Pressure
      fireEvent.keyDown(window, { key: '3' });
      expect(handleSelect).toHaveBeenCalledWith('blood_pressure');
    });
  });

  describe('2. Interactive Health Timeline & Multi-Signal Event Explanations', () => {
    it('renders the longitudinal area chart with lookback windows and metric options', () => {
      render(
        <TwinProvider>
          <SpatialTimelineInspector
            patient={patient}
            twinState={twinState}
            selectedMetric="heart_rate"
            onMetricChange={vi.fn()}
            timelineDays={30}
            onTimelineDaysChange={vi.fn()}
          />
        </TwinProvider>
      );

      expect(screen.getByText(/Longitudinal Signal Corridor & AI Projection/i)).toBeInTheDocument();
      expect(screen.getByText('Observed Telemetry')).toBeInTheDocument();
      expect(screen.getByText('AI Projected Trajectory')).toBeInTheDocument();
      expect(screen.getByText(/Personal Baseline Corridor/i)).toBeInTheDocument();
      expect(screen.getByText('14D')).toBeInTheDocument();
      expect(screen.getByText('30D')).toBeInTheDocument();
      expect(screen.getByText('90D')).toBeInTheDocument();
    });

    it('renders multi-signal timeline events with provenance badges (MEASURED, MODEL PREDICTED, DERIVED)', async () => {
      render(
        <TwinProvider>
          <SpatialTimelineInspector
            patient={patient}
            twinState={twinState}
            selectedMetric="heart_rate"
            onMetricChange={vi.fn()}
            timelineDays={30}
            onTimelineDaysChange={vi.fn()}
          />
        </TwinProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Stage N3 (Deep Sleep) Inferred')).toBeInTheDocument();
        expect(screen.getByText('Elevated Resting Pulse Deviation')).toBeInTheDocument();
      });

      // Verify Provenance Badges
      expect(screen.getByText('MODEL PREDICTED')).toBeInTheDocument();
      expect(screen.getByText('DERIVED')).toBeInTheDocument();
    });

    it('opens detailed mathematical explanation panel when a timeline event is clicked', async () => {
      render(
        <TwinProvider>
          <SpatialTimelineInspector
            patient={patient}
            twinState={twinState}
            selectedMetric="heart_rate"
            onMetricChange={vi.fn()}
            timelineDays={30}
            onTimelineDaysChange={vi.fn()}
          />
        </TwinProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Stage N3 (Deep Sleep) Inferred')).toBeInTheDocument();
      });

      // Click the sleep ML event
      const sleepCard = screen.getByText('Stage N3 (Deep Sleep) Inferred');
      fireEvent.click(sleepCard);

      // Verify Explanation Panel opens with model details and formula breakdown
      await waitFor(() => {
        expect(screen.getByText(/AUDIT EVENT ID: sig_sleep_1/i)).toBeInTheDocument();
        expect(screen.getByText(/BiDSleep 5-Stage AASM Softmax Probabilities/i)).toBeInTheDocument();
        expect(screen.getByText(/BiDSleep LightGBM 5-Stage AASM v1.0.0/i)).toBeInTheDocument();
        expect(screen.getByText(/Clinical & Algorithmic Limitations/i)).toBeInTheDocument();
      });

      // Close explanation panel via button
      const closeBtn = screen.getByText('Close Explanation');
      fireEvent.click(closeBtn);

      await waitFor(() => {
        expect(screen.queryByText(/AUDIT EVENT ID: sig_sleep_1/i)).not.toBeInTheDocument();
      });
    });

    it('triggers body node highlighting when hovering over a timeline event', async () => {
      const handleHighlight = vi.fn();
      render(
        <TwinProvider>
          <SpatialTimelineInspector
            patient={patient}
            twinState={twinState}
            selectedMetric="heart_rate"
            onMetricChange={vi.fn()}
            timelineDays={30}
            onTimelineDaysChange={vi.fn()}
            onHighlightBodyNode={handleHighlight}
          />
        </TwinProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Stage N3 (Deep Sleep) Inferred')).toBeInTheDocument();
      });

      const sleepCard = screen.getByText('Stage N3 (Deep Sleep) Inferred');
      fireEvent.mouseEnter(sleepCard);
      expect(handleHighlight).toHaveBeenCalledWith('sleep');

      fireEvent.mouseLeave(sleepCard);
      expect(handleHighlight).toHaveBeenCalledWith(null);
    });
  });

  describe('3. Patient Switching & Full Experience Coordination', () => {
    it('renders patient switcher dropdown in DigitalTwinPage and displays cohort members', async () => {
      render(
        <TwinProvider>
          <DigitalTwinPage />
        </TwinProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Autonomous Spatial Digital Twin/i)).toBeInTheDocument();
      });

      // Check patient switcher select element
      const select = screen.getByLabelText(/Select Patient Cohort/i);
      expect(select).toBeInTheDocument();
      expect(select).toHaveValue('PT-1001');

      // Change patient to PT-1002 (Priya Sharma)
      fireEvent.change(select, { target: { value: 'PT-1002' } });

      await waitFor(() => {
        expect(api.getPatient).toHaveBeenCalledWith('PT-1002');
      });
    });

    it('verifies absence of invented organ scores or disease probabilities', () => {
      const { container } = render(
        <TwinProvider>
          <SpatialHumanTwin
            patient={patient}
            twinState={twinState}
            selectedNodeId="cardiovascular"
            onSelectNode={vi.fn()}
            activeLayer="all"
            onLayerChange={vi.fn()}
          />
        </TwinProvider>
      );

      // Verify no fabricated terms like "Organ Health: 84%", "Kidney Score", "Heart Attack Probability"
      expect(container.textContent).not.toMatch(/Kidney Score/i);
      expect(container.textContent).not.toMatch(/Liver Health/i);
      expect(container.textContent).not.toMatch(/Disease Probability/i);
      expect(container.textContent).not.toMatch(/Organ Health Score/i);

      // Verify true measured/derived terminology is present
      expect(screen.getByText(/Personal Baseline Corridor/i)).toBeInTheDocument();
      expect(screen.getByText(/Zero Zero-Imputation/i)).toBeInTheDocument();
    });
  });
});
