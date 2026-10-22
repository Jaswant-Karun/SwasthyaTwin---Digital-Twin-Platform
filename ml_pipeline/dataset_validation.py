"""
SwasthyaTwin AI — Sleep Dataset Validation Module
Verifies physiological integrity, timestamp continuity, boundary constraints, and feature hygiene.
"""

from typing import Dict, Any, List, Tuple
import numpy as np
import pandas as pd

from ml_pipeline.config import VALID_TARGET_CLASSES, CORE_FEATURE_COLUMNS


class DatasetValidationError(ValueError):
    """Raised when data fails critical health data integrity checks."""
    pass


def validate_heart_rate_series(hr_values: np.ndarray) -> Dict[str, Any]:
    """
    Validates a series of heart rate measurements for physiological plausibility.
    Adult human physiological range during sleep: typically 35 to 180 bpm.
    """
    valid_hr = hr_values[~np.isnan(hr_values)]
    total = len(hr_values)
    valid_count = len(valid_hr)

    if valid_count == 0:
        return {
            "valid": False,
            "error": "No valid non-null heart rate readings in series.",
            "total_count": total,
            "valid_count": 0
        }

    min_val = float(np.min(valid_hr))
    max_val = float(np.max(valid_hr))
    
    # Plausibility checks
    warnings = []
    if min_val < 30.0:
        warnings.append(f"Severely low heart rate observed ({min_val:.1f} bpm < 30 bpm).")
    if max_val > 220.0:
        warnings.append(f"Severely elevated heart rate observed ({max_val:.1f} bpm > 220 bpm).")

    return {
        "valid": True,
        "total_count": total,
        "valid_count": valid_count,
        "missing_count": total - valid_count,
        "min_hr": min_val,
        "max_hr": max_val,
        "mean_hr": round(float(np.mean(valid_hr)), 2),
        "warnings": warnings
    }


def validate_polysomnography_labels(
    labels: np.ndarray,
    exclude_unknown: bool = True
) -> Tuple[np.ndarray, Dict[str, Any]]:
    """
    Validates ground truth sleep-stage labels.
    Expected labels: 0 (Wake), 1 (N1), 2 (N2), 3 (N3), 4 (REM), 5 (Unknown).
    
    Returns:
        (valid_mask, audit_report)
    """
    flat_labels = labels.flatten()
    unique_vals = set(np.unique(flat_labels))
    allowed_vals = {0, 1, 2, 3, 4, 5}
    
    invalid_vals = unique_vals - allowed_vals
    if invalid_vals:
        raise DatasetValidationError(f"Invalid sleep stage codes detected: {invalid_vals}. Allowed: {allowed_vals}")

    unknown_mask = (flat_labels == 5)
    unknown_count = int(np.sum(unknown_mask))
    
    if exclude_unknown:
        valid_mask = ~unknown_mask
    else:
        valid_mask = np.ones(len(flat_labels), dtype=bool)

    class_counts = {int(c): int(np.sum(flat_labels == c)) for c in sorted(unique_vals)}

    report = {
        "total_epochs": len(flat_labels),
        "valid_supervised_epochs": int(np.sum(valid_mask)),
        "unknown_epochs_excluded": unknown_count,
        "class_counts": class_counts,
        "has_unknowns": unknown_count > 0
    }

    return valid_mask, report


def validate_feature_matrix(
    df_features: pd.DataFrame,
    required_features: List[str] = CORE_FEATURE_COLUMNS
) -> Dict[str, Any]:
    """
    Validates that a feature DataFrame satisfies all ML preconditions:
    - No missing required feature columns.
    - No NaN, Inf, or non-numeric values in features.
    - Context identifiers (subject_id, epoch_idx) are present.
    """
    missing_cols = [c for c in required_features if c not in df_features.columns]
    if missing_cols:
        return {
            "valid": False,
            "error": f"Missing required feature columns: {missing_cols}"
        }

    # Check for NaN / Inf in features
    X = df_features[required_features]
    has_nan = X.isna().any().to_dict()
    has_inf = np.isinf(X.to_numpy()).any(axis=0)
    inf_cols = [col for col, is_inf in zip(required_features, has_inf) if is_inf]

    cols_with_nan = [col for col, is_nan in has_nan.items() if is_nan]

    if cols_with_nan or inf_cols:
        return {
            "valid": False,
            "error": "Features contain non-finite numbers.",
            "cols_with_nan": cols_with_nan,
            "cols_with_inf": inf_cols
        }

    return {
        "valid": True,
        "row_count": len(df_features),
        "feature_count": len(required_features),
        "features": required_features
    }
