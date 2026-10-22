"""
Unit & Integration Tests for Multisignal Health Modules and Model Registry
Verifies:
1. Model Registry task separation, provenance, and metric loading
2. FastAPI Registry endpoints (/api/v1/ml/registry and /api/v1/ml/registry/{task_id})
3. Module A: Sleep Intelligence calculations and disclaimers
4. Module B: Cardiovascular Trend calculations, baseline corridor, and explicit flags
5. Module C: Activity Intelligence step volume, weekday/weekend, and missingness audit
6. Module D: Blood Pressure Trend tracking, pulse pressure, MAP, and plausibility guards
7. Module E: Personalized Anomaly Detection minimum 14-observation gate and statistical vs clinical distinction
8. Module F: Future Trend Forecasting chronological split, baseline comparison, and insufficient-data gating
9. Gated Data Layer API endpoint (/api/v1/patients/{patient_id}/twin/layers)
10. Strict cross-patient data isolation across modules
"""

import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from pymongo.database import Database

from app.main import app
from app.api.deps import get_database
from app.analytics.model_registry import model_registry
from app.analytics.health_modules import (
    SleepIntelligenceModule,
    CardiovascularTrendModule,
    ActivityIntelligenceModule,
    BloodPressureTrendModule,
    PersonalizedAnomalyModule,
    FutureTrendForecastingModule
)
from app.services.assessment_service import AssessmentService

@pytest.fixture
def test_client(mock_db: Database):
    def override_get_db():
        yield mock_db

    app.dependency_overrides[get_database] = override_get_db
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


# --- 1. Model Registry Tests ---

def test_model_registry_contains_distinct_tasks():
    entries = model_registry.get_all_entries()
    assert len(entries) >= 5
    task_ids = [e.task_id for e in entries]

    assert "sleep_stage_classification" in task_ids
    assert "cardiovascular_trend_forecasting" in task_ids
    assert "activity_kinetics_analyzer" in task_ids
    assert "blood_pressure_trend_tracker" in task_ids
    assert "personalized_anomaly_detector" in task_ids

    # Sleep task is NOT reused for blood pressure or forecasting
    sleep_task = model_registry.get_entry("sleep_stage_classification")
    assert sleep_task is not None
    assert sleep_task.category == "sleep"
    assert "5-Stage AASM" in sleep_task.target_definition
    assert "BiDSleep v1.0.1" in sleep_task.dataset_source


def test_api_get_model_registry(test_client: TestClient):
    res = test_client.get("/api/v1/ml/registry")
    assert res.status_code == 200
    data = res.json()
    assert "tasks" in data
    assert data["task_count"] >= 5

    sleep_res = test_client.get("/api/v1/ml/registry/sleep_stage_classification")
    assert sleep_res.status_code == 200
    sleep_data = sleep_res.json()
    assert sleep_data["task_id"] == "sleep_stage_classification"
    assert "held_out_metrics" in sleep_data
    assert "clinical_disclaimer" in sleep_data


def test_api_get_nonexistent_registry_task(test_client: TestClient):
    res = test_client.get("/api/v1/ml/registry/nonexistent_task_123")
    assert res.status_code == 404


# --- 2. Module A: Sleep Intelligence Tests ---

def test_sleep_intelligence_module():
    obs = [
        {"measurement_type": "sleep_duration_hours", "value": 7.0, "observed_at": datetime(2026, 10, 1, tzinfo=timezone.utc)},
        {"measurement_type": "sleep_duration_hours", "value": 7.5, "observed_at": datetime(2026, 10, 2, tzinfo=timezone.utc)},
        {"measurement_type": "sleep_duration_hours", "value": 8.0, "observed_at": datetime(2026, 10, 3, tzinfo=timezone.utc)},
        {"measurement_type": "sleep_duration_hours", "value": 6.5, "observed_at": datetime(2026, 10, 4, tzinfo=timezone.utc)},
    ]
    summary = SleepIntelligenceModule.evaluate("PT-TEST-01", obs)
    assert summary.total_sleep_records == 4
    assert summary.latest_duration_hours == 6.5
    assert summary.baseline_median_hours is not None
    assert summary.sleep_regularity_score is not None
    assert "Does NOT measure EEG directly" in summary.disclaimer


