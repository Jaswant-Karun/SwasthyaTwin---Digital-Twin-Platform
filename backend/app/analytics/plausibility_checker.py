"""
SwasthyaTwin Clinical Plausibility & Input Quality Audit Engine
Implements multi-tiered data quality verification:
1. Hard Physical Impossibility Limits (Hard Rejection)
2. Soft Clinical Plausibility Limits (Requires User Confirmation)
3. Multi-Variate Hemodynamic Consistency Checks
4. Temporal Plausibility (Future timestamp rejection)
Backed by documented standards (AHA/ACC, ADA, WHO, ISO 81060-2).
"""

from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple
import math

# Hard limits: values physically impossible for living human beings
HARD_LIMITS: Dict[str, Dict[str, Any]] = {
    "heart_rate": {
        "min": 25.0, "max": 260.0, "unit": "bpm",
        "standard": "AHA Clinical Cardiology & Extreme Human Survival Limits"
    },
    "blood_pressure_systolic": {
        "min": 45.0, "max": 300.0, "unit": "mmHg",
        "standard": "ISO 81060-2 Non-Invasive Sphygmomanometer Bounds"
    },
    "blood_pressure_diastolic": {
        "min": 25.0, "max": 180.0, "unit": "mmHg",
        "standard": "ISO 81060-2 Non-Invasive Sphygmomanometer Bounds"
    },
    "hrv_rmssd": {
        "min": 2.0, "max": 350.0, "unit": "ms",
        "standard": "ESC / NASPE Standards of Heart Rate Variability"
    },
    "sleep_duration_hours": {
        "min": 0.0, "max": 24.0, "unit": "hours",
        "standard": "24-Hour Diurnal Bounded Interval"
    },
    "daily_steps": {
        "min": 0.0, "max": 120000.0, "unit": "steps",
        "standard": "Extreme Ambulatory Upper Bound"
    },
    "spo2": {
        "min": 40.0, "max": 100.0, "unit": "%",
        "standard": "ISO 80601-2-61 Pulse Oximeter Standards"
    },
    "fasting_blood_glucose": {
        "min": 15.0, "max": 800.0, "unit": "mg/dL",
        "standard": "ADA 2024 Standards of Care (Profound Coma to Severe Ketoacidosis)"
    },
    "respiratory_rate": {
        "min": 4.0, "max": 70.0, "unit": "breaths/min",
        "standard": "Emergency Triage Respiration Envelope"
    },
    "body_weight": {
        "min": 15.0, "max": 450.0, "unit": "kg",
        "standard": "Clinical Anthropometric Bounds"
    },
    "body_temperature": {
        "min": 28.0, "max": 44.0, "unit": "Celsius",
        "standard": "Hypothermia / Severe Hyperpyrexia Boundary"
    }
}

# Soft limits: atypical, subclinical, or suspicious readings requiring explicit user confirmation
SOFT_LIMITS: Dict[str, Dict[str, Any]] = {
    "heart_rate": {
        "min": 45.0, "max": 145.0, "unit": "bpm",
        "rationale": "Resting bradycardia (<45 bpm) or resting tachycardia (>145 bpm) outside normal resting range."
    },
    "blood_pressure_systolic": {
        "min": 85.0, "max": 180.0, "unit": "mmHg",
        "rationale": "Hypotension (<85 mmHg) or Stage 2 / Hypertensive Crisis urgency (>180 mmHg, AHA 2017)."
    },
    "blood_pressure_diastolic": {
        "min": 50.0, "max": 115.0, "unit": "mmHg",
        "rationale": "Severe diastolic hypotension (<50 mmHg) or severe diastolic elevation (>115 mmHg)."
    },
    "hrv_rmssd": {
        "min": 10.0, "max": 180.0, "unit": "ms",
        "rationale": "Severe parasympathetic depletion (<10 ms) or atypical sinus spike (>180 ms)."
    },
    "sleep_duration_hours": {
        "min": 3.0, "max": 13.0, "unit": "hours",
        "rationale": "Acute sleep deprivation (<3h) or hypersomnolence (>13h)."
    },
    "daily_steps": {
        "min": 100.0, "max": 35000.0, "unit": "steps",
        "rationale": "Severe sedentary immobilization (<100 steps) or ultra-endurance activity (>35,000 steps)."
    },
    "spo2": {
        "min": 90.0, "max": 100.0, "unit": "%",
        "rationale": "Oxygen desaturation (<90%) indicates subclinical respiratory strain."
    },
    "fasting_blood_glucose": {
        "min": 60.0, "max": 250.0, "unit": "mg/dL",
        "rationale": "Hypoglycemia risk (<60 mg/dL) or marked uncontrolled hyperglycemia (>250 mg/dL)."
    },
    "respiratory_rate": {
        "min": 8.0, "max": 32.0, "unit": "breaths/min",
        "rationale": "Bradypnea (<8) or tachypneic distress (>32 breaths/min)."
    },
    "body_weight": {
        "min": 35.0, "max": 200.0, "unit": "kg",
        "rationale": "Atypical adult weight deviation."
    },
    "body_temperature": {
        "min": 35.5, "max": 39.5, "unit": "Celsius",
        "rationale": "Mild hypothermia (<35.5°C) or high-grade fever (>39.5°C)."
    }
}

