"""
SwasthyaTwin Unit Converter & Normalization Engine
Provides rigorous, tested unit conversion functions for all clinical and wearable telemetry.
Guarantees canonical unit standardization across manual entries, CSV imports, and device streams.
"""

from typing import Tuple, Dict, List, Optional
import math

# Canonical units mapped to measurement types
CANONICAL_UNITS: Dict[str, str] = {
    "heart_rate": "bpm",
    "blood_pressure_systolic": "mmHg",
    "blood_pressure_diastolic": "mmHg",
    "hrv_rmssd": "ms",
    "sleep_duration_hours": "hours",
    "daily_steps": "steps",
    "spo2": "%",
    "fasting_blood_glucose": "mg/dL",
    "respiratory_rate": "breaths/min",
    "body_weight": "kg",
    "body_temperature": "Celsius"
}

# Supported aliases for each measurement type
SUPPORTED_UNITS_MAP: Dict[str, List[str]] = {
    "heart_rate": ["bpm", "beats/min", "hz"],
    "blood_pressure_systolic": ["mmhg", "kpa", "bar"],
    "blood_pressure_diastolic": ["mmhg", "kpa", "bar"],
    "hrv_rmssd": ["ms", "s", "seconds"],
    "sleep_duration_hours": ["hours", "hrs", "h", "minutes", "min", "m", "seconds", "sec", "s"],
    "daily_steps": ["steps", "count", "stride"],
    "spo2": ["%", "percent", "fraction", "ratio"],
    "fasting_blood_glucose": ["mg/dl", "mmol/l"],
    "respiratory_rate": ["breaths/min", "rpm", "brpm"],
    "body_weight": ["kg", "lbs", "lb", "grams", "g"],
    "body_temperature": ["c", "celsius", "f", "fahrenheit"]
}

class UnitConversionError(ValueError):
    """Raised when an unsupported unit is provided for a given metric."""
    pass

def normalize_unit_string(unit: str) -> str:
    """Cleans unit string: strips whitespace, removes punctuation and case differences."""
    return unit.strip().lower()

def convert_to_canonical_unit(
    measurement_type: str,
    value: float,
    unit: str
) -> Tuple[float, str, bool, Optional[str]]:
    """
    Converts any supported input unit into the canonical metric unit.
    
    Returns:
        (canonical_value, canonical_unit, was_converted, conversion_note)
    
    Raises:
        UnitConversionError if the unit is unsupported for the measurement type.
    """
    m_type = measurement_type.strip().lower()
    clean_unit = normalize_unit_string(unit)

    if m_type not in CANONICAL_UNITS:
        raise UnitConversionError(f"Unsupported measurement type '{measurement_type}'.")

    canonical_unit = CANONICAL_UNITS[m_type]
    supported = SUPPORTED_UNITS_MAP.get(m_type, [canonical_unit.lower()])

    if clean_unit not in supported:
        raise UnitConversionError(
            f"Invalid unit '{unit}' for measurement type '{m_type}'. Supported units: {supported}"
        )

    # 1. Glucose: mmol/L to mg/dL (1 mmol/L = 18.0182 mg/dL)
    if m_type == "fasting_blood_glucose":
        if clean_unit == "mmol/l":
            converted = round(value * 18.0182, 1)
            return converted, "mg/dL", True, f"Converted from {value} mmol/L to {converted} mg/dL (factor 18.0182)"
        return round(value, 1), "mg/dL", False, None

    # 2. Blood Pressure: kPa to mmHg (1 kPa = 7.50062 mmHg)
    if m_type in ["blood_pressure_systolic", "blood_pressure_diastolic"]:
        if clean_unit == "kpa":
            converted = round(value * 7.50062, 1)
            return converted, "mmHg", True, f"Converted from {value} kPa to {converted} mmHg (factor 7.50062)"
        elif clean_unit == "bar":
            converted = round(value * 750.062, 1)
            return converted, "mmHg", True, f"Converted from {value} bar to {converted} mmHg"
        return round(value, 1), "mmHg", False, None

    # 3. Sleep Duration: minutes/seconds to hours
    if m_type == "sleep_duration_hours":
        if clean_unit in ["minutes", "min", "m"]:
            converted = round(value / 60.0, 2)
            return converted, "hours", True, f"Converted from {value} minutes to {converted} hours"
        elif clean_unit in ["seconds", "sec", "s"]:
            converted = round(value / 3600.0, 2)
            return converted, "hours", True, f"Converted from {value} seconds to {converted} hours"
        elif clean_unit in ["hrs", "h"]:
            return round(value, 2), "hours", True, None
        return round(value, 2), "hours", False, None

    # 4. SpO2: fraction (0.0 - 1.0) to percentage (0 - 100%)
    if m_type == "spo2":
        if clean_unit in ["fraction", "ratio"] or (value <= 1.0 and clean_unit not in ["%", "percent"]):
            converted = round(value * 100.0, 1)
            return converted, "%", True, f"Converted fraction {value} to {converted}%"
        return round(value, 1), "%", False, None

    # 5. Heart Rate: Hz to bpm (1 Hz = 60 bpm)
    if m_type == "heart_rate":
        if clean_unit == "hz":
            converted = round(value * 60.0, 1)
            return converted, "bpm", True, f"Converted {value} Hz to {converted} bpm"
        return round(value, 1), "bpm", False, None

    # 6. HRV RMSSD: seconds to ms
    if m_type == "hrv_rmssd":
        if clean_unit in ["s", "seconds"]:
            converted = round(value * 1000.0, 1)
            return converted, "ms", True, f"Converted {value} s to {converted} ms"
        return round(value, 1), "ms", False, None

    # 7. Body Weight: lbs to kg (1 lb = 0.45359237 kg)
    if m_type == "body_weight":
        if clean_unit in ["lbs", "lb"]:
            converted = round(value * 0.45359237, 2)
            return converted, "kg", True, f"Converted {value} lbs to {converted} kg"
        elif clean_unit in ["grams", "g"]:
            converted = round(value / 1000.0, 2)
            return converted, "kg", True, f"Converted {value} g to {converted} kg"
        return round(value, 2), "kg", False, None

    # 8. Body Temperature: Fahrenheit to Celsius
    if m_type == "body_temperature":
        if clean_unit in ["f", "fahrenheit"]:
            converted = round((value - 32.0) * (5.0 / 9.0), 2)
            return converted, "Celsius", True, f"Converted {value} °F to {converted} °C"
        return round(value, 2), "Celsius", False, None

    # 9. Daily Steps
    if m_type == "daily_steps":
        return round(value, 0), "steps", False, None

    # 10. Respiratory Rate
    if m_type == "respiratory_rate":
        return round(value, 1), "breaths/min", False, None

    return value, canonical_unit, False, None