def test_sleep_intelligence_module_empty():
    summary = SleepIntelligenceModule.evaluate("PT-TEST-EMPTY", [])
    assert summary.total_sleep_records == 0
    assert summary.model_prediction_available is False


# --- 3. Module B: Cardiovascular Trend Tests ---

def test_cardiovascular_trend_module():
    base_time = datetime(2026, 10, 1, tzinfo=timezone.utc)
    obs = [
        {"measurement_type": "heart_rate", "value": 68.0, "observed_at": base_time + timedelta(days=i)}
        for i in range(10)
    ]
    # Add an elevated point
    obs.append({"measurement_type": "heart_rate", "value": 105.0, "observed_at": base_time + timedelta(days=10)})

    summary = CardiovascularTrendModule.evaluate("PT-TEST-02", obs)
    assert summary.total_hr_observations == 11
    assert summary.latest_hr_bpm == 105.0
    assert summary.baseline_median_bpm == 68.0
    assert summary.has_sufficient_data is True
    assert summary.relative_deviation_pct > 0

    # Tachycardia flag must be raised for HR > 100
    flag_ids = [f.flag_id for f in summary.active_flags]
    assert "hr_elevated_tachycardia" in flag_ids
    assert "Does NOT diagnose arrhythmias" in summary.disclaimer


# --- 4. Module C: Activity Intelligence Tests ---

def test_activity_intelligence_module():
    base_time = datetime(2026, 10, 1, tzinfo=timezone.utc)
    obs = [
        {"measurement_type": "daily_steps", "value": 8000 + (i * 200), "observed_at": base_time + timedelta(days=i)}
        for i in range(14)
    ]
    # Add a non-wear day (< 500 steps)
    obs.append({"measurement_type": "daily_steps", "value": 250, "observed_at": base_time + timedelta(days=14)})

    summary = ActivityIntelligenceModule.evaluate("PT-TEST-03", obs)
    assert summary.total_days_logged == 15
    assert summary.telemetry_missing_days_count == 1
    assert summary.missingness_rate_pct > 0.0
    assert summary.rolling_7d_average_steps is not None
    assert summary.weekday_mean_steps is not None


# --- 5. Module D: Blood Pressure Trend Tests ---

def test_blood_pressure_trend_module_valid():
    obs = [
        {"measurement_type": "blood_pressure_systolic", "value": 120.0, "observed_at": datetime(2026, 10, 1, tzinfo=timezone.utc)},
        {"measurement_type": "blood_pressure_diastolic", "value": 80.0, "observed_at": datetime(2026, 10, 1, tzinfo=timezone.utc)},
        {"measurement_type": "blood_pressure_systolic", "value": 118.0, "observed_at": datetime(2026, 10, 2, tzinfo=timezone.utc)},
        {"measurement_type": "blood_pressure_diastolic", "value": 76.0, "observed_at": datetime(2026, 10, 2, tzinfo=timezone.utc)},
    ]
    summary = BloodPressureTrendModule.evaluate("PT-TEST-04", obs)
    assert summary.total_bp_observations == 2
    assert summary.latest_systolic_mmHg == 118.0
    assert summary.latest_diastolic_mmHg == 76.0
    assert summary.latest_pulse_pressure_mmHg == 42.0  # 118 - 76
    assert summary.latest_mean_arterial_pressure_mmHg == 90.0  # 76 + 42/3
    assert summary.validation_status == "valid"
    assert summary.requires_user_confirmation is False
    assert "NEVER infers blood pressure synthetically" in summary.disclaimer


