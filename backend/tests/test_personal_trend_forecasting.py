import pytest
from datetime import datetime, timedelta, timezone
import numpy as np

from app.analytics.predictor import (
    train_and_forecast_metric,
    forecast_metric_with_safeguards,
    SUPPORTED_TARGET_METRICS,
    UNSUPPORTED_TARGET_METRICS
)
from app.analytics.health_modules import FutureTrendForecastingModule

# ==============================================================================
# 1. Target Justification & Unsupported Target Gating
# ==============================================================================

def test_unsupported_targets_rejected_safely():
    """Verify that clinical and ungrounded targets (BP, disease onset) are strictly rejected."""
    base_time = datetime(2026, 10, 1, tzinfo=timezone.utc)
    obs = [
        {"measurement_type": "blood_pressure_systolic", "value": 120.0 + i, "observed_at": base_time + timedelta(days=i)}
        for i in range(25)
    ]
    # 1. train_and_forecast_metric returns None
    result = train_and_forecast_metric("blood_pressure_systolic", "mmHg", obs, horizon_days=7)
    assert result is None

    # 2. forecast_metric_with_safeguards returns unsupported_metric status
    safe_result = forecast_metric_with_safeguards("blood_pressure_systolic", "mmHg", obs, horizon_days=7)
    assert safe_result["status"] == "unsupported_metric"
    assert safe_result["prediction"] is None
    assert any("not supported" in w.lower() for w in safe_result["warnings"])

    # 3. FutureTrendForecastingModule returns unsupported_metric status
    summary = FutureTrendForecastingModule.forecast("PT-TEST", "blood_pressure_systolic", "mmHg", obs, horizon_days=7)
    assert summary.forecast_status == "unsupported_metric"


def test_supported_targets_adhere_to_schema():
    """Verify daily_steps and sleep_duration_hours are in supported targets registry."""
    assert "daily_steps" in SUPPORTED_TARGET_METRICS
    assert "sleep_duration_hours" in SUPPORTED_TARGET_METRICS
    assert "heart_rate" in SUPPORTED_TARGET_METRICS


# ==============================================================================
# 2. Chronological Splitting & Temporal Leakage Prevention
# ==============================================================================

def test_chronological_holdout_prevents_leakage():
    """Verify that test window future data does not leak into training fit or baseline values."""
    base_time = datetime(2026, 8, 1, tzinfo=timezone.utc)
    # Generate 30 days of daily steps: 23 days of ~8000 steps, then 7 days spike to ~20000 steps
    obs = []
    for i in range(23):
        obs.append({
            "measurement_type": "daily_steps",
            "value": 8000.0,
            "observed_at": base_time + timedelta(days=i)
        })
    for i in range(23, 30):
        obs.append({
            "measurement_type": "daily_steps",
            "value": 20000.0,  # Huge future spike in test window
            "observed_at": base_time + timedelta(days=i)
        })

    # Shuffled input order must not affect chronological sorting
    import random
    shuffled_obs = list(obs)
    random.seed(42)
    random.shuffle(shuffled_obs)

    result = train_and_forecast_metric("daily_steps", "steps", shuffled_obs, horizon_days=7)
    assert result is not None

    # Baseline persistence must be EXACTLY the last value of the training set (8000.0), NOT 20000.0
    # Because test window has 7 points (all 20000.0), persistence error against 8000.0 should be |20000 - 8000| = 12000.0
    assert result.evaluation_metrics.baseline_mae == pytest.approx(12000.0, abs=1.0)
    assert result.evaluation_metrics.rolling_7d_mae == pytest.approx(12000.0, abs=1.0)


# ==============================================================================
# 3. Minimum History & Missing Days Handling
# ==============================================================================

def test_insufficient_history_gate():
    """Verify that < 14 unique chronological observations refuses forecast."""
    base_time = datetime(2026, 10, 1, tzinfo=timezone.utc)
    obs = [
        {"measurement_type": "daily_steps", "value": 7500.0, "observed_at": base_time + timedelta(days=i)}
        for i in range(12)  # Only 12 observations
    ]

    res = forecast_metric_with_safeguards("daily_steps", "steps", obs, horizon_days=7)
    assert res["status"] == "insufficient_features"
    assert res["prediction"] is None
    assert any("minimum required is 14" in w for w in res["warnings"])


def test_missing_days_do_not_zero_impute():
    """Verify that sparse days are not fabricated as 0.0 steps."""
    base_time = datetime(2026, 9, 1, tzinfo=timezone.utc)
    # 20 observations spread across 40 days (missing alternate days)
    obs = [
        {"measurement_type": "daily_steps", "value": 8500.0 + (i * 50), "observed_at": base_time + timedelta(days=i * 2)}
        for i in range(20)
    ]

    result = train_and_forecast_metric("daily_steps", "steps", obs, horizon_days=7)
    assert result is not None
    # Future forecasts must not drop towards 0
    for pt in result.prediction_trajectory:
        assert pt.predicted_value > 5000.0


# ==============================================================================
# 4. Multi-Baseline Comparison & Acceptance Criteria
# ==============================================================================

def test_baseline_comparison_and_acceptance_flag():
    """Verify that both Naive Persistence and Rolling 7-day baselines are reported and acceptance flagged."""
    base_time = datetime(2026, 8, 1, tzinfo=timezone.utc)
    # Generate realistic steady sleep data with subtle drift
    obs = [
        {"measurement_type": "sleep_duration_hours", "value": 7.2 + 0.1 * np.sin(i / 3.0), "observed_at": base_time + timedelta(days=i)}
        for i in range(30)
    ]

    result = train_and_forecast_metric("sleep_duration_hours", "hours", obs, horizon_days=7)
    assert result is not None
    evals = result.evaluation_metrics
    assert evals.baseline_mae >= 0.0
    assert evals.rolling_7d_mae is not None
    assert evals.evaluation_window_days == 7
    assert evals.acceptance_status in ["passed", "experimental"]
    assert len(evals.acceptance_reason) > 0


# ==============================================================================
# 5. Outlier Rejection & Physiological Boundaries
# ==============================================================================

def test_outlier_rejection_safeguard():
    """Verify that corrupted observations outside human bounds abort forecasting."""
    base_time = datetime(2026, 10, 1, tzinfo=timezone.utc)
    obs = [
        {"measurement_type": "daily_steps", "value": 8000.0, "observed_at": base_time + timedelta(days=i)}
        for i in range(20)
    ]
    # Inject impossible physiological outlier (e.g., 500,000 steps in one day)
    obs[5]["value"] = 500000.0

    res = forecast_metric_with_safeguards("daily_steps", "steps", obs, horizon_days=7)
    assert res["status"] == "input_quality_rejection"
    assert res["prediction"] is None
    assert any("physiological bounds" in w for w in res["warnings"])
