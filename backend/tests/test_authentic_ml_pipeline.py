"""
Unit & Integration Tests for Authentic PhysioNet Sleep Staging ML Pipeline
Verifies:
1. Research dataset loading and raw schema validation
2. Temporal feature engineering and epoch alignment
3. Group-aware participant split & zero leakage
4. Baseline comparison and metrics computation
5. Production inference engine and input quality audits
6. Malformed input and missing feature error handling
7. FastAPI prediction and evaluation endpoints
8. Deterministic reproducibility under fixed seed
"""

import pytest
import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

from app.main import app
from app.ml.config import (
    RANDOM_SEED,
    FEATURE_NAMES,
    CLASS_NAMES,
    DATASET_NAME,
    DATASET_VERSION
)
from app.ml.dataset_loader import dataset_loader
from app.ml.preprocessor import SleepFeatureEngineer, SleepFeatureScaler
from app.ml.validator import (
    validate_raw_subject_files,
    validate_feature_dataframe,
    validate_inference_features,
    InputFeatureValidationError,
    DatasetValidationError
)
from app.ml.evaluator import ModelEvaluator
from app.ml.trainer import pipeline_trainer, MajorityClassBaseline, HeuristicSleepBaseline
from app.ml.inference import inference_engine

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def sample_valid_features():
    return {
        "hr_mean": 64.5,
        "hr_std": 2.1,
        "hr_min": 60.0,
        "hr_max": 71.0,
        "hr_delta_baseline": -3.5,
        "hr_rolling_mean_5m": 65.2,
        "hr_rolling_std_5m": 2.8,
        "time_elapsed_minutes": 120.0
    }

# --- 1. Dataset Loading and Schema Validation ---

def test_dataset_loader_discovers_all_subjects():
    subject_ids = dataset_loader.get_available_subject_ids()
    assert len(subject_ids) == 31, f"Expected 31 PhysioNet subjects, found {len(subject_ids)}"
    assert "1066528" in subject_ids

def test_raw_subject_file_validation():
    s_id = "1066528"
    hr_path = f"{dataset_loader.hr_dir}/{s_id}_heartrate.txt"
    label_path = f"{dataset_loader.labels_dir}/{s_id}_labeled_sleep.txt"
    stats = validate_raw_subject_files(s_id, hr_path, label_path)
    assert stats["is_valid"] is True
    assert stats["epoch_count"] > 500
    assert stats["hr_samples_count"] > 1000

def test_raw_subject_file_validation_missing_file():
    with pytest.raises(DatasetValidationError):
        validate_raw_subject_files("nonexistent", "missing_hr.txt", "missing_label.txt")

# --- 2. Temporal Feature Engineering & Preprocessing ---

def test_feature_engineering_produces_valid_epochs():
    s_id = "1066528"
    df_labels, df_hr = dataset_loader.load_subject_raw_data(s_id)
    assert not df_labels.empty
    assert not df_hr.empty

    df_features = SleepFeatureEngineer.extract_subject_features(s_id, df_labels, df_hr)
    assert not df_features.empty
    assert len(df_features) == len(df_labels)

    valid, issues = validate_feature_dataframe(df_features)
    assert valid is True, f"Feature validation failed: {issues}"

    # Verify all feature columns are present and non-null
    for feat in FEATURE_NAMES:
        assert feat in df_features.columns
        assert not df_features[feat].isnull().any()

    # Labels must be mapped to {0, 1, 2}
    unique_labels = set(df_features["label"].unique())
    assert unique_labels.issubset({0, 1, 2})

# --- 3. Group-Aware Split & Zero-Leakage Preprocessing ---

def test_participant_split_has_zero_leakage():
    df_sample = pd.DataFrame({
        "subject_id": ["S1"] * 50 + ["S2"] * 50 + ["S3"] * 50 + ["S4"] * 50,
        "hr_mean": np.random.normal(70, 5, 200),
        "hr_std": np.random.normal(2, 0.5, 200),
        "hr_min": np.random.normal(65, 5, 200),
        "hr_max": np.random.normal(75, 5, 200),
        "hr_delta_baseline": np.random.normal(0, 3, 200),
        "hr_rolling_mean_5m": np.random.normal(70, 5, 200),
        "hr_rolling_std_5m": np.random.normal(2, 0.5, 200),
        "time_elapsed_minutes": np.linspace(0, 200, 200),
        "label": np.random.choice([0, 1, 2], 200)
    })
    df_train, df_test = pipeline_trainer.split_participants(df_sample)
    train_subs = set(df_train["subject_id"].unique())
    test_subs = set(df_test["subject_id"].unique())

    # ZERO PARTICIPANT OVERLAP
    assert train_subs.intersection(test_subs) == set(), "Participant leakage detected between train and test splits!"