def test_blood_pressure_trend_module_flagged_narrow_pulse_pressure():
    obs = [
        {"measurement_type": "blood_pressure_systolic", "value": 90.0, "observed_at": datetime(2026, 10, 1, tzinfo=timezone.utc)},
        {"measurement_type": "blood_pressure_diastolic", "value": 82.0, "observed_at": datetime(2026, 10, 1, tzinfo=timezone.utc)},
    ]
    summary = BloodPressureTrendModule.evaluate("PT-TEST-05", obs)
    assert summary.latest_pulse_pressure_mmHg == 8.0  # < 15 mmHg
    assert summary.requires_user_confirmation is True
    assert summary.validation_status == "flagged"


# --- 6. Module E: Personalized Anomaly Detection Tests ---

def test_personalized_anomaly_insufficient_data():
    obs = [
        {"measurement_type": "heart_rate", "value": 70.0, "observed_at": datetime(2026, 10, 1, tzinfo=timezone.utc)}
        for _ in range(5)  # only 5 observations (< 14 minimum)
    ]
    summary = PersonalizedAnomalyModule.evaluate("PT-TEST-06", obs)
    assert summary.has_sufficient_history is False
    assert summary.overall_stability_status == "insufficient_data"


def test_personalized_anomaly_sufficient_data_detection():
    base_time = datetime(2026, 10, 1, tzinfo=timezone.utc)
    obs = [
        {"measurement_type": "heart_rate", "value": 70.0 + (i % 3), "observed_at": base_time + timedelta(days=i)}
        for i in range(15)
    ]
    # Inject an outlier on day 16
    obs.append({"measurement_type": "heart_rate", "value": 115.0, "observed_at": base_time + timedelta(days=16)})

    summary = PersonalizedAnomalyModule.evaluate("PT-TEST-07", obs)
    assert summary.has_sufficient_history is True
    assert len(summary.detected_anomalies) >= 1
    anomaly = summary.detected_anomalies[0]
    assert anomaly.metric_type == "heart_rate"
    assert anomaly.observed_value == 115.0
    assert anomaly.classification_type in ["both_statistical_and_clinical", "statistical_anomaly", "clinical_abnormality"]


# --- 7. Module F: Future Trend Forecasting Tests ---

def test_future_trend_forecasting_insufficient_history():
    obs = [
        {"measurement_type": "heart_rate", "value": 68.0, "observed_at": datetime(2026, 10, 1, tzinfo=timezone.utc) + timedelta(days=i)}
        for i in range(5)
    ]
    summary = FutureTrendForecastingModule.forecast("PT-TEST-08", "heart_rate", "bpm", obs, horizon_days=7)
    assert summary.forecast_status == "insufficient_data"
    assert "Requires at least 14 days" in summary.insufficient_data_reason


def test_future_trend_forecasting_sufficient_history():
    base_time = datetime(2026, 10, 1, tzinfo=timezone.utc)
    obs = [
        {"measurement_type": "heart_rate", "value": 66.0 + (i * 0.2), "observed_at": base_time + timedelta(days=i)}
        for i in range(20)
    ]
    summary = FutureTrendForecastingModule.forecast("PT-TEST-09", "heart_rate", "bpm", obs, horizon_days=7)
    assert summary.forecast_status == "ready"
    assert len(summary.forecast_trajectory) == 7
    assert summary.held_out_metrics is not None
    assert summary.baseline_comparison is not None
    assert "Simple Persistence Baseline" in summary.baseline_comparison["baseline_name"]


# --- 8. Layer Gating & Patient Isolation Endpoints ---

