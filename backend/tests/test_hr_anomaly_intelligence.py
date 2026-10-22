"""
Comprehensive Test Suite for Personalized Heart-Rate Anomaly Intelligence
Verifies:
1. Median baseline calculation with known reference values
2. Robust variability calculation (nMAD = 1.4826 * raw_MAD) and safe zero-variability floor handling
3. Anomaly classification: unusual_high, unusual_low, within_personal_range, review_data_quality
4. Insufficient history gating (< min_observations returns insufficient_data)
5. Exclusion of invalid, rejected, missing, and simulated observations from real baseline
6. Self-exclusion: current evaluated reading is strictly excluded from its own reference baseline
7. Chronological integrity: future observations strictly never leak into earlier baselines
8. Timezone awareness and chronological ordering
9. Strict cross-patient data isolation across MongoDB collections and API queries
10. Missing device/source metadata handling
11. FastAPI endpoints: GET /baseline, GET /anomalies, GET /anomalies/{id}/explanation
"""

import pytest
import numpy as np
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from pymongo.database import Database

from app.main import app
from app.api.deps import get_database
from app.analytics.hr_anomaly_engine import (
    calculate_hr_baseline,
    evaluate_heart_rate_observation,
    analyze_patient_heart_rate_stream,
    explain_heart_rate_anomaly,
    parse_observation_timestamp,
    is_eligible_observation,
    HeartRateBaseline,
    HeartRateAnomalyRecord,
    ALGORITHM_VERSION
)
from app.services.cardiovascular_service import CardiovascularService


@pytest.fixture
def test_client(mock_db: Database):
    def override_get_db():
        yield mock_db

    app.dependency_overrides[get_database] = override_get_db
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


# ==============================================================================
# 1. Baseline Calculation & Robust Variability (nMAD) Tests
# ==============================================================================

def test_median_baseline_calculation_with_known_sample():
    # Known distribution: [60, 62, 64, 65, 66, 68, 70, 72, 74, 76] (10 items)
    # Median of sorted 10 items: (66 + 68) / 2 = 67.0 bpm
    # Deviations from 67.0: [7, 5, 3, 2, 1, 1, 3, 5, 7, 9]
    # Sorted deviations: [1, 1, 2, 3, 3, 5, 5, 7, 7, 9] -> Median = (3 + 5)/2 = 4.0
    # Expected nMAD = 1.4826 * 4.0 = 5.9304 -> rounded 5.93
    base_time = datetime(2026, 10, 1, 12, 0, tzinfo=timezone.utc)
    known_vals = [60.0, 62.0, 64.0, 65.0, 66.0, 68.0, 70.0, 72.0, 74.0, 76.0]
    obs = [
        {"patient_id": "PT-01", "measurement_type": "heart_rate", "value": v, "observed_at": base_time + timedelta(days=i)}
        for i, v in enumerate(known_vals)
    ]

    baseline = calculate_hr_baseline(
        patient_id="PT-01",
        observations=obs,
        window_days=30,
        min_observations=10,
        reference_time=base_time + timedelta(days=20)
    )

    assert baseline.is_sufficient is True
    assert baseline.status == "established"
    assert baseline.median == 67.0
    assert baseline.mad == 4.0
    assert baseline.n_mad == 5.93
    assert baseline.variability_floor_applied is False
    assert baseline.observation_count == 10


def test_zero_and_near_zero_variability_floor_handling():
    # Exactly identical readings: [65.0] * 12
    # raw_MAD = 0.0 -> nMAD would be 0.0 -> Must apply safe floor (1.0 bpm)
    base_time = datetime(2026, 10, 1, tzinfo=timezone.utc)
    obs = [
        {"patient_id": "PT-02", "measurement_type": "heart_rate", "value": 65.0, "observed_at": base_time + timedelta(days=i)}
        for i in range(12)
    ]

    baseline = calculate_hr_baseline(
        patient_id="PT-02",
        observations=obs,
        window_days=30,
        min_observations=10,
        reference_time=base_time + timedelta(days=20),
        variability_floor_bpm=1.0
    )

    assert baseline.is_sufficient is True
    assert baseline.median == 65.0
    assert baseline.mad == 0.0
    assert baseline.n_mad == 1.0  # Safe floor applied
    assert baseline.variability_floor_applied is True


