"""
Unit tests for sleep feature extraction.
Tests statistical formulas, causal rolling features, and missing signal handling.
"""

import numpy as np
import pandas as pd
import pytest

from ml_pipeline.feature_extraction import (
    extract_epoch_hr_features,
    extract_epoch_motion_features,
    compute_night_epoch_features
)
from ml_pipeline.config import CORE_FEATURE_COLUMNS


def test_extract_epoch_hr_features_calculations():
    """Validates mathematical correctness of epoch HR statistics."""
    # 5 samples: 60, 62, 64, 66, 68
    samples = np.array([60.0, 62.0, 64.0, 66.0, 68.0])
    baseline = 60.0
    elapsed = 15.0

    feat = extract_epoch_hr_features(samples, baseline_hr=baseline, time_elapsed_min=elapsed)

    assert feat["hr_mean"] == pytest.approx(64.0)
    assert feat["hr_median"] == pytest.approx(64.0)
    assert feat["hr_min"] == pytest.approx(60.0)
    assert feat["hr_max"] == pytest.approx(68.0)
    assert feat["hr_valid_count"] == 5.0
    assert feat["hr_delta_baseline"] == pytest.approx(4.0)  # 64 - 60
    assert feat["time_elapsed_minutes"] == pytest.approx(15.0)
    assert feat["hr_std"] > 0.0


def test_extract_epoch_hr_features_missing_data():
    """Verifies that an empty epoch uses baseline rather than 0.0."""
    empty_samples = np.array([])
    feat = extract_epoch_hr_features(empty_samples, baseline_hr=58.0, time_elapsed_min=10.0)

    # Must NOT be 0.0
    assert feat["hr_mean"] == pytest.approx(58.0)
    assert feat["hr_valid_count"] == 0.0
    assert feat["hr_delta_baseline"] == pytest.approx(0.0)


def test_extract_epoch_motion_features():
    """Tests accelerometry Euclidean magnitude and standard deviation."""
    acc_x = np.array([0.0, 0.0])
    acc_y = np.array([0.0, 0.0])
    acc_z = np.array([1.0, 1.0])  # 1g static gravity on z-axis

    m_feat = extract_epoch_motion_features(acc_x, acc_y, acc_z)
    assert m_feat["acc_mag_mean"] == pytest.approx(1.0)
    assert m_feat["acc_mag_std"] == pytest.approx(0.0)  # Static position
    assert m_feat["acc_mag_max"] == pytest.approx(1.0)


def test_compute_night_epoch_features_causality():
    """
    Verifies that backward-looking rolling features do not use future information.
    """
    total_epochs = 12
    # Create synthetic HR data: constant 60 bpm for epochs 1-10, spike to 100 at epoch 11
    hr_data = []
    for ep in range(1, 11):
        hr_data.append({"epoch_idx": ep, "hr": 60.0})
    hr_data.append({"epoch_idx": 11, "hr": 100.0})
    hr_data.append({"epoch_idx": 12, "hr": 100.0})

    df_hr = pd.DataFrame(hr_data)
    features = compute_night_epoch_features(df_hr, total_epochs=total_epochs)

    # Epoch 10 must NOT reflect the spike in epoch 11 (strict causal hygiene)
    assert features.loc[features["epoch_idx"] == 10, "hr_mean"].values[0] == pytest.approx(60.0)
    assert features.loc[features["epoch_idx"] == 10, "hr_rolling_mean_5m"].values[0] == pytest.approx(60.0)

    # Epoch 11 reflects the spike
    assert features.loc[features["epoch_idx"] == 11, "hr_mean"].values[0] == pytest.approx(100.0)
    # Rolling mean for epoch 11 must be between 60 and 100
    rolling_11 = features.loc[features["epoch_idx"] == 11, "hr_rolling_mean_5m"].values[0]
    assert 60.0 < rolling_11 < 100.0
