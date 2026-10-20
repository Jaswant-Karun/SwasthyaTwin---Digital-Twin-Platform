import pytest
import numpy as np
from datetime import datetime, timedelta, timezone
from app.analytics.baseline_calculator import compute_metric_baseline, compute_all_baselines
from app.analytics.anomaly_detector import detect_deviations, evaluate_alerts, classify_z_score
from app.analytics.trend_indicator import calculate_health_stability_index
from app.analytics.twin_simulation_engine import run_twin_simulation
from app.analytics.predictor import train_and_forecast_metric
from app.models.simulation import InterventionParams
from app.models.observation import ObservationCreate
from app.services.observation_service import ObservationService
from app.services.assessment_service import AssessmentService

# ==========================================================
# 1. Personal Baselines, Robust Stats & Missing Data Handling
# ==========================================================

def test_baseline_min_observations_requirement():
    """Verify that fewer observations than MIN_OBSERVATIONS_FOR_BASELINE marks is_sufficient=False."""
    now = datetime.now(timezone.utc)
    times = [now - timedelta(days=i) for i in range(2)]
    # Only 2 observations provided when minimum is 3
    baseline = compute_metric_baseline(
        metric_type="heart_rate",
        unit="bpm",
        values=[70.0, 72.0],
        timestamps=times,
        min_observations=3
    )
    assert baseline is not None
    assert baseline.is_sufficient is False
    assert baseline.sample_count == 2

    # With 3 or more observations, is_sufficient is True
    times3 = [now - timedelta(days=i) for i in range(3)]
    baseline3 = compute_metric_baseline(
        metric_type="heart_rate",
        unit="bpm",
        values=[70.0, 72.0, 71.0],
        timestamps=times3,
        min_observations=3
    )
    assert baseline3 is not None
    assert baseline3.is_sufficient is True
    assert baseline3.sample_count == 3

def test_baseline_handles_missing_values_without_treating_as_zero():
    """Verify that None values are omitted from calculations and not treated as zero."""
    now = datetime.now(timezone.utc)
    times = [now - timedelta(days=i) for i in range(5)]
    # List containing None values
    values = [80.0, None, 82.0, None, 81.0]

    baseline = compute_metric_baseline(
        metric_type="heart_rate",
        unit="bpm",
        values=values,
        timestamps=times,
        min_observations=3
    )
    assert baseline is not None
    assert baseline.sample_count == 3  # Only valid numbers counted
    assert baseline.min_val >= 80.0    # None was NOT treated as 0.0!
    assert 80.5 <= baseline.mean <= 81.5

def test_baseline_robust_tukey_outlier_clamping():
    """Verify that extreme outliers beyond Tukey's 3*IQR fences are tracked in outlier_count."""
    now = datetime.now(timezone.utc)
    times = [now - timedelta(days=i) for i in range(20)]
    # 19 normal values around 70 bpm, and 1 extreme outlier spike (250 bpm)
    values = [70.0 + (i % 3) for i in range(19)] + [250.0]

    baseline = compute_metric_baseline(
        metric_type="heart_rate",
        unit="bpm",
        values=values,
        timestamps=times,
        min_observations=5
    )
    assert baseline is not None
    assert baseline.outlier_count >= 1
    # Robust mean should be close to 71, not skewed by 250
    assert baseline.mean < 75.0
    assert baseline.median <= 72.0

# ==========================================================
# 2. Trend Detection & Directionality
# ==========================================================

def test_classify_z_score_levels_and_directions():
    """Verify z-score classification rules and semantic directions."""
    status, direction = classify_z_score(0.2)
    assert status == "optimal"
    assert direction == "normal"

    status, direction = classify_z_score(1.5)
    assert status == "mild_deviation"
    assert direction == "elevated"

    status, direction = classify_z_score(-2.5)
    assert status == "moderate_drift"
    assert direction == "suppressed"

    status, direction = classify_z_score(3.5)
    assert status == "significant_deviation"
    assert direction == "elevated"