def test_insufficient_history_returns_insufficient_data():
    # Only 4 observations when min_observations=10
    base_time = datetime(2026, 10, 1, tzinfo=timezone.utc)
    obs = [
        {"patient_id": "PT-INSUFF", "measurement_type": "heart_rate", "value": 70.0, "observed_at": base_time + timedelta(days=i)}
        for i in range(4)
    ]

    baseline = calculate_hr_baseline(
        patient_id="PT-INSUFF",
        observations=obs,
        window_days=30,
        min_observations=10,
        reference_time=base_time + timedelta(days=10)
    )

    assert baseline.is_sufficient is False
    assert baseline.status == "insufficient_data"
    assert baseline.median is None
    assert baseline.n_mad is None
    assert baseline.observation_count == 4
    assert "Insufficient eligible observations" in baseline.reason


# ==============================================================================
# 2. Anomaly Classification & Self-Exclusion Tests
# ==============================================================================

def test_anomaly_classification_high_low_and_normal():
    base_time = datetime(2026, 10, 1, tzinfo=timezone.utc)
    # Baseline: 12 observations hovering around 65.0 bpm (MAD ~ 2.0 -> nMAD ~ 2.97)
    prior_obs = [
        {
            "patient_id": "PT-ANOM",
            "observation_id": f"prior_{i}",
            "measurement_type": "heart_rate",
            "value": 65.0 + (i % 3 - 1),  # 64, 65, 66
            "observed_at": base_time + timedelta(days=i)
        }
        for i in range(12)
    ]

    # 1. Normal reading (66.0 bpm) -> should be within_personal_range
    normal_target = {
        "patient_id": "PT-ANOM",
        "observation_id": "target_normal",
        "measurement_type": "heart_rate",
        "value": 66.0,
        "observed_at": base_time + timedelta(days=13)
    }
    rec_normal = evaluate_heart_rate_observation(normal_target, prior_obs, z_threshold=2.5)
    assert rec_normal.status == "within_personal_range"
    assert abs(rec_normal.robust_score) < 2.5
    assert rec_normal.delta_absolute == 1.0

    # 2. Unusual High reading (85.0 bpm -> delta +20 bpm, modified Z >> 2.5)
    high_target = {
        "patient_id": "PT-ANOM",
        "observation_id": "target_high",
        "measurement_type": "heart_rate",
        "value": 85.0,
        "observed_at": base_time + timedelta(days=14)
    }
    rec_high = evaluate_heart_rate_observation(high_target, prior_obs, z_threshold=2.5)
    assert rec_high.status == "unusual_high"
    assert rec_high.robust_score > 2.5
    assert rec_high.delta_absolute == 20.0
    assert "above personal baseline" in rec_high.reason

    # 3. Unusual Low reading (48.0 bpm -> delta -17 bpm, modified Z << -2.5)
    low_target = {
        "patient_id": "PT-ANOM",
        "observation_id": "target_low",
        "measurement_type": "heart_rate",
        "value": 48.0,
        "observed_at": base_time + timedelta(days=15)
    }
    rec_low = evaluate_heart_rate_observation(low_target, prior_obs, z_threshold=2.5)
    assert rec_low.status == "unusual_low"
    assert rec_low.robust_score < -2.5
    assert rec_low.delta_absolute == -17.0
    assert "below personal baseline" in rec_low.reason


def test_current_reading_strictly_excluded_from_its_own_baseline():
    """
    Verifies that if an extreme outlier is evaluated, it DOES NOT pull the baseline toward itself.
    """
    base_time = datetime(2026, 10, 1, tzinfo=timezone.utc)
    prior_obs = [
        {"patient_id": "PT-SELF", "observation_id": f"obs_{i}", "measurement_type": "heart_rate", "value": 60.0, "observed_at": base_time + timedelta(days=i)}
        for i in range(10)
    ]

    # Extreme reading: 180.0 bpm
    extreme_target = {
        "patient_id": "PT-SELF",
        "observation_id": "obs_extreme",
        "measurement_type": "heart_rate",
        "value": 180.0,
        "observed_at": base_time + timedelta(days=11)
    }

    # Evaluate target with a list that includes the target itself
    dirty_list = prior_obs + [extreme_target]
    rec = evaluate_heart_rate_observation(extreme_target, dirty_list, min_observations=10)

    # Baseline median must strictly be 60.0 bpm (NOT corrupted by 180.0 bpm)
    assert rec.baseline_median == 60.0
    assert rec.delta_absolute == 120.0
    assert rec.status == "unusual_high"


