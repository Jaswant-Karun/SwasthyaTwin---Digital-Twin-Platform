from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple
from app.models.assessment import MetricDeviation, MetricBaseline
from app.models.alert import AlertBase

# Metric semantic direction: whether higher is worse or lower is worse
# 'higher_worse': e.g. resting heart rate, blood pressure, glucose
# 'lower_worse': e.g. HRV, sleep duration, SpO2, daily steps
METRIC_CLINICAL_PROPERTIES = {
    "heart_rate": {
        "directionality": "higher_worse",
        "label": "Resting Heart Rate",
        "unit": "bpm",
        "alert_threshold_z": 2.0
    },
    "blood_pressure_systolic": {
        "directionality": "higher_worse",
        "label": "Systolic Blood Pressure",
        "unit": "mmHg",
        "alert_threshold_z": 1.8
    },
    "blood_pressure_diastolic": {
        "directionality": "higher_worse",
        "label": "Diastolic Blood Pressure",
        "unit": "mmHg",
        "alert_threshold_z": 1.8
    },
    "hrv_rmssd": {
        "directionality": "lower_worse",
        "label": "Heart Rate Variability (RMSSD)",
        "unit": "ms",
        "alert_threshold_z": -1.8
    },
    "spo2": {
        "directionality": "lower_worse",
        "label": "Blood Oxygen Saturation (SpO2)",
        "unit": "%",
        "alert_threshold_z": -2.2
    },
    "sleep_duration_hours": {
        "directionality": "lower_worse",
        "label": "Sleep Duration",
        "unit": "hours",
        "alert_threshold_z": -1.5
    },
    "daily_steps": {
        "directionality": "lower_worse",
        "label": "Daily Physical Activity",
        "unit": "steps",
        "alert_threshold_z": -1.8
    },
    "fasting_blood_glucose": {
        "directionality": "higher_worse",
        "label": "Fasting Blood Glucose",
        "unit": "mg/dL",
        "alert_threshold_z": 2.0
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
    baselines: Dict[str, MetricBaseline]
) -> Dict[str, MetricDeviation]:
    """
    Compares latest measurements against the patient's personal baseline statistics.
    Returns a dictionary of standardized MetricDeviation objects.
    """
    deviations: Dict[str, MetricDeviation] = {}

    for metric_type, curr in current_metrics.items():
        base = baselines.get(metric_type)
        val = curr.get("value")
        data_tier = curr.get("data_tier", "measured")
        unit = curr.get("unit", base.unit if base else "")

        if val is None:
            continue

        if not base or base.std_dev == 0:
            # Fallback if no baseline exists yet
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
                data_tier=data_tier
            )
            continue

        delta_abs = val - base.mean
        delta_pct = (delta_abs / base.mean * 100.0) if base.mean != 0 else 0.0
        z = delta_abs / base.std_dev

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
            data_tier=data_tier
        )

    return deviations

def evaluate_alerts(
    patient_id: str,
    deviations: Dict[str, MetricDeviation]
) -> List[AlertBase]:
    """
    Generates rule-based explainable alerts when deviations exceed personalized safety thresholds.
    Ensures suggestions are conservative, non-prescriptive, and transparent.
    """
    alerts: List[AlertBase] = []
    now = datetime.now(timezone.utc)

    for m_type, dev in deviations.items():
        props = METRIC_CLINICAL_PROPERTIES.get(m_type)
        if not props:
            continue

        z = dev.z_score
        abs_z = abs(z)
        directionality = props["directionality"]
        label = props["label"]

        # Determine if deviation represents adverse drift
        is_adverse = False
        if directionality == "higher_worse" and z >= 1.8:
            is_adverse = True
        elif directionality == "lower_worse" and z <= -1.8:
            is_adverse = True

        if is_adverse:
            severity = "critical" if abs_z >= 3.0 else ("warning" if abs_z >= 2.0 else "info")

            delta_str = f"+{dev.delta_absolute}" if dev.delta_absolute > 0 else f"{dev.delta_absolute}"
            title = f"{label} {dev.direction.capitalize()} from Baseline"
            description = (
                f"Current {label} of {dev.current_value} {dev.unit} deviates by {delta_str} {dev.unit} "
                f"({dev.delta_percentage:+.1f}%, Z-Score: {dev.z_score}) from your personalized baseline of "
                f"{dev.baseline_mean} {dev.unit}."
            )

            # Conservative, non-prescriptive recommendation
            if m_type == "heart_rate":
                suggested = (
                    "Review recent sleep patterns, physical exertion, hydration, and caffeine intake. "
                    "If accompanied by chest discomfort, shortness of breath, or palpitations, seek professional care."
                )
            elif m_type.startswith("blood_pressure"):
                suggested = (
                    "Take a repeat measurement after 5 minutes of seated quiet rest. "
                    "Ensure cuff sizing is correct. Consult your primary care provider if elevation persists."
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
                    "sample_count": dev.delta_percentage
                },
                suggested_action=suggested,
                is_acknowledged=False
            ))

    return alerts
