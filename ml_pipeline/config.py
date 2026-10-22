"""
SwasthyaTwin AI — BiDSleep ML Pipeline Configuration
Central configuration for dataset paths, feature schemas, class labels, and reproducibility settings.
"""

import os
from typing import List, Dict

# Paths
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RAW_DATA_DIR = os.path.join(BASE_DIR, "data", "raw", "bidsleep-dataset")
PROCESSED_DATA_DIR = os.path.join(BASE_DIR, "data", "processed")
MODELS_DIR = os.path.join(BASE_DIR, "models")
REPORTS_DIR = os.path.join(BASE_DIR, "reports")
DOCS_DIR = os.path.join(BASE_DIR, "docs")

# File paths
PROCESSED_FEATURES_CSV = os.path.join(PROCESSED_DATA_DIR, "bidsleep_features.csv")
PROCESSED_FEATURES_PARQUET = os.path.join(PROCESSED_DATA_DIR, "bidsleep_features.parquet")
SPLIT_MANIFEST_PATH = os.path.join(REPORTS_DIR, "split_manifest.json")
MODEL_EVALUATION_PATH = os.path.join(REPORTS_DIR, "model_evaluation.json")
PER_CLASS_METRICS_PATH = os.path.join(REPORTS_DIR, "per_class_metrics.csv")
CONFUSION_MATRIX_PATH = os.path.join(REPORTS_DIR, "confusion_matrix.png")
MODEL_ARTIFACT_PATH = os.path.join(MODELS_DIR, "sleep_stage_rf_model.joblib")
MODEL_METADATA_PATH = os.path.join(MODELS_DIR, "model_metadata.json")

# Dataset metadata & attribution
DATASET_NAME = "BiDSleep v1.0.1 (PhysioNet)"
DATASET_DOI = "10.13026/rees-1092"
DATASET_CITATION = (
    "Song, T.-A., Zhang, Y., Zhou, Z., & Dutta, J. (2026). "
    "A Multi-Night Instantaneous Heart Rate and Accelerometry Dataset with EEG Sleep Stage Labels (version 1.0.1). "
    "PhysioNet. https://doi.org/10.13026/rees-1092"
)
DATASET_LICENSE = "Open Data Commons Attribution License (ODC-By v1.0)"

# Reproducibility
RANDOM_SEED = 42

# Polysomnography standard: 30-second epoch window
EPOCH_DURATION_SECONDS = 30.0

# 5-Stage AASM Sleep Standard Mapping
# 0 = Wake, 1 = N1, 2 = N2, 3 = N3, 4 = REM, 5 = Unknown
SLEEP_STAGE_MAP: Dict[int, str] = {
    0: "Wake",
    1: "N1",
    2: "N2",
    3: "N3",
    4: "REM",
    5: "Unknown"
}

# Supervised training targets (excluding 5 = Unknown)
VALID_TARGET_CLASSES: List[int] = [0, 1, 2, 3, 4]
CLASS_NAMES_5: List[str] = ["Wake", "N1", "N2", "N3", "REM"]

# 3-Class clinical grouping (Wake, NREM, REM)
CLASS_3_MAP: Dict[int, int] = {
    0: 0,  # Wake
    1: 1,  # NREM (N1)
    2: 1,  # NREM (N2)
    3: 1,  # NREM (N3)
    4: 2   # REM
}
CLASS_NAMES_3: List[str] = ["Wake", "NREM", "REM"]

# Core wearable feature schema (derived strictly from concurrent 30s epoch wearable telemetry)
CORE_FEATURE_COLUMNS: List[str] = [
    "hr_mean",
    "hr_std",
    "hr_median",
    "hr_min",
    "hr_max",
    "hr_q25",
    "hr_q75",
    "hr_valid_count",
    "hr_delta_baseline",
    "hr_rolling_mean_5m",
    "hr_rolling_std_5m",
    "time_elapsed_minutes"
]

# Optional motion feature columns if accelerometry is available for the epoch
MOTION_FEATURE_COLUMNS: List[str] = [
    "acc_mag_mean",
    "acc_mag_std",
    "acc_mag_max",
    "acc_x_std",
    "acc_y_std",
    "acc_z_std"
]

# Context and metadata columns (NEVER passed into model feature matrix)
METADATA_COLUMNS: List[str] = [
    "sample_id",
    "subject_id",
    "night_id",
    "epoch_idx",
    "epoch_start_unix",
    "raw_stage_id",
    "stage_name",
    "stage_3class_id",
    "stage_3class_name"
]

# Memory management constraints for 8-16 GB RAM
CHUNK_SIZE_LINES = 50000
MAX_IN_MEMORY_EPOCHS = 100000