def test_active_layers_gating(test_client: TestClient, mock_db: Database):
    # Register patient with ONLY heart rate observations (no blood pressure or sleep)
    patient_id = "PT-LAYER-TEST"
    test_client.post("/api/v1/patients", json={
        "patient_id": patient_id,
        "full_name": "Layer Gating Subject",
        "demo_data": False
    })

    test_client.post(f"/api/v1/patients/{patient_id}/observations", json={
        "patient_id": patient_id,
        "measurement_type": "heart_rate",
        "value": 72.0,
        "unit": "bpm",
        "observed_at": datetime.now(timezone.utc).isoformat()
    })

    res = test_client.get(f"/api/v1/patients/{patient_id}/twin/layers")
    assert res.status_code == 200
    layers = res.json()["layers"]

    # Cardiovascular is active
    assert layers["cardiovascular"]["is_active"] is True
    assert layers["cardiovascular"]["observation_count"] == 1

    # Sleep and Blood Pressure are INACTIVE
    assert layers["sleep"]["is_active"] is False
    assert layers["blood_pressure"]["is_active"] is False
    assert layers["activity"]["is_active"] is False


def test_health_modules_endpoint_and_patient_isolation(test_client: TestClient, mock_db: Database):
    # Patient A: Has sleep and heart rate
    pat_a = "PT-ISO-A"
    test_client.post("/api/v1/patients", json={"patient_id": pat_a, "full_name": "Subject A"})
    test_client.post(f"/api/v1/patients/{pat_a}/observations", json={
        "patient_id": pat_a, "measurement_type": "heart_rate", "value": 65.0, "unit": "bpm",
        "observed_at": datetime.now(timezone.utc).isoformat()
    })

    # Patient B: Has steps only
    pat_b = "PT-ISO-B"
    test_client.post("/api/v1/patients", json={"patient_id": pat_b, "full_name": "Subject B"})
    test_client.post(f"/api/v1/patients/{pat_b}/observations", json={
        "patient_id": pat_b, "measurement_type": "daily_steps", "value": 9200, "unit": "steps",
        "observed_at": datetime.now(timezone.utc).isoformat()
    })

    # Evaluate modules for Patient A
    res_a = test_client.get(f"/api/v1/patients/{pat_a}/twin/modules")
    assert res_a.status_code == 200
    mods_a = res_a.json()["modules"]
    assert mods_a["cardiovascular_trends"]["latest_hr_bpm"] == 65.0
    assert mods_a["activity_intelligence"]["total_days_logged"] == 0  # Zero leakage from Patient B!

    # Evaluate modules for Patient B
    res_b = test_client.get(f"/api/v1/patients/{pat_b}/twin/modules")
    assert res_b.status_code == 200
    mods_b = res_b.json()["modules"]
    assert mods_b["activity_intelligence"]["latest_step_count"] == 9200
    assert mods_b["cardiovascular_trends"]["total_hr_observations"] == 0  # Zero leakage from Patient A!


# --- 11. Phase A & B: Unit Conversion, Malformed Input & Plausibility Tests ---

def test_unit_conversions_and_normalizations(test_client: TestClient):
    pid = "PT-UNIT-01"
    test_client.post("/api/v1/patients", json={"patient_id": pid, "full_name": "Unit Conversion Test"})

    # 1. Sleep duration in minutes -> canonical hours (450 min = 7.5 hrs)
    res_sleep = test_client.post(f"/api/v1/patients/{pid}/observations", json={
        "patient_id": pid,
        "measurement_type": "sleep_duration",
        "value": 450.0,
        "unit": "minutes",
        "observed_at": datetime.now(timezone.utc).isoformat()
    })
    assert res_sleep.status_code == 201
    assert res_sleep.json()["unit"] == "hours"
    assert res_sleep.json()["value"] == 7.5

    # 2. Blood pressure in kPa -> canonical mmHg (16.0 kPa = 120.0 mmHg)
    res_bp = test_client.post(f"/api/v1/patients/{pid}/observations", json={
        "patient_id": pid,
        "measurement_type": "blood_pressure_systolic",
        "value": 16.0,
        "unit": "kPa",
        "observed_at": datetime.now(timezone.utc).isoformat()
    })
    assert res_bp.status_code == 201
    assert res_bp.json()["unit"] == "mmHg"
    assert abs(res_bp.json()["value"] - 120.0) <= 0.5

    # 3. Respiratory rate in rpm -> canonical breaths/min
    res_resp = test_client.post(f"/api/v1/patients/{pid}/observations", json={
        "patient_id": pid,
        "measurement_type": "respiratory_rate",
        "value": 16.0,
        "unit": "rpm",
        "observed_at": datetime.now(timezone.utc).isoformat()
    })
    assert res_resp.status_code == 201
    assert res_resp.json()["unit"] == "breaths/min"
    assert res_resp.json()["value"] == 16.0

    # 4. Fasting blood glucose in mmol/L -> canonical mg/dL (5.5 mmol/L = ~99.1 mg/dL)
    res_glu = test_client.post(f"/api/v1/patients/{pid}/observations", json={
        "patient_id": pid,
        "measurement_type": "fasting_blood_glucose",
        "value": 5.5,
        "unit": "mmol/L",
        "observed_at": datetime.now(timezone.utc).isoformat()
    })
    assert res_glu.status_code == 201
    assert res_glu.json()["unit"] == "mg/dL"
    assert abs(res_glu.json()["value"] - 99.1) <= 0.5


