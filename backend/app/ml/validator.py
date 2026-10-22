"""
SwasthyaTwin ML Input & Dataset Validator
Provides strict validation for real research dataset files and production inference inputs.
Never allows silent corruption, unvalidated formats, or out-of-bounds telemetry.
"""

from typing import Dict, Any, List, Tuple, Optional
import os
import numpy as np
import pandas as pd

from app.ml.config import FEATURE_NAMES, RAW_STAGE_TO_CLASS, CLASS_NAMES

# Physiological boundaries for feature inputs
# Expected nocturnal physiological bounds for quality audits
FEATURE_BOUNDS = {
    "hr_mean": (40.0, 140.0, "bpm"),
    "hr_std": (0.0, 25.0, "bpm"),
    "hr_min": (35.0, 130.0, "bpm"),
    "hr_max": (45.0, 160.0, "bpm"),
    "hr_delta_baseline": (-30.0, 30.0, "bpm"),
    "hr_rolling_mean_5m": (40.0, 140.0, "bpm"),
    "hr_rolling_std_5m": (0.0, 25.0, "bpm"),
    "time_elapsed_minutes": (0.0, 960.0, "minutes")
}

class DatasetValidationError(Exception):
    """Raised when real research data does not conform to the expected scientific schema."""
    pass

class InputFeatureValidationError(Exception):
    """Raised when inference input data is malformed or invalid."""
    pass

def validate_raw_subject_files(subject_id: str, hr_path: str, label_path: str) -> Dict[str, Any]:
    """
    Validates the physical presence and scientific data format of a single PhysioNet subject.
    Returns parsed statistics or raises DatasetValidationError.
    """
    if not os.path.exists(hr_path) or os.path.getsize(hr_path) == 0:
        raise DatasetValidationError(f"Missing or empty heart rate file for subject {subject_id}: {hr_path}")
    if not os.path.exists(label_path) or os.path.getsize(label_path) == 0:
        raise DatasetValidationError(f"Missing or empty label file for subject {subject_id}: {label_path}")

    # Validate label lines
    label_count = 0
    valid_stages = set(RAW_STAGE_TO_CLASS.keys())
    with open(label_path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            if len(parts) != 2:
                raise DatasetValidationError(f"Invalid label line {line_num} in {label_path}: expected 2 tokens, got {len(parts)}")
            try:
                t_sec = float(parts[0])
                stage = int(parts[1])
            except ValueError as e:
                raise DatasetValidationError(f"Invalid numeric value on line {line_num} in {label_path}: {e}")
            if stage not in valid_stages:
                raise DatasetValidationError(f"Invalid sleep stage {stage} on line {line_num} in {label_path}. Expected one of {valid_stages}")
            label_count += 1

    if label_count < 100:
        raise DatasetValidationError(f"Insufficient epochs for subject {subject_id} ({label_count} < 100)")

    # Validate sample heart rate lines
    hr_count = 0
    with open(hr_path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            parts = line.split(",")
            if len(parts) != 2:
                raise DatasetValidationError(f"Invalid HR line {line_num} in {hr_path}: expected 'timestamp,bpm'")
            try:
                _ = float(parts[0])
                bpm = float(parts[1])
            except ValueError as e:
                raise DatasetValidationError(f"Invalid numeric HR on line {line_num} in {hr_path}: {e}")
            if bpm < 25.0 or bpm > 260.0:
                raise DatasetValidationError(f"Physiologically implausible HR {bpm} bpm on line {line_num} in {hr_path}")
            hr_count += 1

    return {
        "subject_id": subject_id,
        "epoch_count": label_count,
        "hr_samples_count": hr_count,
        "is_valid": True
    }

def validate_feature_dataframe(df: pd.DataFrame) -> Tuple[bool, List[str]]:
    """
    Validates engineered feature dataframe prior to training or batch evaluation.
    """
    issues = []
    required_cols = FEATURE_NAMES + ["subject_id", "label"]
    missing = [c for c in required_cols if c not in df.columns]
    if missing:
        issues.append(f"Missing required columns: {missing}")

    if df.empty:
        issues.append("Feature dataframe is empty.")
        return False, issues

    null_counts = df[FEATURE_NAMES].isnull().sum()
    if null_counts.any():
        bad_cols = null_counts[null_counts > 0].to_dict()
        issues.append(f"Found NaN values in features: {bad_cols}")

    # Check labels
    if "label" in df.columns:
        unique_labels = set(df["label"].unique())
        expected_labels = {0, 1, 2}
        if not unique_labels.issubset(expected_labels):
            issues.append(f"Found unexpected labels {unique_labels - expected_labels}")

    return len(issues) == 0, issues

def validate_inference_features(features: Dict[str, Any]) -> Tuple[bool, str, List[str], np.ndarray]:
    """
    Validates a single inference input payload against feature names and physiological bounds.
    Returns: (is_valid, status, warnings, feature_array)
    """
    warnings: List[str] = []
    vector: List[float] = []

    # 1. Check missing features
    missing = [f for f in FEATURE_NAMES if f not in features or features[f] is None]
    if missing:
        return False, "missing_features", [f"Missing required features: {missing}"], np.array([])

    # 2. Check bounds and types
    for feat in FEATURE_NAMES:
        val = features[feat]
        try:
            val_float = float(val)
        except (ValueError, TypeError):
            return False, "invalid_type", [f"Feature '{feat}' must be a numeric value, got '{val}'"], np.array([])

        if np.isnan(val_float) or np.isinf(val_float):
            return False, "nan_value", [f"Feature '{feat}' contains NaN or infinite value"], np.array([])

        if feat in FEATURE_BOUNDS:
            min_v, max_v, unit = FEATURE_BOUNDS[feat]
            if val_float < min_v or val_float > max_v:
                warnings.append(f"Feature '{feat}' value {val_float} {unit} is outside standard bounds ({min_v} to {max_v} {unit}).")

        vector.append(val_float)

    # Coherence checks: hr_max >= hr_min, hr_std >= 0
    if features.get("hr_max") is not None and features.get("hr_min") is not None:
        if float(features["hr_max"]) < float(features["hr_min"]):
            return False, "incoherent_values", ["hr_max cannot be smaller than hr_min"], np.array([])

    if features.get("hr_std") is not None and float(features["hr_std"]) < 0:
        return False, "incoherent_values", ["hr_std cannot be negative"], np.array([])

    status = "valid_with_warnings" if warnings else "valid"
    return True, status, warnings, np.array(vector, dtype=float).reshape(1, -1)