class PlausibilityCheckResult:
    def __init__(
        self,
        is_technically_valid: bool,
        is_unusual: bool,
        requires_confirmation: bool,
        validation_status: str,
        errors: List[str],
        warnings: List[str],
        suggested_correction: Optional[float] = None
    ):
        self.is_technically_valid = is_technically_valid
        self.is_unusual = is_unusual
        self.requires_confirmation = requires_confirmation
        self.validation_status = validation_status
        self.errors = errors
        self.warnings = warnings
        self.suggested_correction = suggested_correction

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_technically_valid": self.is_technically_valid,
            "is_unusual": self.is_unusual,
            "requires_confirmation": self.requires_confirmation,
            "validation_status": self.validation_status,
            "errors": self.errors,
            "warnings": self.warnings,
            "suggested_correction": self.suggested_correction
        }

def audit_observation_plausibility(
    measurement_type: str,
    value: float,
    unit: str,
    observed_at: datetime,
    confirmed_by_user: bool = False,
    paired_measurements: Optional[Dict[str, float]] = None
) -> PlausibilityCheckResult:
    """
    Executes multi-stage data quality audit:
    1. Checks numeric validity (NaN, Inf)
    2. Checks temporal validity (impossible future or pre-1970 timestamp)
    3. Checks hard physiological bounds (rejects impossible readings)
    4. Detects typos (e.g. 700 bpm -> suggests 70 bpm)
    5. Checks multi-variate consistency (diastolic >= systolic)
    6. Checks soft bounds: if unusual and not confirmed, requests user confirmation.
    """
    m_type = measurement_type.strip().lower()
    errors: List[str] = []
    warnings: List[str] = []
    suggested_val: Optional[float] = None

    # 1. Numeric integrity
    if math.isnan(value) or math.isinf(value):
        errors.append(f"Value '{value}' is not a finite numeric quantity.")
        return PlausibilityCheckResult(False, False, False, "rejected", errors, warnings)

    # 2. Temporal plausibility
    now_utc = datetime.now(timezone.utc)
    # Ensure observed_at is timezone-aware
    if observed_at.tzinfo is None:
        observed_at = observed_at.replace(tzinfo=timezone.utc)

    # Future date check (allow max 5 min clock skew tolerance)
    if observed_at > now_utc + timedelta(minutes=5):
        errors.append(
            f"Impossible future timestamp '{observed_at.isoformat()}'. "
            f"Measurement timestamp cannot be in the future (current system time: {now_utc.isoformat()})."
        )

    # Pre-1970 historical check
    if observed_at < datetime(1970, 1, 1, tzinfo=timezone.utc):
        errors.append(f"Impossible historical timestamp '{observed_at.isoformat()}': precedes epoch year 1970.")

    # 3. Hard bounds check
    if m_type in HARD_LIMITS:
        h_spec = HARD_LIMITS[m_type]
        if value < h_spec["min"] or value > h_spec["max"]:
            errors.append(
                f"Physiologically impossible value: {value} {unit} is outside human survival limits "
                f"({h_spec['min']} to {h_spec['max']} {h_spec['unit']}). Reference: {h_spec['standard']}."
            )
            # Detect common order-of-magnitude typos
            if value > h_spec["max"] and (value / 10.0) <= h_spec["max"]:
                suggested_val = round(value / 10.0, 1)
            elif value < h_spec["min"] and (value * 10.0) >= h_spec["min"]:
                suggested_val = round(value * 10.0, 1)

    # 4. Multi-variate joint consistency check
    if paired_measurements:
        if m_type == "blood_pressure_systolic" and "blood_pressure_diastolic" in paired_measurements:
            dbp = float(paired_measurements["blood_pressure_diastolic"])
            if value <= dbp:
                errors.append(
                    f"Inconsistent hemodynamics: Systolic BP ({value} mmHg) must be strictly greater than Diastolic BP ({dbp} mmHg)."
                )
            elif (value - dbp) < 15.0:
                warnings.append(
                    f"Critically narrow pulse pressure ({value - dbp:.1f} mmHg). Normal resting pulse pressure is 30–50 mmHg."
                )
            elif (value - dbp) > 110.0:
                warnings.append(
                    f"Widened pulse pressure ({value - dbp:.1f} mmHg). Suggests marked arterial stiffness or high stroke volume."
                )

        elif m_type == "blood_pressure_diastolic" and "blood_pressure_systolic" in paired_measurements:
            sbp = float(paired_measurements["blood_pressure_systolic"])
            if value >= sbp:
                errors.append(
                    f"Inconsistent hemodynamics: Diastolic BP ({value} mmHg) cannot equal or exceed Systolic BP ({sbp} mmHg)."
                )

    # If hard errors occurred, reject immediately
    if errors:
        return PlausibilityCheckResult(
            is_technically_valid=False,
            is_unusual=False,
            requires_confirmation=False,
            validation_status="rejected",
            errors=errors,
            warnings=warnings,
            suggested_correction=suggested_val
        )

    # 5. Soft bounds check (Suspicious / Unusual measurements)
    is_unusual = False
    requires_conf = False
    if m_type in SOFT_LIMITS:
        s_spec = SOFT_LIMITS[m_type]
        if value < s_spec["min"] or value > s_spec["max"]:
            is_unusual = True
            msg = (
                f"Unusual measurement: {value} {unit} is outside typical resting bounds "
                f"({s_spec['min']}–{s_spec['max']} {s_spec['unit']}). {s_spec['rationale']}"
            )
            warnings.append(msg)
            if not confirmed_by_user:
                requires_conf = True

    # Determine final validation status
    if requires_conf:
        val_status = "requires_confirmation"
    elif is_unusual and confirmed_by_user:
        val_status = "confirmed_unusual"
    elif warnings:
        val_status = "valid_with_warnings"
    else:
        val_status = "valid"

    return PlausibilityCheckResult(
        is_technically_valid=True,
        is_unusual=is_unusual,
        requires_confirmation=requires_conf,
        validation_status=val_status,
        errors=[],
        warnings=warnings,
        suggested_correction=suggested_val
    )
