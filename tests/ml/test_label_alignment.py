"""
Unit tests for timestamp and epoch label alignment in BiDSleep ML pipeline.
Uses small isolated synthetic fixtures for algorithmic verification.
"""

import math
import numpy as np
import pandas as pd
import pytest

from ml_pipeline.label_alignment import (
    parse_rec_start_to_unix,
    timestamp_to_epoch_index,
    epoch_index_to_time_interval,
    align_sensor_telemetry
)


def test_parse_rec_start_eastern_time():
    """Verifies that recStart in U.S. Eastern Time converts correctly to UTC Unix timestamp."""
    # '2021-12-02 23:11:25' in America/New_York (UTC-5 during standard time)
    # Expected UTC: 2021-12-03 04:11:25 UTC -> 1638504685.0
    rec_str = "2021-12-02 23:11:25"
    unix_ts = parse_rec_start_to_unix(rec_str)
    assert isinstance(unix_ts, float)
    assert unix_ts == 1638504685.0

    # Also test numpy string array format from scipy.io.loadmat
    np_arr = np.array([rec_str])
    assert parse_rec_start_to_unix(np_arr) == 1638504685.0


def test_timestamp_to_epoch_index_formula():
    """Tests k = floor((t - recStart)/30) + 1."""
    rec_start = 1000.0

    # Exactly at rec_start -> epoch 1
    assert timestamp_to_epoch_index(1000.0, rec_start) == 1
    # 29.9s after rec_start -> epoch 1
    assert timestamp_to_epoch_index(1029.9, rec_start) == 1
    # Exactly at 30.0s after rec_start -> epoch 2
    assert timestamp_to_epoch_index(1030.0, rec_start) == 2
    # 59.9s -> epoch 2
    assert timestamp_to_epoch_index(1059.9, rec_start) == 2
    # 60.0s -> epoch 3
    assert timestamp_to_epoch_index(1060.0, rec_start) == 3

    # Before rec_start -> epoch <= 0
    assert timestamp_to_epoch_index(999.0, rec_start) <= 0


def test_epoch_interval_bounds():
    """Verifies start and end times for epoch k."""
    rec_start = 1000.0
    start, end = epoch_index_to_time_interval(1, rec_start, 30.0)
    assert start == 1000.0
    assert end == 1030.0

    start_5, end_5 = epoch_index_to_time_interval(5, rec_start, 30.0)
    assert start_5 == 1120.0
    assert end_5 == 1150.0


def test_align_sensor_telemetry_synthetic():
    """Tests boundary filtering, duplicate dropping, and epoch index mapping."""
    rec_start = 1000.0
    total_epochs = 3  # Valid timestamps: [1000.0, 1090.0)

    # Synthetic readings
    df = pd.DataFrame({
        "timestamp": [
            980.0,   # Pre-session (epoch 0, should be dropped)
            1005.0,  # Epoch 1
            1005.0,  # Duplicate timestamp (should be dropped)
            1020.0,  # Epoch 1
            1035.0,  # Epoch 2
            1085.0,  # Epoch 3
            1100.0   # Post-session (epoch 4, should be dropped)
        ],
        "hr": [70, 65, 65, 64, 62, 60, 58]
    })

    aligned = align_sensor_telemetry(df, rec_start, total_epochs)

    assert len(aligned) == 4  # 980 dropped, 1005 duplicate dropped, 1100 dropped
    assert list(aligned["epoch_idx"]) == [1, 1, 2, 3]
    assert all(aligned["epoch_idx"] >= 1)
    assert all(aligned["epoch_idx"] <= total_epochs)
