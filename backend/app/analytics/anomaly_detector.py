import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
from app.models.assessment import MetricDeviation, MetricBaseline
from app.models.alert import AlertBase
from app.core.config import settings

# Metric semantic direction and clinical interpretation:
# 'higher_worse': resting heart rate, blood pressure, fasting glucose
# 'lower_worse': HRV (RMSSD), sleep duration, daily steps, SpO2
METRIC_CLINICAL_PROPERTIES = {
    "heart_rate": {
        "directionality": "higher_worse",
        "label": "Resting Heart Rate",
        "unit": "bpm",
        "warning_threshold_z": 1.8,
        "critical_threshold_z": 3.0,
        "explanation": "Elevated resting heart rate relative to personal baseline can indicate autonomic arousal, dehydration, infection, or recovery deficit."
    },
    "blood_pressure_systolic": {
        "directionality": "higher_worse",
        "label": "Systolic Blood Pressure",
        "unit": "mmHg",
        "warning_threshold_z": 1.8,
        "critical_threshold_z": 2.8,
        "explanation": "Systolic elevation above historical distribution reflects increased arterial pressure or acute sympathetic tone."
    },
    "blood_pressure_diastolic": {
        "directionality": "higher_worse",
        "label": "Diastolic Blood Pressure",
        "unit": "mmHg",
        "warning_threshold_z": 1.8,
        "critical_threshold_z": 2.8,
        "explanation": "Diastolic elevation reflects increased systemic vascular resistance during cardiac relaxation."
    },
    "hrv_rmssd": {
        "directionality": "lower_worse",
        "label": "Heart Rate Variability (RMSSD)",
        "unit": "ms",
        "warning_threshold_z": -1.8,
        "critical_threshold_z": -2.8,
        "explanation": "Suppression of vagally-mediated HRV indicates diminished parasympathetic tone and physiological strain."
    },
    "spo2": {
        "directionality": "lower_worse",
        "label": "Blood Oxygen Saturation (SpO2)",
        "unit": "%",
        "warning_threshold_z": -2.0,
        "critical_threshold_z": -3.0,
        "explanation": "Desaturation below baseline indicates potential ventilation/perfusion mismatch or respiratory fatigue."
    },
    "sleep_duration_hours": {
        "directionality": "lower_worse",
        "label": "Sleep Duration",
        "unit": "hours",
        "warning_threshold_z": -1.5,
        "critical_threshold_z": -2.5,
        "explanation": "Acute sleep deficit hinders nocturnal restorative homeostasis and cardiovascular recovery."
    },
    "daily_steps": {
        "directionality": "lower_worse",
        "label": "Daily Physical Activity",
        "unit": "steps",
        "warning_threshold_z": -1.8,
        "critical_threshold_z": -2.8,
        "explanation": "Significant decline in daily physical ambulation from routine baseline activity."
    },
    "fasting_blood_glucose": {
        "directionality": "higher_worse",
        "label": "Fasting Blood Glucose",
        "unit": "mg/dL",
        "warning_threshold_z": 1.8,
        "critical_threshold_z": 3.0,
        "explanation": "Elevated fasting blood sugar relative to baseline suggests altered glycemic regulation or acute counter-regulatory hormone response."
    },
    "respiratory_rate": {
        "directionality": "higher_worse",
        "label": "Respiratory Rate",
        "unit": "breaths/min",
        "warning_threshold_z": 1.8,
        "critical_threshold_z": 2.8,
        "explanation": "Elevated resting breathing rate can indicate physiological distress, metabolic demand, or subclinical respiratory strain."
    }
}

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

def detect_deviations(
    current_metrics: Dict[str, Dict[str, Any]],
    baselines: Dict[str, MetricBaseline],
    freshness_threshold_hours: Optional[float] = None
) -> Dict[str, MetricDeviation]:
    """
    Compares latest measurements against the patient's personal baseline statistics.
    Evaluates both parametric (z-score) and robust non-parametric (IQR distance) deviations.
    Computes data freshness per metric.
    """
    deviations: Dict[str, MetricDeviation] = {}
    now = datetime.now(timezone.utc)
    stale_hours = freshness_threshold_hours or settings.DATA_STALENESS_WARNING_HOURS

    for metric_type, curr in current_metrics.items():
        base = baselines.get(metric_type)
        val = curr.get("value")
        data_tier = curr.get("data_kind") or curr.get("data_tier", "measured")
        unit = curr.get("unit", base.unit if base else "")
        obs_id = curr.get("observation_id") or curr.get("id")
        obs_time = curr.get("observed_at") or curr.get("timestamp")

        if val is None:
            continue

        # Compute freshness
        freshness_h: Optional[float] = None
        is_stale = False
        if obs_time:
            if isinstance(obs_time, str):
                obs_time = datetime.fromisoformat(obs_time.replace("Z", "+00:00"))
            if obs_time.tzinfo is None:
                obs_time = obs_time.replace(tzinfo=timezone.utc)
            freshness_h = round((now - obs_time).total_seconds() / 3600.0, 1)
            is_stale = freshness_h > stale_hours

        if not base or base.std_dev == 0:
            # Fallback if baseline is not available yet
            deviations[metric_type] = MetricDeviation(
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
                contributing_observation_id=obs_id
            )
            continue

        delta_abs = val - base.mean
        delta_pct = (delta_abs / base.mean * 100.0) if base.mean != 0 else 0.0
        z = delta_abs / base.std_dev

        # Robust IQR distance from median
        iqr_dist = (val - base.median) / base.iqr if base.iqr > 0 else z

        status, direction = classify_z_score(z)

        deviations[metric_type] = MetricDeviation(
            metric_type=metric_type,
            unit=unit,
            current_value=round(val, 2),
            baseline_mean=round(base.mean, 2),
            baseline_std=round(base.std_dev, 2),
            delta_absolute=round(delta_abs, 2),
            delta_percentage=round(delta_pct, 1),
            z_score=round(z, 2),
            status=status,
            direction=direction,
            data_tier=data_tier,
            iqr_distance=round(iqr_dist, 2),
            freshness_hours=freshness_h,
            is_stale=is_stale,
            contributing_observation_id=obs_id
        )

    return deviations

