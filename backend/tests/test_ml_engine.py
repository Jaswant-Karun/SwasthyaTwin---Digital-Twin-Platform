"""
Tests for SwasthyaTwin Machine Learning Health Intelligence Engine:
1. Multi-variate Biological Plausibility & Typo Guard
2. Production-trained Random Forest & Gradient Boosting health risk predictions
3. Unsupervised K-Means Phenotyping and PCA latent coordinates
4. Model Training Pipeline & Artifact persistence
5. Optical rPPG bio-scanner processing
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.analytics.ml_health_engine import ml_health_engine
from app.analytics.ml_trainer import ml_trainer

client = TestClient(app)

def test_ml_plausibility_guard_detects_impossible_typo():
    # 700 bpm is physically impossible
    result = ml_health_engine.validate_input_plausibility(
        measurement_type="heart_rate",
        value=700.0,
        unit="bpm"
    )
    assert result["is_plausible"] is False
    assert result["plausibility_score"] == 0.0
    assert result["confidence_weight"] == 0.0
    assert len(result["warnings"]) > 0
    assert result["suggested_value"] == 70.0  # Detects trailing zero typo

def test_ml_plausibility_guard_detects_reversed_blood_pressure():
    # Systolic cannot be <= Diastolic
    result = ml_health_engine.validate_input_plausibility(
        measurement_type="systolic_bp",
        value=75.0,
        unit="mmHg",
        paired_measurements={"diastolic_bp": 85.0}
    )
    assert result["is_plausible"] is False
    assert result["confidence_weight"] == 0.0
    assert any("cannot be less than or equal" in w for w in result["warnings"])

def test_ml_plausibility_guard_passes_normal_values():
    result = ml_health_engine.validate_input_plausibility(
        measurement_type="heart_rate",
        value=72.0,
        unit="bpm",
        existing_baseline_mean=70.0,
        existing_baseline_std=5.0
    )
    assert result["is_plausible"] is True
    assert result["plausibility_score"] >= 90.0
    assert result["confidence_weight"] == 1.0
    assert len(result["warnings"]) == 0

def test_ml_health_trajectory_prediction():
    metrics = {
        "heart_rate": 68.0,
        "systolic_bp": 118.0,
        "diastolic_bp": 76.0,
        "hrv_rmssd": 58.0,
        "sleep_duration": 8.0,
        "daily_steps": 9200.0
    }
    prediction = ml_health_engine.predict_health_trajectory(current_metrics=metrics, age=35)
    assert "predicted_risk_tier" in prediction
    assert "risk_probabilities" in prediction
    assert "predicted_14d_vitality_delta" in prediction
    assert "health_phenotype" in prediction
    assert len(prediction["top_driving_factors"]) >= 3
    assert "radar_scores" in prediction
    assert "pca_coordinates" in prediction
    assert "engineered_features" in prediction
    assert prediction["pca_coordinates"]["x"] is not None
    assert prediction["pca_coordinates"]["y"] is not None

def test_ai_optical_scan_processing():
    scan_telemetry = {
        "heart_rate": 72.0,
        "hrv_rmssd": 52.0,
        "respiratory_rate": 16.0,
        "signal_quality_pct": 95.0
    }
    scan_res = ml_health_engine.process_ai_optical_scan("PT-TEST", scan_telemetry)
    assert scan_res["is_valid"] is True
    assert scan_res["overall_credibility_score"] > 85.0
    assert scan_res["extracted_biometrics"]["heart_rate"]["valid"] is True
    assert scan_res["ml_prediction"]["health_phenotype"] is not None

def test_ml_trainer_execution_and_metrics():
    report = ml_trainer.train_and_evaluate(n_samples=300, test_size=0.20, random_state=42)
    assert "classification_metrics" in report
    assert "regression_metrics" in report
    assert "unsupervised_phenotypes" in report
    assert "dimensionality_reduction" in report
    assert "feature_importance" in report

    clf = report["classification_metrics"]
    assert clf["test_accuracy"] > 60.0
    assert len(clf["cross_validation_5fold"]["fold_scores"]) == 5
    assert len(report["unsupervised_phenotypes"]["clusters"]) == 4
    assert len(report["feature_importance"]) == 12

def test_ml_api_endpoints():
    # 1. Test model-info endpoint
    info_res = client.get("/api/v1/ml/model-info")
    assert info_res.status_code == 200
    info_data = info_res.json()
    assert "classification_metrics" in info_data
    assert "feature_importance" in info_data

    # 2. Test train endpoint
    train_res = client.post("/api/v1/ml/train", json={"n_samples": 400, "test_size": 0.25, "random_state": 42})
    assert train_res.status_code == 200
    train_data = train_res.json()
    assert train_data["classification_metrics"]["test_accuracy"] > 50.0
