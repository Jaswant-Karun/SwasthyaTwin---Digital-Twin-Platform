import logging
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
import numpy as np
from app.models.assessment import MetricBaseline
from app.core.config import settings

logger = logging.getLogger(__name__)

def compute_metric_baseline(
    metric_type: str,
    unit: str,
    values: List[float],
    timestamps: List[datetime],
    window_days: int = 30,
    min_observations: Optional[int] = None
) -> Optional[MetricBaseline]:
    """
    Computes statistical baseline for a specific biometric over a defined historical window.
    Applies robust IQR filtering (Tukey's fences) to identify outliers and prevent aberrant transient
    spikes from skewing the baseline.
    Never treats missing values as zero.
    """
    min_obs = min_observations if min_observations is not None else settings.MIN_OBSERVATIONS_FOR_BASELINE

    # Filter out None and NaN values
    valid_pairs = [
        (v, t) for v, t in zip(values, timestamps)
        if v is not None and not (isinstance(v, float) and np.isnan(v))
    ]

    if not valid_pairs:
        return None

    clean_values = [p[0] for p in valid_pairs]
    clean_timestamps = [p[1] for p in valid_pairs]

    is_sufficient = len(clean_values) >= min_obs
    arr = np.array(clean_values, dtype=float)

    # Calculate percentiles and robust IQR
    q1 = float(np.percentile(arr, 25))
    median = float(np.percentile(arr, 50))
    q3 = float(np.percentile(arr, 75))
    iqr = float(q3 - q1)

    # Tukey's fences
    iqr_lower_fence = q1 - 1.5 * iqr
    iqr_upper_fence = q3 + 1.5 * iqr

    # Extreme outlier fence (3 * IQR) for robust filtering
    extreme_lower = q1 - 3.0 * iqr
    extreme_upper = q3 + 3.0 * iqr

    outliers = arr[(arr < extreme_lower) | (arr > extreme_upper)]
    outlier_count = int(len(outliers))

    filtered_arr = arr[(arr >= extreme_lower) & (arr <= extreme_upper)]
    if len(filtered_arr) < 2:
        filtered_arr = arr

    mean_val = float(np.mean(filtered_arr))
    std_val = float(np.std(filtered_arr, ddof=1)) if len(filtered_arr) > 1 else 1.0

    # Prevent division by zero downstream if all observed values were identical
    if std_val < 0.001:
        std_val = 0.5

    now = datetime.now(timezone.utc)
    min_time = min(clean_timestamps) if clean_timestamps else now - timedelta(days=window_days)
    max_time = max(clean_timestamps) if clean_timestamps else now

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
        window_end=max_time,
        outlier_count=outlier_count,
        is_sufficient=is_sufficient,
        iqr_lower_fence=round(iqr_lower_fence, 2),
        iqr_upper_fence=round(iqr_upper_fence, 2)
    )

def compute_all_baselines(
    observations: List[Dict[str, Any]],
    window_days: int = 30,
    min_observations: Optional[int] = None
) -> Dict[str, MetricBaseline]:
    """
    Groups observations by measurement_type and computes personalized baseline for each.
    Handles field name aliases (measurement_type vs metric_type, observed_at vs timestamp).
    """
    grouped_values: Dict[str, List[float]] = {}
    grouped_timestamps: Dict[str, List[datetime]] = {}
    metric_units: Dict[str, str] = {}

    for obs in observations:
        m = obs.get("measurement_type") or obs.get("metric_type")
        val = obs.get("value")
        ts = obs.get("observed_at") or obs.get("timestamp")
        unit = obs.get("unit", "")

        if m and val is not None:
            try:
                numeric_val = float(val)
                grouped_values.setdefault(m, []).append(numeric_val)
                if isinstance(ts, str):
                    ts = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                elif ts is None:
                    ts = datetime.now(timezone.utc)
                elif ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)
                grouped_timestamps.setdefault(m, []).append(ts)
                metric_units[m] = unit
            except (ValueError, TypeError):
                continue

    baselines: Dict[str, MetricBaseline] = {}
    for m, vals in grouped_values.items():
        base = compute_metric_baseline(
            metric_type=m,
            unit=metric_units.get(m, ""),
            values=vals,
            timestamps=grouped_timestamps.get(m, []),
            window_days=window_days,
            min_observations=min_observations
        )
        if base:
            baselines[m] = base

    return baselines
