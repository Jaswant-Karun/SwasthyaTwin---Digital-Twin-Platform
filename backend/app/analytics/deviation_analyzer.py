import math
import numpy as np
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
from app.models.assessment import MetricDeviation, MetricBaseline, MeasurementAssessment
from app.core.config import settings

# Metrics where percentage relative deviation is misleading:
# 1. 'spo2': Already an absolute bounded percentage (0-100%). A drop from 98% to 94% is a 4 percentage point drop,
#    not -4.08%. In clinical/physiological communication, relative percent of a percentage is misleading.
# 2. Temperature interval scales ('body_temperature', 'celsius', 'fahrenheit'): Arbitrary zero point,
#    meaning relative percentage is mathematically undefined/misleading across units.
METRICS_EXCLUDED_FROM_RELATIVE_DEVIATION = {
    "spo2",
    "body_temperature",
    "temperature_celsius",
    "temperature_fahrenheit"
}

METRIC_CLINICAL_PROPERTIES: Dict[str, Dict[str, Any]] = {
    "heart_rate": {
        "directionality": "higher_worse",
        "label": "Resting Heart Rate",
        "unit": "bpm",
        "warning_threshold_z": 1.8,
        "critical_threshold_z": 3.0,
        "relative_meaningful": True,
        "explanation": "Elevated resting heart rate relative to personal baseline can indicate autonomic arousal, dehydration, infection, or recovery deficit."
    },
    "blood_pressure_systolic": {
        "directionality": "higher_worse",
        "label": "Systolic Blood Pressure",
        "unit": "mmHg",
        "warning_threshold_z": 1.8,
        "critical_threshold_z": 2.8,
        "relative_meaningful": True,
        "explanation": "Systolic elevation above historical distribution reflects increased arterial pressure or acute sympathetic tone."
    },
    "blood_pressure_diastolic": {
        "directionality": "higher_worse",
        "label": "Diastolic Blood Pressure",
        "unit": "mmHg",
        "warning_threshold_z": 1.8,
        "critical_threshold_z": 2.8,
        "relative_meaningful": True,
        "explanation": "Diastolic elevation reflects increased systemic vascular resistance during cardiac relaxation."
    },
    "hrv_rmssd": {
        "directionality": "lower_worse",
        "label": "Heart Rate Variability (RMSSD)",
        "unit": "ms",
        "warning_threshold_z": -1.8,
        "critical_threshold_z": -2.8,
        "relative_meaningful": True,
        "explanation": "Suppression of vagally-mediated HRV indicates diminished parasympathetic tone and physiological strain."
    },
    "spo2": {
        "directionality": "lower_worse",
        "label": "Blood Oxygen Saturation (SpO2)",
        "unit": "%",
        "warning_threshold_z": -2.0,
        "critical_threshold_z": -3.0,
        "relative_meaningful": False,
        "relative_exclusion_reason": "SpO2 is a bounded percentage of saturation; deviations are expressed in absolute percentage points to prevent misleading relative scaling.",
        "explanation": "Desaturation below baseline indicates potential ventilation/perfusion mismatch or respiratory fatigue."
    },
    "sleep_duration_hours": {
        "directionality": "lower_worse",
        "label": "Sleep Duration",
        "unit": "hours",
        "warning_threshold_z": -1.5,
        "critical_threshold_z": -2.5,
        "relative_meaningful": True,
        "explanation": "Acute sleep deficit hinders nocturnal restorative homeostasis and cardiovascular recovery."
    },
    "daily_steps": {
        "directionality": "lower_worse",
        "label": "Daily Physical Activity",
        "unit": "steps",
        "warning_threshold_z": -1.8,
        "critical_threshold_z": -2.8,
        "relative_meaningful": True,
        "explanation": "Significant decline in daily physical ambulation from routine baseline activity."
    },
    "fasting_blood_glucose": {
        "directionality": "higher_worse",
        "label": "Fasting Blood Glucose",
        "unit": "mg/dL",
        "warning_threshold_z": 1.8,
        "critical_threshold_z": 3.0,
        "relative_meaningful": True,
        "explanation": "Elevated fasting blood sugar relative to baseline suggests altered glycemic regulation or acute counter-regulatory hormone response."
    },
    "respiratory_rate": {
        "directionality": "higher_worse",
        "label": "Respiratory Rate",
        "unit": "breaths/min",
        "warning_threshold_z": 1.8,
        "critical_threshold_z": 2.8,
        "relative_meaningful": True,
        "explanation": "Elevated resting breathing rate can indicate physiological distress, metabolic demand, or subclinical respiratory strain."
    }
}