def test_malformed_and_impossible_inputs_rejected(test_client: TestClient):
    pid = "PT-MALFORM-01"
    test_client.post("/api/v1/patients", json={"patient_id": pid, "full_name": "Malformed Input Test"})

    # 1. Impossible physiological value (800 bpm HR)
    res_high_hr = test_client.post(f"/api/v1/patients/{pid}/observations", json={
        "patient_id": pid,
        "measurement_type": "heart_rate",
        "value": 800.0,
        "unit": "bpm",
        "observed_at": datetime.now(timezone.utc).isoformat()
    })
    assert res_high_hr.status_code == 400
    assert "not physiologically plausible" in res_high_hr.json()["detail"].lower()

    # 2. Impossible future timestamp (1 hour in the future)
    future_time = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
    res_future = test_client.post(f"/api/v1/patients/{pid}/observations", json={
        "patient_id": pid,
        "measurement_type": "heart_rate",
        "value": 72.0,
        "unit": "bpm",
        "observed_at": future_time
    })
    assert res_future.status_code == 400
    assert "future timestamp" in res_future.json()["detail"].lower()

    # 3. Impossible pre-1970 timestamp
    res_old = test_client.post(f"/api/v1/patients/{pid}/observations", json={
        "patient_id": pid,
        "measurement_type": "heart_rate",
        "value": 72.0,
        "unit": "bpm",
        "observed_at": "1960-01-01T00:00:00Z"
    })
    assert res_old.status_code == 400
    assert "precedes epoch" in res_old.json()["detail"].lower()


def test_suspicious_input_requires_confirmation_flow(test_client: TestClient):
    pid = "PT-SUSP-01"
    test_client.post("/api/v1/patients", json={"patient_id": pid, "full_name": "Suspicious Input Test"})

    # Resting HR 150 bpm is unusual / suspicious -> should return 409 Conflict
    res_unusual = test_client.post(f"/api/v1/patients/{pid}/observations", json={
        "patient_id": pid,
        "measurement_type": "heart_rate",
        "value": 150.0,
        "unit": "bpm",
        "observed_at": datetime.now(timezone.utc).isoformat()
    })
    assert res_unusual.status_code == 409
    data = res_unusual.json()["detail"]
    assert data["status"] == "requires_confirmation"
    assert data["entered_value"] == 150.0
    assert "confirmation_prompt" in data

    # Confirm unusual reading explicitly
    res_confirmed = test_client.post(f"/api/v1/patients/{pid}/observations?confirm_unusual=true", json={
        "patient_id": pid,
        "measurement_type": "heart_rate",
        "value": 150.0,
        "unit": "bpm",
        "observed_at": datetime.now(timezone.utc).isoformat()
    })
    assert res_confirmed.status_code == 201
    assert res_confirmed.json()["validation_status"] == "confirmed_unusual"
    assert res_confirmed.json()["value"] == 150.0