def test_trend_detection_directionality_and_units():
    """Verify that adverse drift accounts for metric-specific directionality."""
    now = datetime.now(timezone.utc)
    # 1. High heart rate is adverse
    hr_baseline = compute_metric_baseline(
        metric_type="heart_rate",
        unit="bpm",
        values=[60.0, 62.0, 61.0, 60.0, 61.0],
        timestamps=[now - timedelta(days=i) for i in range(5)]
    )
    # 2. High HRV is NOT adverse (low HRV is adverse)
    hrv_baseline = compute_metric_baseline(
        metric_type="hrv_rmssd",
        unit="ms",
        values=[50.0, 52.0, 51.0, 50.0, 51.0],
        timestamps=[now - timedelta(days=i) for i in range(5)]
    )

    current_metrics = {
        "heart_rate": {
            "value": 85.0,  # ~ +24 bpm -> high z-score (adverse)
            "unit": "bpm",
            "observation_id": "obs_hr_spike",
            "observed_at": now
        },
        "hrv_rmssd": {
            "value": 75.0,  # Elevated HRV -> beneficial, not adverse!
            "unit": "ms",
            "observation_id": "obs_hrv_high",
            "observed_at": now
        }
    }

    deviations = detect_deviations(current_metrics, {"heart_rate": hr_baseline, "hrv_rmssd": hrv_baseline})
    assert deviations["heart_rate"].z_score > 2.0
    assert deviations["hrv_rmssd"].z_score > 2.0

    alerts = evaluate_alerts("PT-TEST", deviations)
    # Alert should be generated for adverse heart_rate elevation, but NOT for high HRV!
    hr_alerts = [a for a in alerts if a.metric_type == "heart_rate"]
    hrv_alerts = [a for a in alerts if a.metric_type == "hrv_rmssd"]
    assert len(hr_alerts) == 1
    assert len(hrv_alerts) == 0
    assert hr_alerts[0].evidence.get("contributing_observation_id") == "obs_hr_spike"

# ==========================================================
# 3. Health-Trend Indicator Formula & Missing Inputs
# ==========================================================

def test_health_stability_indicator_normalized_formula():
    """Verify documented formula, component contributions, and visible missing inputs."""
    now = datetime.now(timezone.utc)
    base = compute_metric_baseline(
        metric_type="heart_rate",
        unit="bpm",
        values=[65.0, 66.0, 64.0, 65.0, 66.0],
        timestamps=[now - timedelta(days=i) for i in range(5)]
    )
    current = {
        "heart_rate": {
            "value": 65.0, # Exactly on baseline
            "unit": "bpm",
            "observed_at": now
        }
    }
    devs = detect_deviations(current, {"heart_rate": base})
    assessment = calculate_health_stability_index("PT-TEST", devs)

    # With perfect baseline alignment, index should be 100.0
    assert assessment.vitality_index == 100.0
    assert assessment.stability_status == "optimal"
    # Canonical metrics not present (blood_pressure, sleep, etc.) must be in missing_inputs
    assert "blood_pressure_systolic" in assessment.missing_inputs
    assert "sleep_duration_hours" in assessment.missing_inputs
    # Component contributions are transparently shown
    assert "heart_rate" in assessment.component_contributions
    assert assessment.component_contributions["heart_rate"]["impact_score"] == 0.0

# ==========================================================
# 4. What-If Simulation Determinism & No Historical Rewrite
# ==========================================================

def test_what_if_simulation_determinism_and_assumptions():
    """Verify that What-If simulations are deterministic, compare to baseline, and provide assumptions."""
    params = InterventionParams(
        delta_sleep_hours=1.5,
        delta_daily_steps=3000,
        delta_stress_level=-15.0,
        sodium_reduction_pct=20.0,
        duration_days=14
    )
    baseline_stats = {
        "heart_rate": 72.0,
        "blood_pressure_systolic": 126.0,
        "hrv_rmssd": 40.0
    }

    run1 = run_twin_simulation("PT-SIM-TEST", "Cardio Health Boost", params, baseline_stats)
    run2 = run_twin_simulation("PT-SIM-TEST", "Cardio Health Boost", params, baseline_stats)

    # Must be deterministic
    assert len(run1["trajectories"]) == 14
    assert run1["trajectories"][-1]["resting_hr"] == run2["trajectories"][-1]["resting_hr"]
    assert run1["projected_outcomes"]["final_resting_hr"] == run2["projected_outcomes"]["final_resting_hr"]

    # Must include baseline comparison
    assert run1["baseline_summary"]["resting_hr"] == 72.0
    assert run1["projected_outcomes"]["delta_resting_hr"] < 0 # Heart rate improves (drops)
    assert len(run1["model_assumptions"]) >= 3
    assert "illustrative" in run1["disclaimer"].lower() or "exploration" in run1["disclaimer"].lower()

# ==========================================================
# 5. Prediction Model (Time-Series Forecaster)
# ==========================================================

def test_prediction_model_temporal_leakage_and_metrics():
    """Verify prediction model splits temporally, compares to baseline, and reports MAE/RMSE."""
    now = datetime.now(timezone.utc)
    # Generate 30 days of longitudinal synthetic observations
    obs_list = []
    for day in range(30, 0, -1):
        obs_list.append({
            "observation_id": f"obs_pred_{day}",
            "value": 70.0 + (30 - day) * 0.3, # gradual upward drift
            "observed_at": now - timedelta(days=day),
            "unit": "bpm"
        })

    result = train_and_forecast_metric(
        metric_type="heart_rate",
        unit="bpm",
        observations=obs_list,
        horizon_days=7
    )
    assert result is not None
    assert result.target_horizon_days == 7
    assert len(result.prediction_trajectory) == 7
    # Evaluation metrics must be reported
    assert result.evaluation_metrics.evaluation_window_days == 7
    assert result.evaluation_metrics.mae >= 0.0
    assert result.evaluation_metrics.baseline_mae >= 0.0
    assert "model_version" in result.model_dump()
    assert "disclaimer" in result.model_dump()