def is_relative_deviation_meaningful(metric_type: str, baseline_value: float) -> Tuple[bool, Optional[str]]:
    """
    Evaluates whether a relative percentage deviation is mathematically and clinically defensible.
    Rejects:
    1. Zero or near-zero baselines (|baseline| < 0.0001).
    2. Proportions/percentages where percent change is misleading (e.g., SpO2).
    3. Interval scales lacking an absolute physiological zero (e.g., Celsius/Fahrenheit temperature).
    """
    if abs(baseline_value) < 1e-4:
        return False, "Baseline value is zero; relative percentage deviation is undefined."

    normalized_metric = metric_type.lower()
    if normalized_metric in METRICS_EXCLUDED_FROM_RELATIVE_DEVIATION:
        reason = METRIC_CLINICAL_PROPERTIES.get(normalized_metric, {}).get(
            "relative_exclusion_reason",
            f"Relative percentage is clinically misleading for bounded/interval metric '{metric_type}'."
        )
        return False, reason

    return True, None

def calculate_absolute_deviation(current_value: float, baseline_value: float) -> float:
    """
    Formula: absolute_deviation = current_value - baseline
    """
    return round(current_value - baseline_value, 2)

def calculate_relative_deviation(
    current_value: float,
    baseline_value: float,
    metric_type: str
) -> Tuple[Optional[float], bool, Optional[str]]:
    """
    Formula:
    relative_deviation_percent = 100 * (current_value - baseline) / abs(baseline),
    when the baseline is nonzero and percentage comparison is meaningful.
    """
    meaningful, reason = is_relative_deviation_meaningful(metric_type, baseline_value)
    if not meaningful:
        return None, False, reason

    rel_pct = 100.0 * (current_value - baseline_value) / abs(baseline_value)
    return round(rel_pct, 1), True, None

def compute_rolling_trend(
    observations: List[Dict[str, Any]],
    metric_type: str,
    min_points: int = 2
) -> Tuple[Optional[str], float, float]:
    """
    Calculates rolling trend direction and slope where sufficient observations exist.
    Returns: (direction, slope, volatility)
    """
    clean_obs = [
        o for o in observations
        if o.get("value") is not None and not (isinstance(o.get("value"), float) and np.isnan(o.get("value")))
    ]
    if len(clean_obs) < min_points:
        return "insufficient_data", 0.0, 0.0

    # Sort chronologically
    now = datetime.now(timezone.utc)
    clean_obs.sort(key=lambda x: x.get("observed_at") or x.get("timestamp") or now)

    vals = [float(o["value"]) for o in clean_obs]
    # Use recent window (up to 7 most recent points)
    recent_vals = vals[-7:] if len(vals) >= 7 else vals

    if len(recent_vals) > 1:
        x = np.arange(len(recent_vals))
        slope, _ = np.polyfit(x, recent_vals, 1)
        volatility = float(np.std(vals))
    else:
        slope = 0.0
        volatility = 0.0

    props = METRIC_CLINICAL_PROPERTIES.get(metric_type, {})
    directionality = props.get("directionality", "higher_worse")

    threshold = 0.05
    if directionality == "higher_worse":
        if slope < -threshold:
            direction = "improving"
        elif slope > threshold:
            direction = "worsening"
        else:
            direction = "stable"
    else:
        # lower_worse (e.g. hrv, sleep, steps, spo2)
        if slope > threshold:
            direction = "improving"
        elif slope < -threshold:
            direction = "worsening"
        else:
            direction = "stable"

    return direction, round(float(slope), 3), round(volatility, 2)

def classify_z_score(z: float) -> Tuple[str, str]:
    abs_z = abs(z)
    direction = "elevated" if z > 0.3 else ("suppressed" if z < -0.3 else "normal")

    if abs_z < 1.0:
        return "optimal", direction
    elif abs_z < 2.0:
        return "mild_deviation", direction
    elif abs_z < 3.0:
        return "moderate_drift", direction
    else:
        return "significant_deviation", direction

