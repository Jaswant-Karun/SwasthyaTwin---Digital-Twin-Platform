from datetime import datetime, timezone
from app.analytics.anomaly_detector import detect_deviations, evaluate_alerts, classify_z_score
from app.models.assessment import MetricBaseline

def test_classify_z_score():
    assert classify_z_score(0.2)[0] == "optimal"
    assert classify_z_score(1.4)[0] == "mild_deviation"
    assert classify_z_score(2.5)[0] == "moderate_drift"
    assert classify_z_score(3.5)[0] == "significant_deviation"

def test_detect_deviations_and_alerts():
    now = datetime.now(timezone.utc)
    base_hr = MetricBaseline(
        metric_type="heart_rate",
        unit="bpm",
        mean=65.0,
        std_dev=3.0,
        median=65.0,
        iqr=4.0,
        q1=63.0,
        q3=67.0,
        min_val=58.0,
        max_val=72.0,
        sample_count=30,
        window_days=30,
        window_start=now,
        window_end=now
    )
    baselines = {"heart_rate": base_hr}

    # Test an elevated reading: 75 bpm (Z = (75-65)/3 = 3.33 -> significant deviation)
    current_metrics = {
        "heart_rate": {"value": 75.0, "unit": "bpm", "data_tier": "measured"}
    }

    deviations = detect_deviations(current_metrics, baselines)
    assert "heart_rate" in deviations
    dev = deviations["heart_rate"]
    assert dev.z_score > 3.0
    assert dev.status == "significant_deviation"
    assert dev.direction == "elevated"

    # Evaluate alerts
    alerts = evaluate_alerts("PT-TEST", deviations)
    assert len(alerts) == 1
    alert = alerts[0]
    assert alert.severity == "critical"
    assert alert.metric_type == "heart_rate"
    assert "Baseline" in alert.title
    assert "suggested_action" in alert.model_dump()
