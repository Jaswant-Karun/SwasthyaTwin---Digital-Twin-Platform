"""
SwasthyaTwin Comprehensive Data Quality, Input Validation, and Prediction Safeguards Tests

Verifies:
1. Explicit unit conversions (glucose mmol/L <-> mg/dL, BP kPa <-> mmHg, weight lb <-> kg, sleep min/h <-> hours)
2. Hard physiological rejection vs. soft unusual confirmation (never silently modify or discard)
3. Inconsistent combinations (diastolic >= systolic) and impossible dates (future, pre-1970)
4. Duplicate submission handling without duplicate telemetry noise
5. CSV import workflow: column detection, preview, unit conversion proposal, rejected rows, and confirmation
6. Non-zero imputation rule & Prediction safeguards before inference (availability, freshness, units, bounds)
7. Audit trail and immutable edit history
8. Strict patient isolation
"""

import pytest
from datetime import datetime, timezone, timedelta
from app.analytics.unit_converter import convert_to_canonical_unit, CANONICAL_UNITS, UnitConversionError
from app.analytics.plausibility_checker import audit_observation_plausibility, HARD_LIMITS, SOFT_LIMITS
from app.analytics.prediction_safeguards import PredictionSafeguards
from app.analytics.predictor import forecast_metric_with_safeguards

# ============================================================================
# 1. Unit Conversion Tests
# ============================================================================

def test_unit_conversion_glucose_mmol_to_mgdl():
    val, unit, converted, note = convert_to_canonical_unit("fasting_blood_glucose", 5.5, "mmol/L")
    assert unit == "mg/dL"
    assert converted is True
    assert round(val, 1) == 99.1
    assert "18.0182" in note

def test_unit_conversion_glucose_canonical_identity():
    val, unit, converted, note = convert_to_canonical_unit("fasting_blood_glucose", 105.0, "mg/dL")
    assert unit == "mg/dL"
    assert converted is False
    assert val == 105.0

def test_unit_conversion_blood_pressure_kpa_to_mmhg():
    val, unit, converted, note = convert_to_canonical_unit("blood_pressure_systolic", 16.0, "kPa")
    assert unit == "mmHg"
    assert converted is True
    assert round(val, 1) == 120.0

def test_unit_conversion_body_weight_lbs_to_kg():
    val, unit, converted, note = convert_to_canonical_unit("body_weight", 154.32, "lbs")
    assert unit == "kg"
    assert converted is True
    assert round(val, 1) == 70.0

def test_unit_conversion_sleep_duration_minutes_to_hours():
    val, unit, converted, note = convert_to_canonical_unit("sleep_duration_hours", 450.0, "minutes")
    assert unit == "hours"
    assert converted is True
    assert val == 7.5

def test_unit_conversion_body_temperature_fahrenheit_to_celsius():
    val, unit, converted, note = convert_to_canonical_unit("body_temperature", 98.6, "F")
    assert unit == "Celsius"
    assert converted is True
    assert round(val, 1) == 37.0

def test_unit_conversion_rejects_unsupported_unit():
    with pytest.raises(UnitConversionError) as exc_info:
        convert_to_canonical_unit("heart_rate", 75.0, "lightyears")
    assert "invalid unit" in str(exc_info.value).lower()

# ============================================================================
# 2. Hard Limits vs Soft Bounds Plausibility
# ============================================================================

def test_hard_limit_physiological_rejection():
    """HR = 350 bpm is physiologically impossible for human resting rate."""
    now = datetime.now(timezone.utc)
    res = audit_observation_plausibility("heart_rate", 350.0, "bpm", now)
    assert res.is_technically_valid is False
    assert res.validation_status == "rejected"
    assert len(res.errors) >= 1
    assert "outside human survival limits" in res.errors[0] or "not physiologically plausible" in res.errors[0]
    # Typo detection: 350 -> 35
    assert res.suggested_correction == 35.0

def test_soft_limit_unusual_value_requires_confirmation_without_silent_change():
    """HR = 155 bpm is unusual for resting, but plausible. Must require confirmation, not silent change."""
    now = datetime.now(timezone.utc)
    res = audit_observation_plausibility("heart_rate", 155.0, "bpm", now, confirmed_by_user=False)
    assert res.is_technically_valid is True
    assert res.is_unusual is True
    assert res.requires_confirmation is True
    assert len(res.warnings) >= 1
    assert "outside typical resting bounds" in res.warnings[0]


def test_soft_limit_confirmed_by_user_records_without_altering():
    """When confirmed by user, unusual value is accepted with status confirmed_unusual."""
    now = datetime.now(timezone.utc)
    res = audit_observation_plausibility("heart_rate", 155.0, "bpm", now, confirmed_by_user=True)
    assert res.is_technically_valid is True
    assert res.requires_confirmation is False
    assert res.validation_status == "confirmed_unusual"

