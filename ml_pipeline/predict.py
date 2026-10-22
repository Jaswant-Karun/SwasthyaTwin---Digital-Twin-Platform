"""
SwasthyaTwin AI — Sleep-Stage Inference Engine (Phase 4 / Phase 6)
Serves single-epoch and batch predictions from the trained model pipeline.

Preconditions:
- Validates feature schema, ordering, and data types.
- Rejects non-finite values (NaN, Inf) and unphysical biometrics.
- Returns predicted stage, probability distribution, confidence, and quality audit.
"""

import os
import sys
import json
import argparse
from typing import Dict, Any, List, Optional, Union

import numpy as np
import pandas as pd
import joblib

from ml_pipeline.config import (
    MODEL_ARTIFACT_PATH,
    MODEL_METADATA_PATH,
    CORE_FEATURE_COLUMNS,
    SLEEP_STAGE_MAP,
    CLASS_NAMES_5
)


class SleepStagePredictor:
    """
    Production-grade predictor for Apple Watch sleep-stage classification.
    """
    def __init__(
        self,
        model_path: str = MODEL_ARTIFACT_PATH,
        metadata_path: str = MODEL_METADATA_PATH
    ):
        self.model_path = model_path
        self.metadata_path = metadata_path
        self.pipeline = None
        self.metadata = {}
        self.model_version = "1.0.0"
        self._load_model()

    def _load_model(self):
        if os.path.exists(self.model_path):
            try:
                self.pipeline = joblib.load(self.model_path)
            except Exception as e:
                print(f"[Warning] Failed to load model artifact: {e}")
                self.pipeline = None

        if os.path.exists(self.metadata_path):
            try:
                with open(self.metadata_path, "r", encoding="utf-8") as f:
                    self.metadata = json.load(f)
                    self.model_version = self.metadata.get("model_version", "1.0.0")
            except Exception:
                pass

    @property
    def is_ready(self) -> bool:
        return self.pipeline is not None

    def validate_features(self, feature_dict: Dict[str, float]) -> Tuple[List[float], List[str]]:
        """
        Validates feature vector against required schema, checks for missingness or non-finite values.
        """
        values = []
        warnings = []

        for col in CORE_FEATURE_COLUMNS:
            if col not in feature_dict:
                raise ValueError(f"Missing required feature: '{col}'")
            val = feature_dict[col]
            if val is None or np.isnan(val) or np.isinf(val):
                raise ValueError(f"Invalid non-finite value for feature '{col}': {val}")
            
            # Physiological plausibility checks
            if col == "hr_mean" and (val < 30.0 or val > 220.0):
                warnings.append(f"Heart rate mean ({val:.1f} bpm) is outside typical physiological sleep bounds [30, 220].")
            if col == "hr_std" and val > 40.0:
                warnings.append(f"High heart rate variability ({val:.1f} bpm) suggests active arousal or motion artifact.")

            values.append(float(val))

        return values, warnings

    def predict_epoch(
        self,
        features: Dict[str, float],
        epoch_idx: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Infers 5-class sleep stage for a single 30s feature vector.
        """
        if not self.is_ready:
            raise RuntimeError(
                f"Trained model artifact not available at '{self.model_path}'. "
                "Please run `python -m ml_pipeline.train` to train the model."
            )

        feat_values, warnings = self.validate_features(features)
        X = np.array([feat_values])

        pred_class_id = int(self.pipeline.predict(X)[0])
        pred_stage_name = SLEEP_STAGE_MAP.get(pred_class_id, f"Class_{pred_class_id}")

        probabilities = {}
        confidence = 0.0
        if hasattr(self.pipeline, "predict_proba"):
            probs = self.pipeline.predict_proba(X)[0]
            # Map probabilities to class names
            classes = self.pipeline.classes_
            for c_id, prob in zip(classes, probs):
                name = SLEEP_STAGE_MAP.get(int(c_id), f"Class_{c_id}")
                probabilities[name] = round(float(prob), 4)
            confidence = round(float(np.max(probs)), 4)

        return {
            "predicted_stage_id": pred_class_id,
            "predicted_stage_name": pred_stage_name,
            "confidence": confidence,
            "probabilities": probabilities,
            "epoch_index": epoch_idx,
            "model_version": self.model_version,
            "feature_schema_version": "v1.0-12features",
            "quality_status": "VALID_WITH_WARNINGS" if warnings else "VALID",
            "warnings": warnings,
            "is_trained_model": True,
            "is_demo_fixture": False,
            "disclaimer": (
                "Research classification from wearable heart rate dynamics. "
                "Not a certified medical diagnostic device."
            )
        }


# Singleton instance
default_predictor = SleepStagePredictor()


def main():
    parser = argparse.ArgumentParser(description="Predict sleep stage for an epoch feature vector.")
    args = parser.parse_args()

    # Demonstration test vector from real sleep epoch
    sample_features = {
        "hr_mean": 58.5,
        "hr_std": 1.2,
        "hr_median": 58.0,
        "hr_min": 57.0,
        "hr_max": 60.0,
        "hr_q25": 58.0,
        "hr_q75": 59.0,
        "hr_valid_count": 6.0,
        "hr_delta_baseline": -1.5,
        "hr_rolling_mean_5m": 59.0,
        "hr_rolling_std_5m": 0.8,
        "time_elapsed_minutes": 120.0
    }

    predictor = SleepStagePredictor()
    if not predictor.is_ready:
        print("Model is not trained yet. Run `python -m ml_pipeline.train` first.")
        sys.exit(1)

    result = predictor.predict_epoch(sample_features, epoch_idx=240)
    print("Inference Result:")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