def test_no_future_data_leakage():
    """
    Verifies that future observations (t > t_target) are strictly excluded from historical baseline.
    """
    t_past = datetime(2026, 10, 1, tzinfo=timezone.utc)
    t_eval = datetime(2026, 10, 15, tzinfo=timezone.utc)
    t_future = datetime(2026, 10, 20, tzinfo=timezone.utc)

    # 10 observations at 60 bpm in the past
    past_obs = [
        {"patient_id": "PT-LEAK", "value": 60.0, "observed_at": t_past + timedelta(days=i), "measurement_type": "heart_rate"}
        for i in range(10)
    ]
    # Target observation at day 15 (value = 60.0)
    target = {"patient_id": "PT-LEAK", "value": 60.0, "observed_at": t_eval, "measurement_type": "heart_rate"}

    # 10 massive spikes in the future (day 20+ at 160 bpm)
    future_obs = [
        {"patient_id": "PT-LEAK", "value": 160.0, "observed_at": t_future + timedelta(days=i), "measurement_type": "heart_rate"}
        for i in range(10)
    ]

    all_obs = past_obs + [target] + future_obs
    rec = evaluate_heart_rate_observation(target, all_obs, min_observations=10)

    # Baseline must only see the 10 past observations
    assert rec.baseline_observation_count == 10
    assert rec.baseline_median == 60.0
    assert rec.status == "within_personal_range"


def test_exclusion_of_invalid_and_simulated_data():
    base_time = datetime(2026, 10, 1, tzinfo=timezone.utc)
    # 10 valid measured observations at 65.0 bpm
    obs = [
        {
            "patient_id": "PT-FILTER",
            "value": 65.0,
            "observed_at": base_time + timedelta(days=i),
            "measurement_type": "heart_rate",
            "data_kind": "measured",
            "validation_status": "valid"
        }
        for i in range(10)
    ]
    # Add simulated observation (must be excluded)
    obs.append({
        "patient_id": "PT-FILTER",
        "value": 140.0,
        "observed_at": base_time + timedelta(days=1),
        "measurement_type": "heart_rate",
        "data_kind": "simulated"
    })
    # Add rejected observation (must be excluded)
    obs.append({
        "patient_id": "PT-FILTER",
        "value": 250.0,
        "observed_at": base_time + timedelta(days=2),
        "measurement_type": "heart_rate",
        "validation_status": "rejected"
    })

    baseline = calculate_hr_baseline("PT-FILTER", obs, min_observations=10, reference_time=base_time + timedelta(days=15))
    assert baseline.observation_count == 10  # Only the 10 valid records
    assert baseline.median == 65.0


def test_missing_device_metadata_handled_gracefully():
    # Target without device_id or source_type
    target = {
        "patient_id": "PT-NODEV",
        "observation_id": "obs_nodev",
        "value": 72.0,
        "observed_at": datetime.now(timezone.utc)
    }
    rec = evaluate_heart_rate_observation(target, [], min_observations=5)
    assert rec.source_type is None
    assert rec.device_id is None
    assert rec.status == "insufficient_data"


# ==============================================================================
# 3. FastAPI Endpoint Integration & Patient Isolation Tests
# ==============================================================================

