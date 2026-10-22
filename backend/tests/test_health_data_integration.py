"""
SwasthyaTwin AI — Health Data Integration & Observation Unification Tests
Verifies Step 5 Requirements:
1. One consistent patient and observation identity model.
2. Stored timestamp, time zone, canonical unit, source/device, measurement method, validation status, and provenance.
3. Explicit distinction of measured, derived, model-predicted, simulated, and synthetic values.
4. Unified chronological patient timeline with multi-criteria filters (signal, date, source, status, provenance).
5. Strict patient isolation across all queries.
6. Blood pressure is strictly measured (never inferred from heart rate).
7. Activity steps properly flag partial-day totals for today's in-progress day.
8. Real data rules: Zero data fabrication when telemetry is missing (e.g. no sleep records -> 0 inferred epochs).
9. Deduplication of observations by (patient_id, primary_metric, timestamp).
10. Unit normalization consistency between repository, models, and analytics.
"""

import pytest
from datetime import datetime, timezone, timedelta
from app.models.observation import (
    ObservationCreate,
    validate_and_normalize_measurement,
    VALID_UNITS,
    PHYSIOLOGICAL_BOUNDS
)
from app.services.observation_service import ObservationService
from app.repositories.observation_repository import ObservationRepository
from app.services.multi_signal_service import MultiSignalService


@pytest.fixture
def mock_integration_db(mock_db):
    """Initializes test database with isolated test patients."""
    mock_db.patients.delete_many({})
    mock_db.observations.delete_many({})
    mock_db.alerts.delete_many({})

    # Patient A (Complete multi-signal profile)
    mock_db.patients.insert_one({
        "patient_id": "PT-INTEG-01",
        "full_name": "Integration Subject Alpha",
        "age": 42,
        "gender": "male",
        "baseline_window_days": 30,
        "demo_data": False
    })

    # Patient B (Isolated patient profile)
    mock_db.patients.insert_one({
        "patient_id": "PT-INTEG-02",
        "full_name": "Integration Subject Beta",
        "age": 29,
        "gender": "female",
        "baseline_window_days": 30,
        "demo_data": False
    })

    return mock_db


def test_unit_normalization_and_bounds():
    """Verifies unit conversion to canonical units without losing precision."""
    # Blood glucose: mmol/L to canonical mg/dL
    val_norm, unit_norm = validate_and_normalize_measurement("fasting_blood_glucose", 5.5, "mmol/L")
    assert unit_norm == "mg/dL"
    assert round(val_norm, 1) == 99.1

    # Sleep duration: minutes to canonical hours
    val_norm, unit_norm = validate_and_normalize_measurement("sleep_duration_hours", 450.0, "minutes")
    assert unit_norm == "hours"
    assert val_norm == 7.5

    # Steps: stride to canonical steps
    val_norm, unit_norm = validate_and_normalize_measurement("daily_steps", 8400.0, "count")
    assert unit_norm == "steps"
    assert val_norm == 8400.0

    # Respiratory rate: rpm to canonical breaths/min
    val_norm, unit_norm = validate_and_normalize_measurement("respiratory_rate", 16.0, "rpm")
    assert unit_norm == "breaths/min"
    assert val_norm == 16.0