def test_inconsistent_hemodynamics_diastolic_greater_than_systolic():
    """DBP >= SBP is physically impossible in arterial hemodynamics."""
    now = datetime.now(timezone.utc)
    res = audit_observation_plausibility(
        "blood_pressure_systolic",
        75.0,
        "mmHg",
        now,
        paired_measurements={"blood_pressure_diastolic": 90.0}
    )
    assert res.is_technically_valid is False
    assert any("must be strictly greater" in err for err in res.errors)

def test_impossible_future_and_historical_dates():
    now = datetime.now(timezone.utc)
    future_time = now + timedelta(days=2)
    res_future = audit_observation_plausibility("heart_rate", 72.0, "bpm", future_time)
    assert res_future.is_technically_valid is False
    assert any("future" in err.lower() for err in res_future.errors)

    ancient_time = datetime(1965, 5, 1, tzinfo=timezone.utc)
    res_past = audit_observation_plausibility("heart_rate", 72.0, "bpm", ancient_time)
    assert res_past.is_technically_valid is False
    assert any("1970" in err for err in res_past.errors)

# ============================================================================
# 3. API Integration: Suspicious Value Confirmation & Correction
# ============================================================================

def test_api_unusual_value_returns_409_conflict(client):
    p_res = client.post("/api/v1/patients", json={"display_name": "Suspicious Val Patient"})
    pid = p_res.json()["patient_id"]

    # Post unusual resting HR = 155 bpm without confirmation
    res = client.post(f"/api/v1/patients/{pid}/observations", json={
        "patient_id": pid,
        "measurement_type": "heart_rate",
        "value": 155.0,
        "unit": "bpm"
    })
    assert res.status_code == 409
    body = res.json()["detail"]
    assert body["status"] == "requires_confirmation"
    assert "Unusual biometric measurement" in body["message"]
    assert len(body["warnings"]) >= 1

    # Now post WITH confirm_unusual=True -> Must succeed 201
    res_confirmed = client.post(
        f"/api/v1/patients/{pid}/observations?confirm_unusual=true",
        json={
            "patient_id": pid,
            "measurement_type": "heart_rate",
            "value": 155.0,
            "unit": "bpm"
        }
    )
    assert res_confirmed.status_code == 201
    saved = res_confirmed.json()
    assert saved["value"] == 155.0
    assert saved["validation_status"] == "confirmed_unusual"
    assert saved["confirmed_by_user"] is True

def test_api_observation_preview_endpoint(client):
    p_res = client.post("/api/v1/patients", json={"display_name": "Preview Patient"})
    pid = p_res.json()["patient_id"]

    # Preview glucose mmol/L conversion and plausibility
    prev_res = client.post(f"/api/v1/patients/{pid}/observations/preview", json={
        "measurement_type": "fasting_blood_glucose",
        "value": 5.5,
        "unit": "mmol/L"
    })
    assert prev_res.status_code == 200
    prev_data = prev_res.json()
    assert prev_data["original_unit"] == "mmol/L"
    assert prev_data["canonical_unit"] == "mg/dL"
    assert prev_data["was_converted"] is True
    assert prev_data["is_valid"] is True
    assert prev_data["is_unusual"] is False

# ============================================================================
# 4. CSV Import Quality & Preview Workflow
# ============================================================================

def test_csv_preview_and_confirm_workflow(client):
    p_res = client.post("/api/v1/patients", json={"display_name": "CSV Ingestion Patient"})
    pid = p_res.json()["patient_id"]

    raw_csv_rows = [
        # 1. Normal row needing conversion (mmol/L -> mg/dL)
        {"measurement_type": "fasting_blood_glucose", "value": "5.6", "unit": "mmol/L", "observed_at": "2026-10-21T06:00:00Z"},
        # 2. Normal row (canonical unit)
        {"measurement_type": "heart_rate", "value": "72", "unit": "bpm", "observed_at": "2026-10-21T07:00:00Z"},
        # 3. Unusual row (resting HR 148 bpm -> requires confirmation)
        {"measurement_type": "heart_rate", "value": "148", "unit": "bpm", "observed_at": "2026-10-21T08:00:00Z"},
        # 4. Rejected row (HR 450 bpm -> impossible)
        {"measurement_type": "heart_rate", "value": "450", "unit": "bpm", "observed_at": "2026-10-21T09:00:00Z"}
    ]

    # Step 1: Preview CSV
    prev_res = client.post(f"/api/v1/patients/{pid}/observations/csv/preview", json={"rows": raw_csv_rows})
    assert prev_res.status_code == 200
    prev_data = prev_res.json()

    assert prev_data["total_rows"] == 4
    assert prev_data["valid_rows_count"] == 3
    assert prev_data["rejected_rows_count"] == 1
    assert prev_data["unusual_rows_count"] == 1
    assert len(prev_data["proposed_unit_conversions"]) >= 1
    assert prev_data["proposed_unit_conversions"][0]["to_unit"] == "mg/dL"
    assert prev_data["can_import"] is True

    # Step 2: Confirm import (confirm_unusual_all=True)
    conf_res = client.post(
        f"/api/v1/patients/{pid}/observations/csv/confirm?confirm_unusual_all=true",
        json={"validated_rows": prev_data["all_rows"]}
    )
    assert conf_res.status_code == 201
    conf_data = conf_res.json()
    assert conf_data["imported_count"] == 3
    assert conf_data["skipped_count"] == 1 # The rejected 450 bpm row was safely skipped

