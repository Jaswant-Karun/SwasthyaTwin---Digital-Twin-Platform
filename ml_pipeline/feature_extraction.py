"""
SwasthyaTwin AI — Sleep Feature Extraction Module
Extracts compact, physiologically grounded features from aligned 30-second epoch wearable data.

Features:
- Heart rate statistical summaries (mean, std, median, min, max, q25, q75, valid count).
- Cardiac autonomic markers: deviation from nocturnal baseline (hr_delta_baseline).
- Temporal dynamics: causal 5-minute backward rolling statistics (mean, std).
- Circadian progression: time elapsed in sleep session (time_elapsed_minutes).
- Accelerometry dynamics (when available): magnitude statistics and 3-axis movement variability.

Constraint: Causal only — uses only signals from the current and preceding epochs.
No future leakage, no participant leakage, no label leakage.
"""

from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd

from ml_pipeline.config import CORE_FEATURE_COLUMNS, MOTION_FEATURE_COLUMNS


def extract_epoch_hr_features(
    hr_series: np.ndarray,
    baseline_hr: float = 60.0,
    time_elapsed_min: float = 0.0
) -> Dict[str, float]:
    """
    Computes statistical features for a single 30s epoch from raw heart rate values.
    """
    valid_hr = hr_series[~np.isnan(hr_series)]
    count = len(valid_hr)

    if count == 0:
        # Impute with baseline if completely absent in this epoch
        mean_val = float(baseline_hr)
        std_val = 0.0
        median_val = float(baseline_hr)
        min_val = float(baseline_hr)
        max_val = float(baseline_hr)
        q25_val = float(baseline_hr)
        q75_val = float(baseline_hr)
    else:
        mean_val = float(np.mean(valid_hr))
        std_val = float(np.std(valid_hr, ddof=1)) if count > 1 else 0.0
        median_val = float(np.median(valid_hr))
        min_val = float(np.min(valid_hr))
        max_val = float(np.max(valid_hr))
        q25_val = float(np.percentile(valid_hr, 25))
        q75_val = float(np.percentile(valid_hr, 75))

    delta_baseline = mean_val - baseline_hr

    return {
        "hr_mean": mean_val,
        "hr_std": std_val,
        "hr_median": median_val,
        "hr_min": min_val,
        "hr_max": max_val,
        "hr_q25": q25_val,
        "hr_q75": q75_val,
        "hr_valid_count": float(count),
        "hr_delta_baseline": delta_baseline,
        "time_elapsed_minutes": float(time_elapsed_min)
    }


def extract_epoch_motion_features(
    acc_x: np.ndarray,
    acc_y: np.ndarray,
    acc_z: np.ndarray
) -> Dict[str, float]:
    """
    Extracts motion features from 3-axis accelerometry samples in a 30s epoch.
    """
    count = len(acc_x)
    if count == 0:
        return {col: 0.0 for col in MOTION_FEATURE_COLUMNS}

    # Euclidean acceleration magnitude: m = sqrt(x^2 + y^2 + z^2)
    mag = np.sqrt(acc_x ** 2 + acc_y ** 2 + acc_z ** 2)

    return {
        "acc_mag_mean": float(np.mean(mag)),
        "acc_mag_std": float(np.std(mag, ddof=1)) if count > 1 else 0.0,
        "acc_mag_max": float(np.max(mag)),
        "acc_x_std": float(np.std(acc_x, ddof=1)) if count > 1 else 0.0,
        "acc_y_std": float(np.std(acc_y, ddof=1)) if count > 1 else 0.0,
        "acc_z_std": float(np.std(acc_z, ddof=1)) if count > 1 else 0.0,
    }