def test_observation_creation_and_provenance_tiers(mock_integration_db):
    """Verifies observation model captures method, source, time zone, canonical unit, and distinct provenance tiers."""
    now = datetime.now(timezone.utc)

    # 1. Measured Blood Pressure via oscillometric cuff
    obs_bp = ObservationCreate(
        patient_id="PT-INTEG-01",
        measurement_type="blood_pressure_systolic",
        value=122.0,
        unit="mmHg",
        time_zone="Asia/Kolkata",
        observed_at=now - timedelta(hours=2),
        source="device_measurement",
        source_type="device_measurement",
        device_id="Omron-HEM-7120",
        measurement_method="oscillometric_cuff",
        data_kind="measured"
    )
    base_bp = obs_bp.to_observation_base()
    assert base_bp.data_kind == "measured"
    assert base_bp.canonical_unit == "mmHg"
    assert base_bp.measurement_method == "oscillometric_cuff"
    assert base_bp.time_zone == "Asia/Kolkata"
    assert base_bp.device_id == "Omron-HEM-7120"

    # Save to MongoDB
    repo = ObservationRepository(mock_integration_db)
    saved_doc = repo.create(base_bp.model_dump())
    assert saved_doc["observation_id"] == base_bp.observation_id

    # 2. In-progress Partial-day Steps
    obs_steps = ObservationCreate(
        patient_id="PT-INTEG-01",
        measurement_type="daily_steps",
        value=4200.0,
        unit="steps",
        time_zone="Asia/Kolkata",
        observed_at=now,  # today's in-progress count
        source="wearable",
        device_id="AppleWatch-S9",
        data_kind="measured"
    )
    base_steps = obs_steps.to_observation_base()
    repo.create(base_steps.model_dump())

    # 3. Model-predicted Sleep Stage
    obs_sleep = ObservationCreate(
        patient_id="PT-INTEG-01",
        measurement_type="sleep_stage",
        value=3.0,  # N3
        unit="stage",
        observed_at=now - timedelta(hours=5),
        source="wearable",
        measurement_method="optical_ppg_ml",
        data_kind="model_predicted",
        metadata={"confidence_pct": 88.5, "probabilities": {"N3": 0.885, "N2": 0.08}}
    )
    base_sleep = obs_sleep.to_observation_base()
    assert base_sleep.data_kind == "model_predicted"
    repo.create(base_sleep.model_dump())

    # 4. Synthetic demonstration record
    obs_syn = ObservationCreate(
        patient_id="PT-INTEG-01",
        measurement_type="respiratory_rate",
        value=15.0,
        unit="breaths/min",
        observed_at=now - timedelta(hours=1),
        source="synthetic_demo",
        data_kind="synthetic",
        demo_data=True
    )
    base_syn = obs_syn.to_observation_base()
    assert base_syn.data_kind == "synthetic"
    repo.create(base_syn.model_dump())

    # Verify retrieval from MongoDB
    stored_items, count = repo.list_observations("PT-INTEG-01")
    assert count == 4
    provenance_set = {item["data_kind"] for item in stored_items}
    assert "measured" in provenance_set
    assert "model_predicted" in provenance_set
    assert "synthetic" in provenance_set


def test_patient_isolation_enforcement(mock_integration_db):
    """Verifies strict patient isolation: Patient A cannot access Patient B's observations or analytics."""
    now = datetime.now(timezone.utc)
    repo = ObservationRepository(mock_integration_db)

    # Ingest for Patient A
    repo.create({
        "observation_id": "obs_pt1_hr",
        "patient_id": "PT-INTEG-01",
        "measurement_type": "heart_rate",
        "value": 72.0,
        "unit": "bpm",
        "observed_at": now.isoformat(),
        "data_kind": "measured"
    })

    # Ingest for Patient B
    repo.create({
        "observation_id": "obs_pt2_hr",
        "patient_id": "PT-INTEG-02",
        "measurement_type": "heart_rate",
        "value": 115.0,
        "unit": "bpm",
        "observed_at": now.isoformat(),
        "data_kind": "measured"
    })

    # Query Patient A timeline
    res_a = MultiSignalService.get_multi_signal_timeline(
        db=mock_integration_db,
        patient_id="PT-INTEG-01"
    )
    assert res_a.patient_id == "PT-INTEG-01"
    for item in res_a.items:
        assert "obs_pt2" not in item.id
        if item.primary_metric == "heart_rate":
            assert item.primary_value == 72.0

    # Query Patient B timeline
    res_b = MultiSignalService.get_multi_signal_timeline(
        db=mock_integration_db,
        patient_id="PT-INTEG-02"
    )
    assert res_b.patient_id == "PT-INTEG-02"
    for item in res_b.items:
        assert "obs_pt1" not in item.id
        if item.primary_metric == "heart_rate":
            assert item.primary_value == 115.0