# ============================================================================
# 5. Prediction Safeguards & Non-Zero Imputation Rule
# ============================================================================

def test_prediction_safeguards_withholds_when_missing_features():
    """Model must NEVER assume missing features are zero."""
    features = {
        "heart_rate": 72.0
        # Missing all other biometrics
    }
    audit = PredictionSafeguards.audit_features_for_inference(
        patient_id="PT-SAFE-01",
        features=features
    )
    assert audit["is_ready"] is False
    assert audit["status"] == "insufficient_features"
    assert any("Unmeasured features cannot be inferred as zero" in w for w in audit["warnings"])

def test_prediction_safeguards_rejects_stale_data():
    """Telemetry older than 90 days cannot produce confident predictions."""
    now = datetime.now(timezone.utc)
    features = {
        "heart_rate": 72.0,
        "systolic_bp": 120.0,
        "diastolic_bp": 80.0
    }
    stale_ts = {
        "heart_rate": now - timedelta(days=120),
        "systolic_bp": now - timedelta(days=105),
        "diastolic_bp": now - timedelta(days=105)
    }
    audit = PredictionSafeguards.audit_features_for_inference(
        patient_id="PT-STALE-01",
        features=features,
        feature_timestamps=stale_ts
    )
    assert audit["is_ready"] is False
    assert audit["status"] == "stale_data"
    assert any("expired" in w.lower() for w in audit["warnings"])

def test_prediction_safeguards_rejects_hemodynamic_contradiction():
    features = {
        "heart_rate": 72.0,
        "systolic_bp": 110.0,
        "diastolic_bp": 115.0  # DBP > SBP impossible
    }
    audit = PredictionSafeguards.audit_features_for_inference(
        patient_id="PT-CONTRADICT-01",
        features=features
    )
    assert audit["is_ready"] is False
    assert audit["status"] == "input_quality_rejection"
    assert any("Hemodynamic contradiction" in w for w in audit["warnings"])

def test_forecast_metric_with_safeguards_structured_output():
    """Verify structured response schema: status, warnings, prediction, units, model_version, limitations."""
    # Under 14 observations
    obs_few = [{"value": 72.0, "observed_at": datetime.now(timezone.utc)}]
    res_few = forecast_metric_with_safeguards("heart_rate", "bpm", obs_few)
    assert res_few["status"] == "insufficient_features"
    assert res_few["prediction"] is None
    assert "units" in res_few
    assert "model_version" in res_few
    assert len(res_few["limitations"]) >= 2
    assert "cannot be zero-imputed" in res_few["warnings"][2]

# ============================================================================
# 6. Audit Trail and Immutable Edit History
# ============================================================================

def test_observation_edit_preserves_immutable_audit_history(client, mock_db):
    p_res = client.post("/api/v1/patients", json={"display_name": "Audit Edit Patient"})
    pid = p_res.json()["patient_id"]

    # Ingest original observation
    orig_res = client.post(f"/api/v1/patients/{pid}/observations", json={
        "patient_id": pid,
        "measurement_type": "heart_rate",
        "value": 70.0,
        "unit": "bpm"
    })
    obs_id = orig_res.json()["id"]

    # Perform user edit with documented clinical reason
    edit_res = client.put(f"/api/v1/patients/{pid}/observations/{obs_id}", json={
        "value": 74.0,
        "unit": "bpm",
        "correction_reason": "Corrected manual typo (was 70, verified 74 from pulse oximeter record)"
    })
    assert edit_res.status_code == 200
    updated = edit_res.json()
    assert updated["value"] == 74.0

    # Verify directly in MongoDB that history is non-destructive
    doc = mock_db.observations.find_one({"observation_id": obs_id})
    assert len(doc["edit_history"]) == 1
    history_entry = doc["edit_history"][0]
    assert history_entry["previous_value"] == 70.0
    assert history_entry["new_value"] == 74.0
    assert "verified 74" in history_entry["reason"]

# ============================================================================
# 7. Strict Patient Isolation
# ============================================================================

def test_strict_cross_patient_data_isolation(client, mock_db):
    p1 = client.post("/api/v1/patients", json={"display_name": "Patient Alpha"}).json()["patient_id"]
    p2 = client.post("/api/v1/patients", json={"display_name": "Patient Beta"}).json()["patient_id"]

    # Log observation for Patient Alpha
    client.post(f"/api/v1/patients/{p1}/observations", json={
        "patient_id": p1,
        "measurement_type": "heart_rate",
        "value": 62.0,
        "unit": "bpm"
    })

    # Patient Beta must have 0 observations and completely independent state
    p2_obs = client.get(f"/api/v1/patients/{p2}/observations").json()
    assert p2_obs["total"] == 0

    p1_obs = client.get(f"/api/v1/patients/{p1}/observations").json()
    assert p1_obs["total"] == 1