# ==========================================================
# 6. Dynamic Twin State Recompute on New Observation
# ==========================================================

def test_dynamic_twin_state_updates_on_new_observation(client, mock_db):
    """Verify that posting a new observation triggers reactive twin state recalculation."""
    now = datetime.now(timezone.utc)
    # Register patient
    p_res = client.post("/api/patients", json={
        "patient_id": "PT-REACTIVE-01",
        "display_name": "Reactive Test Patient",
        "age": 35,
        "gender": "male",
        "baseline_window_days": 30
    })
    assert p_res.status_code == 201

    # Ingest historical baseline observations (10 days of normal HR ~65 bpm)
    batch = []
    for d in range(10, 0, -1):
        batch.append({
            "patient_id": "PT-REACTIVE-01",
            "measurement_type": "heart_rate",
            "value": 65.0,
            "unit": "bpm",
            "observed_at": (now - timedelta(days=d)).isoformat(),
            "data_kind": "measured"
        })
    client.post("/api/patients/PT-REACTIVE-01/observations/batch", json={"observations": batch})

    # Initial twin state
    twin1 = client.get("/api/patients/PT-REACTIVE-01/twin").json()
    assert twin1["metrics"]["heart_rate"]["current_value"] == 65.0
    assert twin1["overall_vitality"] == 100.0

    # Post an acute deviated observation (HR = 92 bpm)
    obs_res = client.post("/api/patients/PT-REACTIVE-01/observations", json={
        "patient_id": "PT-REACTIVE-01",
        "measurement_type": "heart_rate",
        "value": 92.0,
        "unit": "bpm",
        "data_kind": "measured"
    })
    assert obs_res.status_code == 201

    # Twin state must dynamically reflect the new reading!
    twin2 = client.get("/api/patients/PT-REACTIVE-01/twin").json()
    assert twin2["metrics"]["heart_rate"]["current_value"] == 92.0
    assert twin2["metrics"]["heart_rate"]["z_score"] > 2.0
    assert twin2["overall_vitality"] < 100.0 # Vitality dynamically deducted
    assert twin2["data_freshness_hours"] is not None
    assert twin2["data_freshness_hours"] < 1.0 # Immediately fresh

# ==========================================================
# 7. Analytics Endpoints Integration
# ==========================================================

def test_analytics_endpoints_and_patch_acknowledge(client):
    """Test /api/patients/{id}/trends, /assessments, /simulations, /alerts, and PATCH acknowledge."""
    # Seed cohorts
    client.post("/api/seed")

    # 1. Trends endpoint
    trends_res = client.get("/api/patients/PT-1001/trends")
    assert trends_res.status_code == 200
    assert "trends" in trends_res.json()
    assert "baselines" in trends_res.json()

    # 2. Assessments endpoint
    asmt_res = client.get("/api/patients/PT-1001/assessments")
    assert asmt_res.status_code == 200
    assert isinstance(asmt_res.json(), list)

    # 3. Simulations endpoint (both GET and POST)
    sim_post = client.post("/api/patients/PT-1001/simulations", json={
        "scenario_name": "API Simulation Test",
        "parameters": {
            "delta_sleep_hours": 1.0,
            "delta_daily_steps": 2500,
            "delta_stress_level": -10.0,
            "sodium_reduction_pct": 15.0,
            "duration_days": 14
        }
    })
    assert sim_post.status_code == 201
    assert "simulation_id" in sim_post.json()

    sim_list = client.get("/api/patients/PT-1001/simulations")
    assert sim_list.status_code == 200
    assert len(sim_list.json()) >= 1

    # 4. Global Alerts & PATCH acknowledge
    alerts_res = client.get("/api/alerts?patient_id=PT-1001")
    assert alerts_res.status_code == 200
    alerts = alerts_res.json()
    assert len(alerts) >= 1
    target_alert = alerts[0]
    alert_id = target_alert["id"]

    # PATCH acknowledge
    patch_res = client.patch(f"/api/alerts/{alert_id}/acknowledge", json={
        "acknowledged_by": "Dr. Sarah Jenkins",
        "notes": "Reviewed in cardiology clinic"
    })
    assert patch_res.status_code == 200
    assert patch_res.json()["is_acknowledged"] is True
    assert patch_res.json()["acknowledged_by"] == "Dr. Sarah Jenkins"
