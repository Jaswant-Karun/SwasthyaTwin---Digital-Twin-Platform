import math
import numpy as np
from datetime import datetime, timedelta, timezone
import pytest

from app.analytics.baseline_calculator import compute_metric_baseline, compute_all_baselines
from app.analytics.deviation_analyzer import (
    analyze_measurement_deviation,
    calculate_absolute_deviation,
    calculate_relative_deviation,
    is_relative_deviation_meaningful
)
from app.analytics.rule_engine import evaluate_demonstration_rules
from app.analytics.twin_simulation_engine import run_twin_simulation
from app.models.simulation import InterventionParams

def test_known_numerical_example():
    """
    Known Numerical Example:
    Observations: [70, 72, 71, 73, 74] bpm
    Median: Median(70, 71, 72, 73, 74) = 72 bpm
    New Reading: 84 bpm
    Absolute Deviation: 84 - 72 = 12 bpm
    Relative Deviation: (84 - 72) / 72 * 100 = 16.666...% -> 16.7%
    """
    now = datetime.now(timezone.utc)
    values = [70.0, 72.0, 71.0, 73.0, 74.0]
    timestamps = [now - timedelta(days=5 - i) for i in range(5)]

    baseline = compute_metric_baseline(
        metric_type="heart_rate",
        unit="bpm",
        values=values,
        timestamps=timestamps,
        window_days=30,
        min_observations=3
    )

    assert baseline is not None
    assert baseline.median == 72.0
    assert baseline.sample_count == 5
    assert baseline.is_sufficient is True
    assert baseline.calculated_at is not None

    # New reading: 84 bpm
    new_obs = {
        "observation_id": "obs_test_84",
        "measurement_type": "heart_rate",
        "value": 84.0,
        "unit": "bpm",
        "observed_at": now
    }

    dev = analyze_measurement_deviation(
        patient_id="patient_demo_01",
        metric_type="heart_rate",
        current_obs=new_obs,
        baseline=baseline
    )

    assert dev.current_value == 84.0
    assert dev.personal_baseline == 72.0
    assert dev.delta_absolute == 12.0
    assert dev.absolute_deviation == 12.0
    assert dev.relative_deviation_percent == 16.7
    assert dev.relative_deviation_meaningful is True
    assert "12.0 bpm" in dev.explanation
    assert "+16.7%" in dev.explanation

def test_insufficient_observations():
    """
    Verifies that fewer observations than min_observations sets is_sufficient=False,
    and rolling trend returns 'insufficient_data'.
    """
    now = datetime.now(timezone.utc)
    values = [70.0, 72.0]  # Only 2 observations
    timestamps = [now - timedelta(days=2), now - timedelta(days=1)]

    baseline = compute_metric_baseline(
        metric_type="heart_rate",
        unit="bpm",
        values=values,
        timestamps=timestamps,
        window_days=30,
        min_observations=3
    )

    assert baseline is not None
    assert baseline.is_sufficient is False
    assert baseline.sample_count == 2

    # Deviation analysis with sparse data
    new_obs = {"value": 75.0, "unit": "bpm", "observed_at": now}
    dev = analyze_measurement_deviation(
        patient_id="patient_sparse",
        metric_type="heart_rate",
        current_obs=new_obs,
        baseline=baseline,
        recent_history=[new_obs]  # only 1 point in recent history
    )
    assert dev.data_quality["is_sufficient"] is False
    assert dev.trend_direction == "insufficient_data"

def test_zero_baseline_handling():
    """
    Verifies that zero baselines do not cause ZeroDivisionError,
    and relative percentage deviation is properly flagged as meaningless/None.
    """
    meaningful, reason = is_relative_deviation_meaningful("daily_steps", 0.0)
    assert meaningful is False
    assert "zero" in reason.lower()

    rel_pct, is_mean, note = calculate_relative_deviation(500.0, 0.0, "daily_steps")
    assert rel_pct is None
    assert is_mean is False
    assert note is not None

def test_missing_and_invalid_values_handling():
    """
    Verifies that missing (None), NaN, or corrupted values in observations are
    filtered out and NEVER treated as zero.
    """
    now = datetime.now(timezone.utc)
    values = [70.0, None, float("nan"), "invalid_string", 72.0, 74.0]
    timestamps = [now - timedelta(days=i) for i in range(len(values))]

    baseline = compute_metric_baseline(
        metric_type="heart_rate",
        unit="bpm",
        values=values,
        timestamps=timestamps,
        window_days=30,
        min_observations=3
    )

    assert baseline is not None
    assert baseline.sample_count == 3  # Only [70.0, 72.0, 74.0] counted
    assert baseline.min_val >= 70.0    # None was NOT coerced to 0.0!
    assert baseline.median == 72.0