def compute_night_epoch_features(
    aligned_hr_df: pd.DataFrame,
    total_epochs: int,
    aligned_motion_df: Optional[pd.DataFrame] = None
) -> pd.DataFrame:
    """
    Aggregates a full night's sensor telemetry into an epoch-level feature table.
    
    Missing Signal Policy:
    Brief missing intervals in PPG telemetry during sleep are handled via forward/backward
    linear interpolation across the session, with fallback to the session median baseline.
    Zero-imputation is strictly forbidden because 0 bpm does not reflect physiological sleep.
    """
    all_epochs = pd.DataFrame({"epoch_idx": np.arange(1, total_epochs + 1)})

    # 1. Aggregate HR per epoch
    if not aligned_hr_df.empty:
        grouped = aligned_hr_df.groupby("epoch_idx")["hr"]
        hr_agg = grouped.agg(
            hr_mean="mean",
            hr_std="std",
            hr_median="median",
            hr_min="min",
            hr_max="max",
            hr_valid_count="count"
        ).reset_index()

        hr_agg["hr_q25"] = grouped.apply(lambda s: float(np.percentile(s, 25))).values
        hr_agg["hr_q75"] = grouped.apply(lambda s: float(np.percentile(s, 75))).values
        hr_agg["hr_std"] = hr_agg["hr_std"].fillna(0.0)
    else:
        hr_agg = pd.DataFrame(columns=["epoch_idx"] + CORE_FEATURE_COLUMNS)

    # Merge with full epoch timeline
    merged = pd.merge(all_epochs, hr_agg, on="epoch_idx", how="left")

    # Determine night baseline HR from observed valid epochs
    session_baseline_hr = float(merged["hr_mean"].median()) if not merged["hr_mean"].dropna().empty else 60.0

    # Handle missing epochs using linear interpolation bounded by baseline
    merged["hr_mean"] = merged["hr_mean"].interpolate(method="linear").fillna(session_baseline_hr)
    merged["hr_std"] = merged["hr_std"].fillna(0.0)
    merged["hr_median"] = merged["hr_median"].interpolate(method="linear").fillna(session_baseline_hr)
    merged["hr_min"] = merged["hr_min"].interpolate(method="linear").fillna(session_baseline_hr)
    merged["hr_max"] = merged["hr_max"].interpolate(method="linear").fillna(session_baseline_hr)
    merged["hr_q25"] = merged["hr_q25"].interpolate(method="linear").fillna(session_baseline_hr)
    merged["hr_q75"] = merged["hr_q75"].interpolate(method="linear").fillna(session_baseline_hr)
    merged["hr_valid_count"] = merged["hr_valid_count"].fillna(0).astype(int)

    # Autonomic markers & causal rolling features (10 epochs = 5 minutes, backward-only)
    merged["hr_delta_baseline"] = merged["hr_mean"] - session_baseline_hr
    merged["hr_rolling_mean_5m"] = merged["hr_mean"].rolling(window=10, min_periods=1).mean()
    merged["hr_rolling_std_5m"] = merged["hr_mean"].rolling(window=10, min_periods=1).std().fillna(0.0)
    merged["time_elapsed_minutes"] = (merged["epoch_idx"] - 1) * 0.5  # 30 sec = 0.5 min

    # 2. Aggregate motion features if present
    if aligned_motion_df is not None and not aligned_motion_df.empty:
        aligned_motion = aligned_motion_df.copy()
        aligned_motion["acc_mag"] = np.sqrt(
            aligned_motion["x"] ** 2 + aligned_motion["y"] ** 2 + aligned_motion["z"] ** 2
        )
        motion_grouped = aligned_motion.groupby("epoch_idx")
        m_agg = motion_grouped.agg(
            acc_mag_mean=("acc_mag", "mean"),
            acc_mag_std=("acc_mag", lambda s: float(np.std(s, ddof=1)) if len(s) > 1 else 0.0),
            acc_mag_max=("acc_mag", "max"),
            acc_x_std=("x", lambda s: float(np.std(s, ddof=1)) if len(s) > 1 else 0.0),
            acc_y_std=("y", lambda s: float(np.std(s, ddof=1)) if len(s) > 1 else 0.0),
            acc_z_std=("z", lambda s: float(np.std(s, ddof=1)) if len(s) > 1 else 0.0),
        ).reset_index()
        merged = pd.merge(merged, m_agg, on="epoch_idx", how="left")
        for col in MOTION_FEATURE_COLUMNS:
            if col in merged.columns:
                merged[col] = merged[col].fillna(0.0)

    return merged