def analyze_measurement_deviation(
    patient_id: str,
    metric_type: str,
    current_obs: Dict[str, Any],
    baseline: Optional[MetricBaseline],
    recent_history: Optional[List[Dict[str, Any]]] = None,
    freshness_threshold_hours: Optional[float] = None
) -> MetricDeviation:
    """
    Performs comprehensive personal baseline deviation analysis for a single measurement.
    Calculates absolute deviation, defensible relative percentage deviation, rolling trends,
    data quality, and freshness indicators.
    """
    now = datetime.now(timezone.utc)
    stale_hours = freshness_threshold_hours or settings.DATA_STALENESS_WARNING_HOURS

    raw_val = current_obs.get("value")
    unit = current_obs.get("unit", baseline.unit if baseline else "")
    data_tier = current_obs.get("data_kind") or current_obs.get("data_tier", "measured")
    obs_id = current_obs.get("observation_id") or current_obs.get("id")
    obs_time = current_obs.get("observed_at") or current_obs.get("timestamp")

    val = float(raw_val) if raw_val is not None else 0.0

    # Data Freshness
    freshness_h: Optional[float] = None
    is_stale = False
    if obs_time:
        if isinstance(obs_time, str):
            obs_time = datetime.fromisoformat(obs_time.replace("Z", "+00:00"))
        if obs_time.tzinfo is None:
            obs_time = obs_time.replace(tzinfo=timezone.utc)
        freshness_h = round((now - obs_time).total_seconds() / 3600.0, 1)
        is_stale = freshness_h > stale_hours

    freshness_dict = {
        "freshness_hours": freshness_h,
        "is_stale": is_stale,
        "last_observed_at": obs_time.isoformat() if obs_time else None,
        "staleness_threshold_hours": stale_hours
    }

    # Rolling Trend
    trend_direction, slope, volatility = compute_rolling_trend(
        recent_history or [current_obs],
        metric_type=metric_type
    )

    # If no baseline established yet
    if not baseline or baseline.sample_count == 0:
        return MetricDeviation(
            metric_type=metric_type,
            unit=unit,
            current_value=round(val, 2),
            baseline_mean=round(val, 2),
            baseline_std=1.0,
            delta_absolute=0.0,
            delta_percentage=0.0,
            z_score=0.0,
            status="optimal",
            direction="normal",
            data_tier=data_tier,
            iqr_distance=0.0,
            freshness_hours=freshness_h,
            is_stale=is_stale,
            contributing_observation_id=obs_id,
            # Requirement F fields
            observed_value=round(val, 2),
            personal_baseline=round(val, 2),
            absolute_deviation=0.0,
            relative_deviation_percent=None,
            relative_deviation_meaningful=False,
            relative_deviation_note="Baseline not yet established; awaiting sufficient historical observations.",
            trend_direction=trend_direction,
            data_quality={
                "sample_count": 0,
                "is_sufficient": False,
                "outlier_count": 0,
                "volatility": volatility,
                "data_tier": data_tier
            },
            data_freshness=freshness_dict,
            rule_id=None,
            rule_version=None,
            explanation=f"Baseline for {metric_type} is awaiting minimum observations before calculating personal deviations.",
            data_source=current_obs.get("source", "wearable_continuous"),
            assessed_at=now,
            limitations="Non-diagnostic demonstration telemetry; insufficient baseline data."
        )

    # Primary baseline: Median
    base_median = baseline.median
    base_mean = baseline.mean
    base_std = baseline.std_dev if baseline.std_dev > 0.001 else 0.5

    # Formula: absolute_deviation = current_value - baseline
    abs_dev = calculate_absolute_deviation(val, base_median)

    # Relative percentage deviation (with mathematical & clinical guardrails)
    rel_pct, rel_meaningful, rel_note = calculate_relative_deviation(val, base_median, metric_type)

    # Parametric Z-score & Robust IQR distance
    z = (val - base_mean) / base_std
    iqr_dist = (val - base_median) / baseline.iqr if baseline.iqr > 0 else z

    status, direction = classify_z_score(z)

    # Fallback delta_percentage for backward compatibility
    compat_delta_pct = rel_pct if rel_pct is not None else round(abs_dev, 1)

    # Plain language explanation
    explanation = (
        f"Observed {val} {unit} differs by {abs_dev:+.1f} {unit} "
        f"from personal median baseline ({base_median} {unit})."
    )
    if rel_meaningful and rel_pct is not None:
        explanation += f" Relative change is {rel_pct:+.1f}%."

    quality_dict = {
        "sample_count": baseline.sample_count,
        "is_sufficient": baseline.is_sufficient,
        "window_days": baseline.window_days,
        "outlier_count": baseline.outlier_count,
        "volatility": volatility,
        "data_tier": data_tier,
        "includes_simulated": baseline.includes_simulated
    }

    return MetricDeviation(
        metric_type=metric_type,
        unit=unit,
        current_value=round(val, 2),
        baseline_mean=round(base_mean, 2),
        baseline_std=round(base_std, 2),
        delta_absolute=round(abs_dev, 2),
        delta_percentage=compat_delta_pct,
        z_score=round(z, 2),
        status=status,
        direction=direction,
        data_tier=data_tier,
        iqr_distance=round(iqr_dist, 2),
        freshness_hours=freshness_h,
        is_stale=is_stale,
        contributing_observation_id=obs_id,
        # Requirement F fields
        observed_value=round(val, 2),
        personal_baseline=round(base_median, 2),
        absolute_deviation=round(abs_dev, 2),
        relative_deviation_percent=rel_pct,
        relative_deviation_meaningful=rel_meaningful,
        relative_deviation_note=rel_note,
        trend_direction=trend_direction,
        data_quality=quality_dict,
        data_freshness=freshness_dict,
        rule_id=None,
        rule_version=settings.RULE_ENGINE_VERSION,
        explanation=explanation,
        data_source=current_obs.get("source", "wearable_continuous"),
        assessed_at=now,
        limitations="Heuristic comparison against personal median; not a diagnostic clinical standard."
    )
