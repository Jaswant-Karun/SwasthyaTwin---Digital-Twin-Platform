"""
SwasthyaTwin Machine Learning Preprocessor & Feature Engineering Engine
Extracts rolling physiological biomarkers from 30-second wearable photoplethysmography (PPG) epochs.
Strictly guards against data leakage by fitting scalers exclusively on the training split.
"""

from typing import Dict, List, Tuple, Optional
import os
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
import joblib

from app.ml.config import (
    EPOCH_SECONDS,
    RAW_STAGE_TO_CLASS,
    FEATURE_NAMES,
    PROCESSED_DATA_DIR
)
from app.ml.validator import validate_feature_dataframe

class SleepFeatureEngineer:
    """Extracts aligned 30-second epoch features from continuous wearable signals."""

    @staticmethod
    def extract_subject_features(
        subject_id: str,
        df_labels: pd.DataFrame,
        df_hr: pd.DataFrame
    ) -> pd.DataFrame:
        """
        Aligns continuous heart rate samples to each 30-second sleep stage epoch.
        Computes localized rolling features and circadian time progression.
        """
        if df_labels.empty or df_hr.empty:
            return pd.DataFrame()

        # Sort chronologically
        df_labels = df_labels.sort_values("timestamp_sec").reset_index(drop=True)
        df_hr = df_hr.sort_values("timestamp_sec").reset_index(drop=True)

        # Pre-sleep baseline HR: median of negative timestamps (pre-PSG) or first 5 mins of positive
        pre_sleep_hr = df_hr[df_hr["timestamp_sec"] <= 0]["bpm"]
        if len(pre_sleep_hr) >= 10:
            baseline_hr = float(pre_sleep_hr.median())
        else:
            baseline_hr = float(df_hr["bpm"].median())

        hr_times = df_hr["timestamp_sec"].values
        hr_values = df_hr["bpm"].values

        epoch_records = []
        for _, row in df_labels.iterrows():
            t_start = float(row["timestamp_sec"])
            t_end = t_start + EPOCH_SECONDS
            raw_stage = int(row["raw_stage"])

            if raw_stage not in RAW_STAGE_TO_CLASS:
                continue
            stage_class = RAW_STAGE_TO_CLASS[raw_stage]

            # Find HR values in this 30s epoch
            mask = (hr_times >= t_start) & (hr_times < t_end)
            epoch_bpm = hr_values[mask]

            # If no HR readings in exact 30s, expand window slightly (+/- 30s) or fallback to nearest
            if len(epoch_bpm) == 0:
                expanded_mask = (hr_times >= t_start - 30.0) & (hr_times <= t_end + 30.0)
                epoch_bpm = hr_values[expanded_mask]

            if len(epoch_bpm) == 0:
                # Find single nearest reading
                nearest_idx = np.argmin(np.abs(hr_times - t_start))
                epoch_bpm = np.array([hr_values[nearest_idx]])

            hr_mean = float(np.mean(epoch_bpm))
            hr_std = float(np.std(epoch_bpm)) if len(epoch_bpm) > 1 else 0.0
            hr_min = float(np.min(epoch_bpm))
            hr_max = float(np.max(epoch_bpm))
            hr_delta = float(hr_mean - baseline_hr)
            time_elapsed_min = float(max(0.0, t_start / 60.0))

            epoch_records.append({
                "subject_id": subject_id,
                "timestamp_sec": t_start,
                "hr_mean": hr_mean,
                "hr_std": hr_std,
                "hr_min": hr_min,
                "hr_max": hr_max,
                "hr_delta_baseline": hr_delta,
                "time_elapsed_minutes": time_elapsed_min,
                "label": stage_class
            })

        df_subj = pd.DataFrame(epoch_records)
        if df_subj.empty:
            return df_subj

        # Compute rolling 5-minute features (10 epochs = 300 seconds)
        # Using min_periods=1 so no initial NaNs are produced
        rolling_5m = df_subj["hr_mean"].rolling(window=10, min_periods=1)
        df_subj["hr_rolling_mean_5m"] = rolling_5m.mean().bfill().ffill()
        df_subj["hr_rolling_std_5m"] = rolling_5m.std().fillna(0.0)

        # Rearrange to standard order
        cols = ["subject_id", "timestamp_sec"] + FEATURE_NAMES + ["label"]
        return df_subj[cols]

class SleepFeatureScaler:
    """
    Standardizes feature vectors using statistics computed EXCLUSIVELY on the training split.
    Guarantees no future or test distribution leakage.
    """

    def __init__(self):
        self.scaler = StandardScaler()
        self.is_fitted = False

    def fit(self, X_train: np.ndarray) -> "SleepFeatureScaler":
        """Fits mean and std on training features only."""
        self.scaler.fit(X_train)
        self.is_fitted = True
        return self

    def transform(self, X: np.ndarray) -> np.ndarray:
        """Transforms input feature array using the fitted training statistics."""
        if not self.is_fitted:
            raise RuntimeError("SleepFeatureScaler must be fitted on training data before transform.")
        return self.scaler.transform(X)

    def fit_transform(self, X_train: np.ndarray) -> np.ndarray:
        return self.fit(X_train).transform(X_train)

    def save(self, filepath: str) -> None:
        """Serializes fitted scaler to disk."""
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        joblib.dump(self.scaler, filepath)

    def load(self, filepath: str) -> None:
        """Loads fitted scaler from disk."""
        self.scaler = joblib.load(filepath)
        self.is_fitted = True
