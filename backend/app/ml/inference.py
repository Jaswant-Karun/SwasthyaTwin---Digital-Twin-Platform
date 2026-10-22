"""
SwasthyaTwin Machine Learning Inference Engine
Serves production predictions from serialized model artifacts with strict input validation,
quality audits, probability confidence, and scientific limitation disclosures.
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional
import numpy as np
import joblib

from app.ml.config import (
    MODEL_ARTIFACTS_DIR,
    FEATURE_NAMES,
    CLASS_NAMES,
    MODEL_VERSION,
    DATASET_VERSION
)
from app.ml.validator import validate_inference_features, InputFeatureValidationError

logger = logging.getLogger(__name__)

class SleepStageInferenceEngine:
    """Manages loaded production ML model artifacts and executes inference."""

    def __init__(self, artifacts_dir: Optional[str] = None):
        self.artifacts_dir = str(artifacts_dir) if artifacts_dir else str(MODEL_ARTIFACTS_DIR)
        self.model = None
        self.scaler = None
        self.manifest = {}
        self.is_loaded = False
        self._load_artifacts_if_present()

    def _load_artifacts_if_present(self) -> bool:
        """Attempts to load serialized models from disk."""
        model_path = os.path.join(self.artifacts_dir, "best_model.joblib")
        scaler_path = os.path.join(self.artifacts_dir, "scaler.joblib")
        manifest_path = os.path.join(self.artifacts_dir, "model_manifest.json")

        if os.path.exists(model_path) and os.path.exists(scaler_path) and os.path.exists(manifest_path):
            try:
                self.model = joblib.load(model_path)
                self.scaler = joblib.load(scaler_path)
                with open(manifest_path, "r", encoding="utf-8") as f:
                    self.manifest = json.load(f)
                self.is_loaded = True
                logger.info(f"Loaded sleep staging model artifacts from {self.artifacts_dir}")
                return True
            except Exception as e:
                logger.error(f"Error loading model artifacts: {e}")
                self.is_loaded = False
                return False
        return False

    def predict_epoch(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validates input features, scales with training statistics, and computes prediction.
        """
        if not self.is_loaded:
            # Attempt lazy reload
            if not self._load_artifacts_if_present():
                raise RuntimeError(
                    "Sleep Staging ML model has not been trained yet. "
                    "Run 'python scripts/train_pipeline.py' to generate artifacts."
                )

        # 1. Validate inputs
        is_valid, quality_status, warnings, feature_array = validate_inference_features(features)
        if not is_valid:
            raise InputFeatureValidationError(f"Invalid input features: {warnings}")

        # 2. Scale features using fitted training scaler
        scaled_features = self.scaler.transform(feature_array)

        # 3. Predict class
        predicted_class_id = int(self.model.predict(scaled_features)[0])
        predicted_stage_name = CLASS_NAMES.get(predicted_class_id, "Unknown")

        # 4. Probabilities
        class_probs = {}
        confidence = 100.0
        if hasattr(self.model, "predict_proba"):
            probs = self.model.predict_proba(scaled_features)[0]
            for c_id, c_name in CLASS_NAMES.items():
                class_probs[c_name] = round(float(probs[c_id]) * 100.0, 2)
            confidence = round(float(np.max(probs)) * 100.0, 2)
        else:
            class_probs = {c_name: 100.0 if c_id == predicted_class_id else 0.0 for c_id, c_name in CLASS_NAMES.items()}

        model_meta = self.manifest.get("model_metadata", {})
        baseline_comp = self.manifest.get("baseline_comparison", {})

        return {
            "predicted_stage_id": predicted_class_id,
            "predicted_stage_name": predicted_stage_name,
            "confidence_pct": confidence,
            "class_probabilities": class_probs,
            "input_quality_status": quality_status,
            "input_quality_warnings": warnings,
            "model_metadata": {
                "algorithm": model_meta.get("selected_algorithm", "Unknown"),
                "model_version": model_meta.get("version", MODEL_VERSION),
                "dataset_version": self.manifest.get("dataset_provenance", {}).get("version", DATASET_VERSION),
                "target_unit": "sleep_stage_3class",
                "evaluation_reference": "/api/v1/ml/sleep-stage/evaluation",
                "held_out_balanced_accuracy": baseline_comp.get("model_held_out_balanced_acc"),
                "held_out_macro_f1": baseline_comp.get("model_held_out_macro_f1"),
                "limitations": [
                    "Trained on 30s wearable PPG epochs; not a diagnostic substitute for 10-20 EEG polysomnography.",
                    "Sleep staging requires continuous motion-free photoplethysmography sensor alignment.",
                    "Class imbalance favors dominant NREM over REM/Wake transitions."
                ]
            },
            "clinical_disclaimer": (
                "Research demonstration model trained on PhysioNet sleep-accel wearable PPG. "
                "Non-diagnostic investigational tool; not for clinical diagnosis or medical decision making."
            )
        }

    def get_model_evaluation_summary(self) -> Dict[str, Any]:
        """Returns the full evaluation manifest for frontend and API reporting."""
        if not self.is_loaded:
            self._load_artifacts_if_present()
        if not self.manifest:
            return {
                "status": "not_trained",
                "message": "Model artifacts not generated yet."
            }
        return self.manifest

# Global inference engine singleton
inference_engine = SleepStageInferenceEngine()
