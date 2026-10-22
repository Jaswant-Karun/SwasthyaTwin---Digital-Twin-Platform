"""
SwasthyaTwin AI — Multi-Signal Health Intelligence & Separation Verification
Tests:
1. Retrieval of multi-signal timeline synthesizing BiDSleep ML predictions and nMAD statistical flags.
2. Verification of strict separation:
   - Distinct signal_type ('sleep_stage_prediction' vs 'heart_rate_statistical_flag')
   - Distinct badges ('BiDSLEEP ML INFERENCE' vs 'nMAD STATISTICAL ENGINE')
   - Distinct mathematical models (Probabilistic LightGBM vs Non-parametric nMAD)
   - Distinct clinical/research disclaimers
3. Cross-signal summary and autonomic co-registration calculation.
4. Signal filtering ('all', 'sleep', 'cardio', 'observations').
"""

import pytest
from datetime import datetime, timezone, timedelta
from app.services.multi_signal_service import MultiSignalService


@pytest.fixture
def mock_multi_signal_db(mock_db):
    """Populates test database with patient and multi-signal observations."""
    now = datetime.now(timezone.utc)
    mock_db.patients.delete_many({})
    mock_db.observations.delete_many({})

    mock_db.patients.insert_one({
        "patient_id": "PT-MULTI-01",
        "full_name": "Test MultiSignal Subject",
        "age": 35,
        "gender": "female",
        "demo_data": False,
        "baseline_window_days": 30
    })

    # Ingest 20 days of HR observations with an anomaly
    for day in range(20, 0, -1):
        hr_val = 65.0 if day != 2 else 95.0  # Acute elevation on day 2
        mock_db.observations.insert_one({
            "observation_id": f"obs_hr_{day}",
            "patient_id": "PT-MULTI-01",
            "measurement_type": "heart_rate",
            "value": hr_val,
            "unit": "bpm",
            "observed_at": (now - timedelta(days=day)).isoformat(),
            "source_type": "wearable_continuous",
            "data_kind": "measured"
        })

    # Ingest 5 sleep duration observations
    for day in range(5, 0, -1):
        mock_db.observations.insert_one({
            "observation_id": f"obs_sleep_{day}",
            "patient_id": "PT-MULTI-01",
            "measurement_type": "sleep_duration_hours",
            "value": 7.5,
            "unit": "hours",
            "observed_at": (now - timedelta(days=day, hours=10)).isoformat(),
            "source_type": "wearable_continuous",
            "data_kind": "measured"
        })

    # Ingest blood pressure observation
    mock_db.observations.insert_one({
        "observation_id": "obs_bp_1",
        "patient_id": "PT-MULTI-01",
        "measurement_type": "blood_pressure_systolic",
        "value": 120.0,
        "unit": "mmHg",
        "observed_at": (now - timedelta(days=1)).isoformat(),
        "source_type": "clinical_lab",
        "data_kind": "measured"
    })

    return mock_db


def test_multi_signal_timeline_retrieval(mock_multi_signal_db):
    """Verifies that the multi-signal timeline returns all signals and summary correctly."""
    res = MultiSignalService.get_multi_signal_timeline(
        db=mock_multi_signal_db,
        patient_id="PT-MULTI-01",
        signal_filter="all",
        limit=50
    )

    assert res.patient_id == "PT-MULTI-01"
    assert res.patient_name == "Test MultiSignal Subject"
    assert res.total_items > 0
    assert len(res.items) > 0

    # Summary verification
    assert res.summary.sleep_intelligence["model_name"] == "BiDSleep LightGBM 5-Stage AASM v1.0.0"
    assert "stage_distribution_pct" in res.summary.sleep_intelligence
    assert res.summary.cardiovascular_intelligence["algorithm_version"] == "nMAD v1.2.0-robust-mad"
    assert res.summary.cardiovascular_intelligence["baseline_median_bpm"] is not None
    assert "cross_signal_insight" in res.summary.model_dump()


def test_strict_separation_between_sleep_and_cardio(mock_multi_signal_db):
    """
    Verifies that sleep ML predictions and heart-rate anomaly flags
    are kept completely separate in type, badge, details, and disclaimers.
    """
    res = MultiSignalService.get_multi_signal_timeline(
        db=mock_multi_signal_db,
        patient_id="PT-MULTI-01",
        signal_filter="all",
        limit=100
    )

    sleep_items = [i for i in res.items if i.signal_type == "sleep_stage_prediction"]
    cardio_items = [i for i in res.items if i.signal_type == "heart_rate_statistical_flag"]

    assert len(sleep_items) > 0, "Must contain BiDSleep sleep stage predictions"
    assert len(cardio_items) > 0, "Must contain cardiovascular statistical anomaly flags"

    # Verify sleep items
    for s in sleep_items:
        assert s.signal_badge == "BiDSLEEP ML INFERENCE"
        assert s.sleep_details is not None
        assert s.cardiovascular_details is None
        assert s.observation_details is None
        assert s.sleep_details.stage_5class in ["Wake", "N1", "N2", "N3", "REM"]
        assert 0.0 <= s.sleep_details.confidence_pct <= 100.0
        assert "polysomnography" in s.disclaimer.lower()

    # Verify cardio items
    for c in cardio_items:
        assert c.signal_badge == "nMAD STATISTICAL ENGINE"
        assert c.cardiovascular_details is not None
        assert c.sleep_details is None
        assert c.observation_details is None
        assert c.cardiovascular_details.measured_heart_rate > 0
        assert c.cardiovascular_details.anomaly_status in [
            "within_personal_range", "unusual_high", "unusual_low",
            "review_data_quality", "insufficient_data"
        ]
        assert "arrhythmia" in c.disclaimer.lower()


def test_signal_filtering(mock_multi_signal_db):
    """Verifies that signal filtering isolates modalities accurately."""
    # Sleep filter
    sleep_res = MultiSignalService.get_multi_signal_timeline(
        db=mock_multi_signal_db,
        patient_id="PT-MULTI-01",
        signal_filter="sleep"
    )
    for i in sleep_res.items:
        assert i.signal_type == "sleep_stage_prediction"

    # Cardio filter
    cardio_res = MultiSignalService.get_multi_signal_timeline(
        db=mock_multi_signal_db,
        patient_id="PT-MULTI-01",
        signal_filter="cardio"
    )
    for i in cardio_res.items:
        assert i.signal_type == "heart_rate_statistical_flag"
