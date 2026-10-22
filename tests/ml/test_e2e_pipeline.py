"""
End-to-End Integration Tests for BiDSleep Machine Learning Pipeline.
Tests model artifact loading, input sanitization, inference integrity, and zero leakage verification.
"""

import os
import json
import numpy as np
import pytest

from ml_pipeline.config import (
    MODEL_ARTIFACT_PATH,
    MODEL_METADATA_PATH,
    MODEL_EVALUATION_PATH,
    SPLIT_MANIFEST_PATH,
    CORE_FEATURE_COLUMNS,
    SLEEP_STAGE_MAP
)
from ml_pipeline.predict import SleepStagePredictor


def test_model_artifact_exists_and_loads():
    """Confirms model artifact exists and predictor reports is_ready."""
    predictor = SleepStagePredictor(model_path=MODEL_ARTIFACT_PATH, metadata_path=MODEL_METADATA_PATH)
    assert os.path.exists(MODEL_ARTIFACT_PATH)
    assert predictor.is_ready is True
    assert predictor.model_version == "1.0.0"


def test_predictor_valid_inference():
    """Runs inference on a valid 30s epoch feature vector and checks output schema."""
    predictor = SleepStagePredictor()
    valid_features = {
        "hr_mean": 60.0,
        "hr_std": 1.5,
        "hr_median": 60.0,
        "hr_min": 58.0,
        "hr_max": 63.0,
        "hr_q25": 59.0,
        "hr_q75": 61.0,
        "hr_valid_count": 6.0,
        "hr_delta_baseline": 0.0,
        "hr_rolling_mean_5m": 60.0,
        "hr_rolling_std_5m": 1.2,
        "time_elapsed_minutes": 100.0
    }

    result = predictor.predict_epoch(valid_features, epoch_idx=100)
    assert result["predicted_stage_id"] in [0, 1, 2, 3, 4]
    assert result["predicted_stage_name"] in ["Wake", "N1", "N2", "N3", "REM"]
    assert 0.0 <= result["confidence"] <= 1.0
    assert result["is_trained_model"] is True
    assert result["is_demo_fixture"] is False
    assert result["quality_status"] == "VALID"
    assert len(result["probabilities"]) == 5


def test_predictor_rejects_missing_features():
    """Verifies that predictor raises ValueError when required features are omitted."""
    predictor = SleepStagePredictor()
    incomplete_features = {
        "hr_mean": 60.0,
        "hr_std": 1.5
        # Missing other required features
    }

    with pytest.raises(ValueError, match="Missing required feature"):
        predictor.predict_epoch(incomplete_features)


def test_predictor_rejects_nan_and_inf():
    """Verifies that predictor raises ValueError when NaN or Inf are provided."""
    predictor = SleepStagePredictor()
    nan_features = {col: 60.0 for col in CORE_FEATURE_COLUMNS}
    nan_features["hr_mean"] = float("nan")

    with pytest.raises(ValueError, match="Invalid non-finite value"):
        predictor.predict_epoch(nan_features)

    inf_features = {col: 60.0 for col in CORE_FEATURE_COLUMNS}
    inf_features["hr_mean"] = float("inf")

    with pytest.raises(ValueError, match="Invalid non-finite value"):
        predictor.predict_epoch(inf_features)


def test_split_manifest_zero_participant_leakage():
    """Audits the split manifest to ensure 100% disjoint participant sets."""
    assert os.path.exists(SPLIT_MANIFEST_PATH)
    with open(SPLIT_MANIFEST_PATH, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    train_subs = set(manifest["splits"]["train"]["participants"])
    val_subs = set(manifest["splits"]["validation"]["participants"])
    test_subs = set(manifest["splits"]["test"]["participants"])

    assert len(train_subs.intersection(val_subs)) == 0
    assert len(train_subs.intersection(test_subs)) == 0
    assert len(val_subs.intersection(test_subs)) == 0
    assert manifest["leakage_audit"]["status"] == "PASSED_ZERO_LEAKAGE"


def test_model_evaluation_metrics_validity():
    """Audits the evaluation JSON report for valid non-hardcoded held-out test metrics."""
    assert os.path.exists(MODEL_EVALUATION_PATH)
    with open(MODEL_EVALUATION_PATH, "r", encoding="utf-8") as f:
        report = json.load(f)

    metrics = report["metrics"]
    assert 0.0 < metrics["macro_f1"] < 1.0
    assert 0.0 < metrics["balanced_accuracy"] < 1.0
    assert 0.0 < metrics["overall_accuracy"] < 1.0

    # Ensure lift over majority baseline is recorded
    lift = report["baseline_comparison"]["macro_f1_lift_over_baseline"]
    assert lift > 0.0

    # Per-class performance checks
    per_class = report["per_class_performance"]
    assert len(per_class) == 5
    stage_names = [p["stage_name"] for p in per_class]
    assert set(stage_names) == {"Wake", "N1", "N2", "N3", "REM"}
