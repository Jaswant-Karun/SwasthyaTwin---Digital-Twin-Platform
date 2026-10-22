"""
SwasthyaTwin AI — Sleep Inference Service Unit Tests (Step 4)
Tests:
1. Reusable model loading and readiness verification.
2. Inadequate input gating (explicit Unknown outcome).
3. Payload schema validation and structured error handling.
4. Causal sequence prediction across multiple epochs without future leakage.
5. Evaluation summary path sanitization (zero local filesystem leaks).
"""

import os
import sys
import pytest

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend"))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.services.sleep_inference_service import (
    sleep_inference_service,
    ModelUnavailableError,
    IncompatibleFeatureSchemaError,
    sanitize_public_paths
)


def test_sleep_inference_service_readiness():
    """Verifies that the inference service loads the trained model artifact."""
    assert sleep_inference_service.is_ready is True
    assert sleep_inference_service.model_version == "1.0.0"

    status = sleep_inference_service.get_status()
    assert status["status"] == "ready"
    assert status["features_count"] == 12
    assert "BiDSleep" in status["model_name"]


def test_sleep_inference_valid_prediction():
    """Verifies single-epoch prediction with 5-class and 3-class outputs and probabilities."""
    features = {
        "hr_mean": 54.0,
        "hr_std": 1.2,
        "hr_median": 54.0,
        "hr_min": 51.0,
        "hr_max": 57.0,
        "hr_q25": 53.0,
        "hr_q75": 55.0,
        "hr_valid_count": 30.0,
        "hr_delta_baseline": -8.0,
        "hr_rolling_mean_5m": 54.5,
        "hr_rolling_std_5m": 1.1,
        "time_elapsed_minutes": 90.0
    }
    res = sleep_inference_service.predict_epoch(features, epoch_idx=180)
    assert res["predicted_stage_5class"] in ["Wake", "N1", "N2", "N3", "REM"]
    assert res["confidence_pct"] > 0
    assert "probabilities_5class" in res
    assert res["input_quality_status"] == "VALID"


def test_inadequate_input_returns_unknown():
    """
    Verifies that inadequate inputs (e.g. valid_count < 2.0)
    preserve an explicit 'Unknown' outcome instead of hallucinating or crashing.
    """
    inadequate_features = {
        "hr_mean": 54.0,
        "hr_std": 1.2,
        "hr_min": 51.0,
        "hr_max": 57.0,
        "hr_rolling_mean_5m": 54.5,
        "hr_valid_count": 0.5  # Inadequate valid PPG coverage
    }
    res = sleep_inference_service.predict_epoch(inadequate_features, epoch_idx=10)
    assert res["predicted_stage_5class"] == "Unknown"
    assert res["predicted_stage_id_5class"] == 5
    assert res["input_quality_status"] == "INSUFFICIENT_INPUT_DATA"
    assert res["confidence_pct"] == 0.0


def test_incompatible_schema_raises_structured_error():
    """Verifies that non-numeric or missing required features raise IncompatibleFeatureSchemaError."""
    with pytest.raises(IncompatibleFeatureSchemaError):
        sleep_inference_service.predict_epoch({
            "hr_mean": "not_a_number",
            "hr_min": 50.0,
            "hr_max": 60.0
        })


def test_predict_sequence_causality():
    """Verifies that sequence prediction processes epochs in chronological causal sequence."""
    sequence = [
        {
            "hr_mean": 60.0 - i,
            "hr_std": 1.5,
            "hr_min": 55.0 - i,
            "hr_max": 65.0 - i,
            "hr_rolling_mean_5m": 60.0 - i,
            "time_elapsed_minutes": i * 30.0,
            "epoch_index": i * 60
        }
        for i in range(4)
    ]
    res = sleep_inference_service.predict_sequence(sequence)
    assert res["session_total_epochs"] == 4
    assert res["causality_verified"] is True
    assert len(res["timeline"]) == 4
    for idx, item in enumerate(res["timeline"]):
        assert item["epoch_index"] == idx * 60


def test_path_sanitization():
    """Verifies that private local machine paths are stripped out of responses."""
    raw = {
        "model": "C:\\Users\\admin\\SwasthyaTwin\\models\\model.joblib",
        "plot": "reports/confusion_matrix.png",
        "nested": {
            "path": "/home/user/project/data.csv"
        }
    }
    sanitized = sanitize_public_paths(raw)
    assert sanitized["model"] == "model.joblib"
    assert sanitized["plot"] == "reports/confusion_matrix.png"
    assert sanitized["nested"]["path"] == "data.csv"


def test_label_mapping_integrity():
    """Verifies that 5-class AASM labels and 3-class groupings follow clinical standards."""
    from ml_pipeline.config import CLASS_NAMES_5, CLASS_NAMES_3, CLASS_3_MAP
    assert CLASS_NAMES_5 == ["Wake", "N1", "N2", "N3", "REM"]
    assert CLASS_NAMES_3 == {0: "Wake", 1: "NREM", 2: "REM"}

    # Wake -> Wake
    assert CLASS_3_MAP[0] == 0
    # N1, N2, N3 -> NREM
    assert CLASS_3_MAP[1] == 1
    assert CLASS_3_MAP[2] == 1
    assert CLASS_3_MAP[3] == 1
    # REM -> REM
    assert CLASS_3_MAP[4] == 2


def test_missing_model_raises_model_unavailable():
    """Verifies that an unready/missing model raises ModelUnavailableError."""
    from app.services.sleep_inference_service import SleepInferenceService
    class MockUnreadyPredictor:
        is_ready = False
        model_version = "0.0.0"

    unready_service = SleepInferenceService(predictor=MockUnreadyPredictor())
    assert unready_service.is_ready is False
    with pytest.raises(ModelUnavailableError):
        unready_service.predict_epoch({
            "hr_mean": 65.0,
            "hr_min": 60.0,
            "hr_max": 70.0,
            "hr_rolling_mean_5m": 65.0
        })


def test_extreme_heart_rate_bounds_warning():
    """Verifies that heart rate outside [30, 240 bpm] generates a structured warning."""
    feat = {
        "hr_mean": 235.0,
        "hr_min": 220.0,
        "hr_max": 240.0,
        "hr_rolling_mean_5m": 230.0,
        "hr_valid_count": 6.0
    }
    validated, warnings = sleep_inference_service.validate_features_payload(feat)
    assert len(warnings) > 0
    assert any("Extreme heart rate" in w for w in warnings)