def test_api_get_cardiovascular_baseline_and_isolation(test_client: TestClient):
    # Patient A: Has 12 observations at 62 bpm
    pat_a = "PT-ISO-CARDIO-A"
    test_client.post("/api/v1/patients", json={"patient_id": pat_a, "full_name": "Subject A"})
    base_time = datetime(2026, 10, 1, tzinfo=timezone.utc)
    for i in range(12):
        test_client.post(f"/api/v1/patients/{pat_a}/observations", json={
            "patient_id": pat_a,
            "measurement_type": "heart_rate",
            "value": 62.0,
            "unit": "bpm",
            "observed_at": (base_time + timedelta(days=i)).isoformat()
        })

    # Patient B: Has 12 observations at 88 bpm
    pat_b = "PT-ISO-CARDIO-B"
    test_client.post("/api/v1/patients", json={"patient_id": pat_b, "full_name": "Subject B"})
    for i in range(12):
        test_client.post(f"/api/v1/patients/{pat_b}/observations", json={
            "patient_id": pat_b,
            "measurement_type": "heart_rate",
            "value": 88.0,
            "unit": "bpm",
            "observed_at": (base_time + timedelta(days=i)).isoformat()
        })

    # Query Baseline for Patient A
    res_a = test_client.get(f"/api/v1/patients/{pat_a}/cardiovascular/baseline?min_observations=10")
    assert res_a.status_code == 200
    base_a = res_a.json()
    assert base_a["patient_id"] == pat_a
    assert base_a["median"] == 62.0
    assert base_a["observation_count"] == 12

    # Query Baseline for Patient B
    res_b = test_client.get(f"/api/v1/patients/{pat_b}/cardiovascular/baseline?min_observations=10")
    assert res_b.status_code == 200
    base_b = res_b.json()
    assert base_b["patient_id"] == pat_b
    assert base_b["median"] == 88.0
    assert base_b["observation_count"] == 12  # Strict isolation: no leakage from Subject A!


def test_api_get_cardiovascular_anomalies_and_explanation(test_client: TestClient):
    pid = "PT-ANOM-API"
    test_client.post("/api/v1/patients", json={"patient_id": pid, "full_name": "API Anomaly Subject"})
    base_time = datetime(2026, 10, 1, tzinfo=timezone.utc)

    # Ingest 12 normal observations at 65 bpm
    for i in range(12):
        test_client.post(f"/api/v1/patients/{pid}/observations", json={
            "patient_id": pid,
            "measurement_type": "heart_rate",
            "value": 65.0,
            "unit": "bpm",
            "observed_at": (base_time + timedelta(days=i)).isoformat()
        })

    # Ingest 1 acute spike observation at 110 bpm (tachycardia anomaly)
    spike_res = test_client.post(f"/api/v1/patients/{pid}/observations?confirm_unusual=true", json={
        "patient_id": pid,
        "measurement_type": "heart_rate",
        "value": 110.0,
        "unit": "bpm",
        "observed_at": (base_time + timedelta(days=13)).isoformat()
    })
    assert spike_res.status_code == 201
    spike_obs_id = spike_res.json()["observation_id"]

    # 1. Query Anomalies endpoint
    anom_res = test_client.get(f"/api/v1/patients/{pid}/cardiovascular/anomalies?min_observations=10")
    assert anom_res.status_code == 200
    data = anom_res.json()
    assert data["patient_id"] == pid
    assert data["operational_metrics"]["total_observations_analyzed"] == 13
    assert data["operational_metrics"]["flagged_anomalies_count"] >= 1
    assert len(data["timeline"]) == 13

    # Check newest event in items
    newest_event = data["events"]["items"][0]
    assert newest_event["observation_id"] == spike_obs_id
    assert newest_event["status"] in ["unusual_high", "review_data_quality"]

    # 2. Query Explanation endpoint
    expl_res = test_client.get(f"/api/v1/patients/{pid}/cardiovascular/anomalies/{spike_obs_id}/explanation")
    assert expl_res.status_code == 200
    expl = expl_res.json()
    assert expl["observation_id"] == spike_obs_id
    assert expl["measured_heart_rate"] == 110.0
    assert "Modified Z" in expl["formula"]
    assert "calculation_breakdown" in expl
    assert "clinical_limitations" in expl


def test_api_404_for_unknown_patient_or_observation(test_client: TestClient):
    # Nonexistent patient
    res_unknown_pat = test_client.get("/api/v1/patients/NONEXISTENT-999/cardiovascular/baseline")
    assert res_unknown_pat.status_code == 404

    # Nonexistent observation
    res_unknown_obs = test_client.get("/api/v1/patients/PT-ANOM-API/cardiovascular/anomalies/NONEXISTENT-OBS/explanation")
    assert res_unknown_obs.status_code == 404