def test_stale_readings_detection():
    """
    Verifies that data freshness is correctly computed,
    marking observations older than the threshold as stale.
    """
    now = datetime.now(timezone.utc)
    # Reading logged 48 hours ago
    stale_time = now - timedelta(hours=48)
    obs = {
        "observation_id": "obs_stale",
        "value": 75.0,
        "unit": "bpm",
        "observed_at": stale_time
    }

    base = compute_metric_baseline(
        metric_type="heart_rate",
        unit="bpm",
        values=[70.0, 71.0, 72.0],
        timestamps=[stale_time - timedelta(days=1), stale_time - timedelta(days=2), stale_time - timedelta(days=3)],
        window_days=30
    )

    dev = analyze_measurement_deviation(
        patient_id="patient_stale",
        metric_type="heart_rate",
        current_obs=obs,
        baseline=base,
        freshness_threshold_hours=24.0
    )

    assert dev.freshness_hours >= 47.0
    assert dev.is_stale is True
    assert dev.data_freshness["is_stale"] is True

def test_outlier_tukey_filtering():
    """
    Verifies that extreme hardware/sensor outliers (e.g. 240 bpm) are clamped by Tukey's fences
    and counted in outlier_count.
    """
    now = datetime.now(timezone.utc)
    values = [68.0, 70.0, 71.0, 72.0, 69.0, 71.5, 250.0]
    timestamps = [now - timedelta(days=i) for i in range(len(values))]

    baseline = compute_metric_baseline(
        metric_type="heart_rate",
        unit="bpm",
        values=values,
        timestamps=timestamps,
        window_days=30
    )

    assert baseline is not None
    assert baseline.outlier_count == 1
    # Filtered mean should be close to 70 bpm, not distorted by 250
    assert baseline.mean < 75.0
    assert baseline.median == 71.0

def test_simulated_data_separation():
    """
    Verifies that simulated observations are excluded from measured-data baselines
    unless include_simulated=True is explicitly requested.
    """
    now = datetime.now(timezone.utc)
    observations = [
        {"metric_type": "heart_rate", "value": 70.0, "unit": "bpm", "observed_at": now - timedelta(days=1), "data_kind": "measured"},
        {"metric_type": "heart_rate", "value": 72.0, "unit": "bpm", "observed_at": now - timedelta(days=2), "data_kind": "measured"},
        {"metric_type": "heart_rate", "value": 71.0, "unit": "bpm", "observed_at": now - timedelta(days=3), "data_kind": "measured"},
        {"metric_type": "heart_rate", "value": 95.0, "unit": "bpm", "observed_at": now - timedelta(days=4), "data_kind": "simulated", "is_synthetic": True}
    ]

    # Default: include_simulated = False
    baselines_measured = compute_all_baselines(observations, window_days=30, include_simulated=False)
    assert baselines_measured["heart_rate"].sample_count == 3
    assert baselines_measured["heart_rate"].includes_simulated is False
    assert baselines_measured["heart_rate"].data_tier == "measured"
    assert baselines_measured["heart_rate"].median == 71.0

    # Explicit: include_simulated = True
    baselines_mixed = compute_all_baselines(observations, window_days=30, include_simulated=True)
    assert baselines_mixed["heart_rate"].sample_count == 4
    assert baselines_mixed["heart_rate"].includes_simulated is True
    assert baselines_mixed["heart_rate"].data_tier == "mixed_simulated"

def test_misleading_relative_deviation_exclusion():
    """
    Verifies that relative percentage deviation is excluded for SpO2 (where percentage points are standard)
    and interval temperature scales.
    """
    meaningful_spo2, reason_spo2 = is_relative_deviation_meaningful("spo2", 98.0)
    assert meaningful_spo2 is False
    assert "bounded percentage" in reason_spo2 or "SpO2" in reason_spo2

    meaningful_temp, _ = is_relative_deviation_meaningful("body_temperature", 37.0)
    assert meaningful_temp is False

    rel_pct, is_mean, note = calculate_relative_deviation(94.0, 98.0, "spo2")
    assert rel_pct is None
    assert is_mean is False
    assert note is not None

def test_deterministic_simulation_scenario_engine():
    """
    Verifies that the what-if simulation scenario engine is deterministic,
    returns explicit assumptions and non-causal limitations,
    and separates baseline scenario from hypothetical scenario.
    """
    params = InterventionParams(
        duration_days=14,
        delta_daily_steps=3000,
        delta_sleep_hours=1.0,
        sodium_reduction_pct=15.0,
        delta_stress_level=-10.0
    )
    baseline_stats = {
        "heart_rate": 72.0,
        "blood_pressure_systolic": 126.0,
        "hrv_rmssd": 44.0
    }

    res1 = run_twin_simulation("patient_sim_01", "Counterfactual Recovery", params, baseline_stats)
    res2 = run_twin_simulation("patient_sim_01", "Counterfactual Recovery", params, baseline_stats)

    # 1. Determinism
    assert res1["projected_outcomes"] == res2["projected_outcomes"]
    assert res1["baseline_scenario"] == res2["baseline_scenario"]
    assert res1["hypothetical_scenario"] == res2["hypothetical_scenario"]

    # 2. Explicit assumptions
    assert len(res1["model_assumptions"]) >= 4
    assert any("exponential" in a.lower() for a in res1["model_assumptions"])

    # 3. Explicit limitations (does not claim clinical validation or guaranteed causality)
    assert "limitations" in res1
    assert "does not guarantee" in res1["limitations"].lower()
    assert "illustrative" in res1["limitations"].lower()
