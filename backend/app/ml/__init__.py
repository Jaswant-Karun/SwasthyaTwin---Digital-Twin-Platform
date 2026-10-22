"""
SwasthyaTwin Machine Learning Package
Provides reproducible, leakage-free machine learning pipelines for wearable digital twins.
"""

from app.ml.config import (
    DATASET_NAME,
    DATASET_VERSION,
    MODEL_NAME,
    MODEL_VERSION,
    FEATURE_NAMES,
    CLASS_NAMES,
    RANDOM_SEED
)
from app.ml.dataset_loader import dataset_loader, PhysioNetSleepDatasetLoader
from app.ml.preprocessor import SleepFeatureEngineer, SleepFeatureScaler
from app.ml.validator import validate_inference_features, validate_raw_subject_files, InputFeatureValidationError
from app.ml.evaluator import ModelEvaluator
from app.ml.trainer import pipeline_trainer, SleepMLPipelineTrainer
from app.ml.inference import inference_engine, SleepStageInferenceEngine

__all__ = [
    "DATASET_NAME",
    "DATASET_VERSION",
    "MODEL_NAME",
    "MODEL_VERSION",
    "FEATURE_NAMES",
    "CLASS_NAMES",
    "RANDOM_SEED",
    "dataset_loader",
    "PhysioNetSleepDatasetLoader",
    "SleepFeatureEngineer",
    "SleepFeatureScaler",
    "validate_inference_features",
    "validate_raw_subject_files",
    "InputFeatureValidationError",
    "ModelEvaluator",
    "pipeline_trainer",
    "SleepMLPipelineTrainer",
    "inference_engine",
    "SleepStageInferenceEngine"
]