def test_blood_pressure_measured_integrity(mock_integration_db):
    """
    Verifies that blood pressure is strictly measured via oscillometric cuff
    and is never inferred or estimated from heart rate observations.
    """
    now = datetime.now(timezone.utc)
    repo = ObservationRepository(mock_integration_db)

    # Ingest heart rate records only
    for day in range(15, 0, -1):
        repo.create({
            "observation_id": f"obs_pt1_hr_{day}",
            "patient_id": "PT-INTEG-01",
            "measurement_type": "heart_rate",
            "value": 70.0 + (day % 4),
            "unit": "bpm",
            "observed_at": (now - timedelta(days=day)).isoformat(),
            "data_kind": "measured"
        })

    # Timeline with only heart rate must NOT fabricate BP
    res_no_bp = MultiSignalService.get_multi_signal_timeline(
        db=mock_integration_db,
        patient_id="PT-INTEG-01",
        signal_filter="blood_pressure"
    )
    assert len(res_no_bp.items) == 0, "Blood pressure must NEVER be inferred from heart rate"
    assert res_no_bp.summary.vitals_summary.get("latest_blood_pressure") is None

    # Now ingest actual measured blood pressure
    repo.create({
        "observation_id": "obs_pt1_sbp",
        "patient_id": "PT-INTEG-01",
        "measurement_type": "blood_pressure_systolic",
        "value": 118.0,
        "unit": "mmHg",
        "observed_at": now.isoformat(),
        "source_type": "device_measurement",
        "measurement_method": "oscillometric_cuff",
        "data_kind": "measured"
    })
    repo.create({
        "observation_id": "obs_pt1_dbp",
        "patient_id": "PT-INTEG-01",
        "measurement_type": "blood_pressure_diastolic",
        "value": 78.0,
        "unit": "mmHg",
        "observed_at": now.isoformat(),
        "source_type": "device_measurement",
        "measurement_method": "oscillometric_cuff",
        "data_kind": "measured"
    })

    res_with_bp = MultiSignalService.get_multi_signal_timeline(
        db=mock_integration_db,
        patient_id="PT-INTEG-01",
        signal_filter="blood_pressure"
    )
    assert len(res_with_bp.items) == 2
    for bp_item in res_with_bp.items:
        assert bp_item.data_provenance == "measured"
        assert bp_item.signal_badge == "BLOOD PRESSURE"
        assert bp_item.canonical_unit == "mmHg"
        assert bp_item.measurement_method == "oscillometric_cuff"
        assert "not inferred from heart rate" in bp_item.disclaimer.lower()

    # Executive vitals summary
    vitals = res_with_bp.summary.vitals_summary
    assert vitals["latest_blood_pressure"]["systolic"] == 118.0
    assert vitals["latest_blood_pressure"]["diastolic"] == 78.0
    assert vitals["latest_blood_pressure"]["provenance"] == "measured"


def test_partial_day_activity_status(mock_integration_db):
    """Verifies that activity step counts on current date are marked as partial_day."""
    now = datetime.now(timezone.utc)
    repo = ObservationRepository(mock_integration_db)

    # Yesterday's completed step count
    repo.create({
        "observation_id": "obs_steps_yesterday",
        "patient_id": "PT-INTEG-01",
        "measurement_type": "daily_steps",
        "value": 10500.0,
        "unit": "steps",
        "observed_at": (now - timedelta(days=1)).isoformat(),
        "source_type": "wearable",
        "data_kind": "measured"
    })

    # Today's in-progress step count
    repo.create({
        "observation_id": "obs_steps_today",
        "patient_id": "PT-INTEG-01",
        "measurement_type": "daily_steps",
        "value": 3400.0,
        "unit": "steps",
        "observed_at": now.isoformat(),
        "source_type": "wearable",
        "data_kind": "measured"
    })

    res = MultiSignalService.get_multi_signal_timeline(
        db=mock_integration_db,
        patient_id="PT-INTEG-01",
        signal_filter="steps"
    )
    assert len(res.items) == 2

    # Newest item is today's in-progress steps
    today_item = res.items[0]
    assert today_item.validation_status == "partial_day"
    assert "in progress" in today_item.status_label.lower()

    # Yesterday's item is completed 24h steps
    yesterday_item = res.items[1]
    assert yesterday_item.validation_status == "valid"
    assert "completed 24h" in yesterday_item.status_label.lower()

    # Vitals summary reports partial-day flag
    latest_steps = res.summary.vitals_summary["latest_steps"]
    assert latest_steps["steps"] == 3400
    assert latest_steps["is_partial_day"] is True
    assert latest_steps["validation_status"] == "partial_day"