def evaluate_alerts(
    patient_id: str,
    deviations: Dict[str, MetricDeviation],
    rule_version: Optional[str] = None
) -> List[AlertBase]:
    """
    Generates rule-based explainable alerts when deviations exceed personalized safety thresholds.
    Ensures suggestions are conservative, non-prescriptive, and transparent.
    Thresholds are demonstration heuristics, not clinical criteria.
    """
    alerts: List[AlertBase] = []
    now = datetime.now(timezone.utc)
    ver = rule_version or settings.RULE_ENGINE_VERSION

    for m_type, dev in deviations.items():
        props = METRIC_CLINICAL_PROPERTIES.get(m_type)
        if not props:
            continue

        # Suppress alerts if data is extremely stale (> 7 days) to avoid false alarms from outdated state
        if dev.is_stale and dev.freshness_hours and dev.freshness_hours > settings.DATA_STALENESS_CRITICAL_HOURS:
            continue

        z = dev.z_score
        abs_z = abs(z)
        directionality = props["directionality"]
        label = props["label"]
        warn_z = props["warning_threshold_z"]
        crit_z = props["critical_threshold_z"]

        is_adverse = False
        if directionality == "higher_worse" and z >= warn_z:
            is_adverse = True
        elif directionality == "lower_worse" and z <= warn_z:
            is_adverse = True

        if is_adverse:
            severity = "critical" if abs_z >= abs(crit_z) else ("warning" if abs_z >= 2.0 else "info")

            delta_str = f"+{dev.delta_absolute}" if dev.delta_absolute > 0 else f"{dev.delta_absolute}"
            title = f"{label} {dev.direction.capitalize()} from Baseline"
            description = (
                f"Current {label} of {dev.current_value} {dev.unit} deviates by {delta_str} {dev.unit} "
                f"({dev.delta_percentage:+.1f}%, Z: {dev.z_score}, IQR dist: {dev.iqr_distance}) from your personalized baseline of "
                f"{dev.baseline_mean} {dev.unit}. {props.get('explanation', '')}"
            )

            if m_type == "heart_rate":
                suggested = (
                    "Review recent sleep patterns, physical exertion, hydration, and caffeine intake. "
                    "If accompanied by chest discomfort, shortness of breath, or palpitations, seek professional medical care."
                )
            elif m_type.startswith("blood_pressure"):
                suggested = (
                    "Take a repeat measurement after 5 minutes of seated quiet rest. "
                    "Ensure cuff sizing is correct. Consult your primary care physician if elevation persists."
                )
            elif m_type == "sleep_duration_hours":
                suggested = (
                    "Consider supporting consistent sleep timing and reducing evening screen exposure. "
                    "Longitudinal sleep deficit can elevate resting cardiovascular tone."
                )
            elif m_type == "hrv_rmssd":
                suggested = (
                    "Reduced autonomic variability observed compared to baseline. "
                    "Consider prioritizing recovery, gentle walking, and adequate hydration today."
                )
            elif m_type == "spo2":
                suggested = (
                    "Re-check finger probe placement and warmth. If reading remains below 94% or if you feel short of breath, "
                    "seek urgent medical evaluation immediately."
                )
            else:
                suggested = (
                    "Monitor for persistent trends over the next 48 hours. "
                    "Discuss persistent biometric shifts with your healthcare provider."
                )

            alerts.append(AlertBase(
                patient_id=patient_id,
                timestamp=now,
                severity=severity,
                metric_type=m_type,
                title=title,
                description=description,
                current_value=dev.current_value,
                baseline_value=dev.baseline_mean,
                unit=dev.unit,
                z_score=dev.z_score,
                evidence={
                    "current_value": dev.current_value,
                    "baseline_mean": dev.baseline_mean,
                    "baseline_std": dev.baseline_std,
                    "z_score": dev.z_score,
                    "iqr_distance": dev.iqr_distance,
                    "delta_percentage": dev.delta_percentage,
                    "contributing_observation_id": dev.contributing_observation_id,
                    "rule_version": ver,
                    "assessment_timestamp": now.isoformat(),
                    "disclaimer": "Heuristic demonstration rule; not a clinical diagnostic criteria."
                },
                suggested_action=suggested,
                is_acknowledged=False
            ))

    return alerts
