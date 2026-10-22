"""
Unit tests for sleep dataset validation.
Tests physiological boundary checking, label integrity, unknown exclusion, and feature hygiene.
"""

import numpy as np
import pandas as pd
import pytest

from ml_pipeline.dataset_validation import (
    validate_heart_rate_series,
    validate_polysomnography_labels,
    validate_feature_matrix,
    DatasetValidationError
)
from ml_pipeline.config import CORE_FEATURE_COLUMNS


def test_validate_heart_rate_series_valid():
    """Tests typical physiological range for sleeping adults."""
    normal_hr = np.array([55.0, 60.0, 58.0, 62.0, 59.0])
    res = validate_heart_rate_series(normal_hr)
    assert res["valid"] is True
    assert res["min_hr"] == 55.0
    assert res["max_hr"] == 62.0
    assert len(res["warnings"]) == 0


def test_validate_heart_rate_series_warnings():
    """Detects extreme bradycardia or tachycardia."""
    extreme_hr = np.array([25.0, 60.0, 230.0])
    res = validate_heart_rate_series(extreme_hr)
    assert res["valid"] is True
    assert len(res["warnings"]) == 2  # < 30 and > 220


def test_validate_polysomnography_labels_unknown_exclusion():
    """Confirms that Unknown label (5) is properly isolated and excluded."""
    # 0=Wake, 1=N1, 2=N2, 3=N3, 4=REM, 5=Unknown
    labels = np.array([0, 1, 2, 3, 4, 5, 2, 5])
    valid_mask, report = validate_polysomnography_labels(labels, exclude_unknown=True)

    assert report["total_epochs"] == 8
    assert report["unknown_epochs_excluded"] == 2
    assert report["valid_supervised_epochs"] == 6
    assert list(valid_mask) == [True, True, True, True, True, False, True, False]


def test_validate_polysomnography_labels_invalid_code():
    """Rejects illegal sleep stage codes (e.g. 9 or negative)."""
    bad_labels = np.array([0, 1, 9, 2])
    with pytest.raises(DatasetValidationError):
        validate_polysomnography_labels(bad_labels)


def test_validate_feature_matrix_nan_inf_detection():
    """Rejects feature tables containing NaN or infinite values."""
    # Build complete dataframe with one NaN
    data = {col: [1.0, 2.0] for col in CORE_FEATURE_COLUMNS}
    data["hr_mean"][1] = np.nan
    df = pd.DataFrame(data)

    res = validate_feature_matrix(df, CORE_FEATURE_COLUMNS)
    assert res["valid"] is False
    assert "cols_with_nan" in res
    assert "hr_mean" in res["cols_with_nan"]