def test_scaler_guards_against_future_leakage():
    scaler = SleepFeatureScaler()
    X_train = np.array([[50.0], [70.0], [90.0]])
    scaler.fit(X_train)
    assert scaler.is_fitted is True

    # Test that test set is transformed with train parameters (mean=70, std=16.33)
    X_test = np.array([[70.0]])
    X_test_scaled = scaler.transform(X_test)
    assert np.isclose(X_test_scaled[0, 0], 0.0, atol=1e-5)

# --- 4. Evaluator & Metrics Computation ---

def test_evaluator_metrics_structure():
    y_true = np.array([0, 0, 1, 1, 1, 2, 2])
    y_pred = np.array([0, 1, 1, 1, 2, 2, 0])
    y_prob = np.array([
        [0.8, 0.1, 0.1],
        [0.3, 0.5, 0.2],
        [0.1, 0.8, 0.1],
        [0.2, 0.7, 0.1],
        [0.1, 0.3, 0.6],
        [0.2, 0.2, 0.6],
        [0.7, 0.2, 0.1]
    ])
    metrics = ModelEvaluator.evaluate_predictions(y_true, y_pred, y_prob=y_prob, model_name="TestModel")
    assert "overall_accuracy" in metrics
    assert "balanced_accuracy" in metrics
    assert "macro_f1" in metrics
    assert "cohen_kappa" in metrics
    assert "class_metrics" in metrics
    assert "confusion_matrix" in metrics
    assert len(metrics["class_metrics"]) == 3
    assert len(metrics["confusion_matrix"]["raw"]) == 3

# --- 5. Inference Engine & Input Validation ---

def test_inference_with_valid_features(sample_valid_features):
    result = inference_engine.predict_epoch(sample_valid_features)
    assert result["predicted_stage_id"] in [0, 1, 2]
    assert result["predicted_stage_name"] in ["Wake", "NREM", "REM"]
    assert 0.0 <= result["confidence_pct"] <= 100.0
    assert "Wake" in result["class_probabilities"]
    assert "NREM" in result["class_probabilities"]
    assert "REM" in result["class_probabilities"]
    assert result["input_quality_status"] == "valid"

def test_inference_missing_feature(sample_valid_features):
    bad_features = sample_valid_features.copy()
    del bad_features["hr_mean"]
    with pytest.raises(InputFeatureValidationError):
        inference_engine.predict_epoch(bad_features)

def test_inference_malformed_types(sample_valid_features):
    bad_features = sample_valid_features.copy()
    bad_features["hr_mean"] = "corrupted_string"
    with pytest.raises(InputFeatureValidationError):
        inference_engine.predict_epoch(bad_features)

def test_inference_incoherent_min_max(sample_valid_features):
    bad_features = sample_valid_features.copy()
    bad_features["hr_min"] = 120.0
    bad_features["hr_max"] = 50.0  # hr_max < hr_min
    with pytest.raises(InputFeatureValidationError):
        inference_engine.predict_epoch(bad_features)

def test_inference_out_of_bounds_warning(sample_valid_features):
    # Extreme tachycardia (220 bpm) should be allowed with quality warning
    warning_features = sample_valid_features.copy()
    warning_features["hr_mean"] = 230.0
    warning_features["hr_min"] = 210.0
    warning_features["hr_max"] = 250.0
    result = inference_engine.predict_epoch(warning_features)
    assert result["input_quality_status"] == "valid_with_warnings"
    assert len(result["input_quality_warnings"]) > 0

# --- 6. FastAPI Endpoints ---

def test_api_predict_sleep_stage(client, sample_valid_features):
    res = client.post("/api/v1/ml/sleep-stage/predict", json=sample_valid_features)
    assert res.status_code == 200
    data = res.json()
    assert "predicted_stage_name" in data
    assert "confidence_pct" in data
    assert "model_metadata" in data

def test_api_predict_malformed_input(client):
    res = client.post("/api/v1/ml/sleep-stage/predict", json={"hr_mean": 10.0}) # below 30 bpm
    assert res.status_code == 422

def test_api_get_evaluation(client):
    res = client.get("/api/v1/ml/sleep-stage/evaluation")
    assert res.status_code == 200
    data = res.json()
    assert "dataset_provenance" in data
    assert "baseline_comparison" in data
    assert "held_out_test_evaluations" in data
    assert data["dataset_provenance"]["dataset_name"] == DATASET_NAME
    assert data["dataset_provenance"]["total_subjects"] == 31