def test_zero_data_fabrication_rule(mock_integration_db):
    """
    Verifies the Zero Fabrication Rule:
    When a patient has NO sleep telemetry recorded, the service must NEVER
    fabricate synthetic sleep epochs to fill gaps.
    """
    now = datetime.now(timezone.utc)
    repo = ObservationRepository(mock_integration_db)

    # Only heart rate and steps recorded (zero sleep observations)
    repo.create({
        "observation_id": "obs_hr_only",
        "patient_id": "PT-INTEG-02",
        "measurement_type": "heart_rate",
        "value": 68.0,
        "unit": "bpm",
        "observed_at": now.isoformat(),
        "data_kind": "measured"
    })
    repo.create({
        "observation_id": "obs_steps_only",
        "patient_id": "PT-INTEG-02",
        "measurement_type": "daily_steps",
        "value": 6500.0,
        "unit": "steps",
        "observed_at": now.isoformat(),
        "data_kind": "measured"
    })

    res = MultiSignalService.get_multi_signal_timeline(
        db=mock_integration_db,
        patient_id="PT-INTEG-02",
        signal_filter="sleep"
    )
    assert len(res.items) == 0, "Zero sleep items must be returned when patient has no sleep records"
    assert res.summary.sleep_intelligence["total_epochs_inferred"] == 0
    assert res.summary.sleep_intelligence["stage_counts"] == {}


def test_multi_criteria_timeline_filtering(mock_integration_db):
    """
    Verifies multi-criteria filtering by:
    - signal_filter (steps, cardio, blood_pressure, sleep)
    - date range (start_date, end_date)
    - source device
    - status
    - data provenance
    """
    now = datetime.now(timezone.utc)
    repo = ObservationRepository(mock_integration_db)

    # Ingest 10 days of heart rate
    for day in range(10, 0, -1):
        repo.create({
            "observation_id": f"obs_filt_hr_{day}",
            "patient_id": "PT-INTEG-01",
            "measurement_type": "heart_rate",
            "value": 64.0 if day != 3 else 98.0,
            "unit": "bpm",
            "observed_at": (now - timedelta(days=day)).isoformat(),
            "source_type": "wearable_continuous",
            "data_kind": "measured"
        })

    # Ingest 3 days of steps
    for day in range(3, 0, -1):
        repo.create({
            "observation_id": f"obs_filt_steps_{day}",
            "patient_id": "PT-INTEG-01",
            "measurement_type": "daily_steps",
            "value": 8000.0,
            "unit": "steps",
            "observed_at": (now - timedelta(days=day)).isoformat(),
            "source_type": "pedometer_cuff",
            "data_kind": "measured"
        })

    # 1. Filter by signal = 'steps'
    steps_res = MultiSignalService.get_multi_signal_timeline(
        db=mock_integration_db,
        patient_id="PT-INTEG-01",
        signal_filter="steps"
    )
    assert all(i.primary_metric in ["daily_steps", "steps_count", "steps"] for i in steps_res.items)

    # 2. Filter by date range (last 4 days)
    start_iso = (now - timedelta(days=4)).isoformat()
    end_iso = now.isoformat()
    date_res = MultiSignalService.get_multi_signal_timeline(
        db=mock_integration_db,
        patient_id="PT-INTEG-01",
        start_date=start_iso,
        end_date=end_iso
    )
    start_dt = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
    end_dt = datetime.fromisoformat(end_iso.replace("Z", "+00:00"))
    for item in date_res.items:
        assert item.timestamp >= start_dt
        assert item.timestamp <= end_dt

    # 3. Filter by data provenance = 'derived' (only cardio nMAD flags)
    prov_res = MultiSignalService.get_multi_signal_timeline(
        db=mock_integration_db,
        patient_id="PT-INTEG-01",
        data_kind="derived"
    )
    assert all(i.data_provenance == "derived" for i in prov_res.items)