def test_inconsistent_blood_pressure_pair_rejected(test_client: TestClient):
    pid = "PT-BP-PAIR-01"
    test_client.post("/api/v1/patients", json={"patient_id": pid, "full_name": "BP Pair Test"})

    # SBP <= DBP (Systolic 80, Diastolic 120) must be rejected
    res_reversed = test_client.post(f"/api/v1/patients/{pid}/observations", json={
        "patient_id": pid,
        "measurement_type": "blood_pressure_systolic",
        "value": 80.0,
        "unit": "mmHg",
        "paired_measurements": {"blood_pressure_diastolic": 120.0},
        "observed_at": datetime.now(timezone.utc).isoformat()
    })
    assert res_reversed.status_code == 400
    assert "must be strictly greater" in res_reversed.json()["detail"].lower()


# --- 12. Phase C: Cardiovascular Baseline, Simulation Exclusion & Flags Tests ---

def test_cardiovascular_baseline_insufficient_data_gating():
    base_time = datetime(2026, 10, 1, tzinfo=timezone.utc)
    # Only 3 observations (< min_observations=5)
    obs = [
        {"measurement_type": "heart_rate", "value": 70.0, "observed_at": base_time + timedelta(days=i)}
        for i in range(3)
    ]
    summary = CardiovascularTrendModule.evaluate("PT-CARDIO-SUFF", obs, min_observations=5)
    assert summary.total_hr_observations == 3
    assert summary.has_sufficient_data is False
    assert summary.baseline_median_bpm is None
    assert summary.baseline_iqr_bpm is None


def test_cardiovascular_baseline_excludes_simulated_and_rejected():
    base_time = datetime(2026, 10, 1, tzinfo=timezone.utc)
    obs = [
        # 6 valid measured points at 60 bpm
        {"measurement_type": "heart_rate", "value": 60.0, "observed_at": base_time + timedelta(days=i), "data_kind": "measured", "validation_status": "valid"}
        for i in range(6)
    ]
    # 5 simulated points at 120 bpm (must NOT contaminate real baseline)
    for i in range(5):
        obs.append({
            "measurement_type": "heart_rate",
            "value": 120.0,
            "observed_at": base_time + timedelta(days=10 + i),
            "data_kind": "simulated",
            "validation_status": "valid"
        })
    # 2 rejected points at 250 bpm (must NOT contaminate real baseline)
    obs.append({
        "measurement_type": "heart_rate",
        "value": 250.0,
        "observed_at": base_time + timedelta(days=20),
        "data_kind": "measured",
        "validation_status": "rejected"
    })

    summary = CardiovascularTrendModule.evaluate("PT-SIM-EXCL", obs, min_observations=5)
    assert summary.total_hr_observations == 6  # Only the 6 real measured observations!
    assert summary.has_sufficient_data is True
    assert summary.baseline_median_bpm == 60.0
    assert summary.latest_hr_bpm == 60.0


def test_cardiovascular_bradycardia_and_corridor_drift_flags():
    base_time = datetime(2026, 10, 1, tzinfo=timezone.utc)
    # 7 baseline observations at 65 bpm (std_dev ~ 2.0)
    obs = [
        {"measurement_type": "heart_rate", "value": 65.0 + (i % 3), "observed_at": base_time + timedelta(days=i)}
        for i in range(7)
    ]
    # Add acute bradycardia reading: 40 bpm (< 45 bpm threshold and |z| > 2)
    obs.append({"measurement_type": "heart_rate", "value": 40.0, "observed_at": base_time + timedelta(days=8)})

    summary = CardiovascularTrendModule.evaluate("PT-BRADY-FLAG", obs, min_observations=5)
    flag_ids = [f.flag_id for f in summary.active_flags]
    assert "hr_suppressed_bradycardia" in flag_ids
    assert "hr_statistical_corridor_drift" in flag_ids
    assert summary.absolute_deviation_bpm < 0
    assert summary.relative_deviation_pct < 0
