from datetime import datetime, timedelta, timezone
from app.analytics.baseline_calculator import compute_metric_baseline, compute_all_baselines

def test_compute_metric_baseline_normal():
    now = datetime.now(timezone.utc)
    values = [60.0, 62.0, 61.0, 63.0, 60.5, 61.5, 62.0]
    timestamps = [now - timedelta(days=i) for i in range(len(values))]

    baseline = compute_metric_baseline(
        metric_type="heart_rate",
        unit="bpm",
        values=values,
        timestamps=timestamps,
        window_days=30
    )

    assert baseline is not None
    assert baseline.metric_type == "heart_rate"
    assert baseline.unit == "bpm"
    assert 60.0 <= baseline.mean <= 63.0
    assert baseline.sample_count == len(values)
    assert baseline.std_dev >= 0.0

def test_compute_metric_baseline_outlier_resilience():
    now = datetime.now(timezone.utc)
    # Series with a massive aberrant spike (e.g. 190 bpm transient artifact)
    values = [60.0, 61.0, 60.0, 62.0, 61.0, 60.5, 61.5, 195.0]
    timestamps = [now - timedelta(days=i) for i in range(len(values))]

    baseline = compute_metric_baseline(
        metric_type="heart_rate",
        unit="bpm",
        values=values,
        timestamps=timestamps,
        window_days=30
    )

    assert baseline is not None
    # Winsorized mean should not be pulled anywhere near 195
    assert baseline.mean < 80.0

def test_compute_all_baselines_grouping():
    now = datetime.now(timezone.utc)
    observations = [
        {"metric_type": "heart_rate", "value": 70, "unit": "bpm", "timestamp": now - timedelta(days=1)},
        {"metric_type": "heart_rate", "value": 72, "unit": "bpm", "timestamp": now - timedelta(days=2)},
        {"metric_type": "heart_rate", "value": 71, "unit": "bpm", "timestamp": now - timedelta(days=3)},
        {"metric_type": "daily_steps", "value": 8000, "unit": "steps", "timestamp": now - timedelta(days=1)},
        {"metric_type": "daily_steps", "value": 8500, "unit": "steps", "timestamp": now - timedelta(days=2)},
        {"metric_type": "daily_steps", "value": 7800, "unit": "steps", "timestamp": now - timedelta(days=3)},
    ]

    baselines = compute_all_baselines(observations, window_days=30)
    assert "heart_rate" in baselines
    assert "daily_steps" in baselines
    assert baselines["heart_rate"].sample_count == 3
    assert baselines["daily_steps"].mean > 7000
