from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
import numpy as np
from app.models.assessment import MetricBaseline

def compute_metric_baseline(
    metric_type: str,
    unit: str,
    values: List[float],
    timestamps: List[datetime],
    window_days: int = 30
) -> Optional[MetricBaseline]:
    """
    Computes statistical baseline for a specific biometric over a defined historical window.
    Applies robust IQR filtering to prevent aberrant transient spikes from skewing baseline.
    """
    if not values or len(values) < 3:
        return None

    arr = np.array(values, dtype=float)

    # Calculate percentiles and IQR
    q1 = float(np.percentile(arr, 25))
    median = float(np.percentile(arr, 50))
    q3 = float(np.percentile(arr, 75))
    iqr = float(q3 - q1)

    # Winsorize / clamp extreme outliers beyond 3 * IQR for robust mean/std calculation
    lower_bound = q1 - 3.0 * iqr
    upper_bound = q3 + 3.0 * iqr
    filtered_arr = arr[(arr >= lower_bound) & (arr <= upper_bound)]

    if len(filtered_arr) < 2:
        filtered_arr = arr

    mean_val = float(np.mean(filtered_arr))
    std_val = float(np.std(filtered_arr, ddof=1)) if len(filtered_arr) > 1 else 1.0

    # Prevent division by zero in downstream z-score if variance is tiny
    if std_val < 0.001:
        std_val = 0.5

    now = datetime.now(timezone.utc)
    min_time = min(timestamps) if timestamps else now - timedelta(days=window_days)
    max_time = max(timestamps) if timestamps else now

    return MetricBaseline(
        metric_type=metric_type,
        unit=unit,
        mean=round(mean_val, 2),
        std_dev=round(std_val, 2),
        median=round(median, 2),
        iqr=round(iqr, 2),
        q1=round(q1, 2),
        q3=round(q3, 2),
        min_val=round(float(np.min(arr)), 2),
        max_val=round(float(np.max(arr)), 2),
        sample_count=len(arr),
        window_days=window_days,
        window_start=min_time,
        window_end=max_time
    )

def compute_all_baselines(
    observations: List[Dict[str, Any]],
    window_days: int = 30
) -> Dict[str, MetricBaseline]:
    """
    Groups observations by metric_type and computes personalized baseline for each.
    """
    grouped_values: Dict[str, List[float]] = {}
    grouped_timestamps: Dict[str, List[datetime]] = {}
    metric_units: Dict[str, str] = {}

    for obs in observations:
        m = obs.get("metric_type")
        val = obs.get("value")
        ts = obs.get("timestamp")
        unit = obs.get("unit", "")
        if m and val is not None:
            grouped_values.setdefault(m, []).append(float(val))
            if isinstance(ts, str):
                ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            grouped_timestamps.setdefault(m, []).append(ts)
            metric_units[m] = unit

    baselines: Dict[str, MetricBaseline] = {}
    for m, vals in grouped_values.items():
        base = compute_metric_baseline(
            metric_type=m,
            unit=metric_units.get(m, ""),
            values=vals,
            timestamps=grouped_timestamps.get(m, []),
            window_days=window_days
        )
        if base:
            baselines[m] = base

    return baselines
