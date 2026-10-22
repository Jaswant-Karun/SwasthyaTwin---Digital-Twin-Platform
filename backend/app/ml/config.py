"""
SwasthyaTwin Machine Learning Configuration & Hyperparameters
Governs the real PhysioNet Sleep-Accel research pipeline with deterministic seeds and explicit paths.
"""

from pathlib import Path
from typing import Dict, List, Any

# Root paths (resolves relative to backend root)
BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BACKEND_ROOT / "data"
RAW_DATA_DIR = DATA_DIR / "raw" / "physionet_sleep_accel"
PROCESSED_DATA_DIR = DATA_DIR / "processed"
MODEL_ARTIFACTS_DIR = DATA_DIR / "models" / "sleep_staging"

# Deterministic random state for scientific reproducibility
RANDOM_SEED: int = 42

# Real research dataset provenance
DATASET_NAME: str = "PhysioNet Motion and Heart Rate from a Wrist-Worn Wearable and Labeled Sleep from Polysomnography"
DATASET_SHORT_NAME: str = "PhysioNet Sleep-Accel"
DATASET_VERSION: str = "1.0.0"
DATASET_DOI: str = "10.13026/hmhs-py35"
DATASET_URL: str = "https://physionet.org/content/sleep-accel/1.0.0/"
DATASET_CITATION: str = (
    "Walch, O., Huang, Y., Forger, D., & Goldstein, C. (2019). "
    "Sleep stage prediction with raw acceleration and photoplethysmography "
    "heart rate data derived from a consumer wearable device. SLEEP, 42(12), zsz180. "
    "https://doi.org/10.1093/sleep/zsz180"
)
DATASET_LICENSE: str = "Open Data Commons Attribution License v1.0 (ODC-By v1.0)"

# Machine learning model metadata
MODEL_NAME: str = "SwasthyaTwin Sleep-Stage Ensemble"
MODEL_VERSION: str = "1.0.0"
EPOCH_SECONDS: int = 30

# Standard clinical 3-class mapping from gold-standard PSG
# PSG original stages: 0=Wake, 1=N1, 2=N2, 3=N3, 4=N4 (if any), 5=REM
# Standard mapping: 0 -> 0 (Wake), 1/2/3/4 -> 1 (NREM), 5 -> 2 (REM)
RAW_STAGE_TO_CLASS: Dict[int, int] = {
    0: 0,  # Wake
    1: 1,  # N1 -> NREM
    2: 1,  # N2 -> NREM
    3: 1,  # N3 -> NREM
    4: 1,  # N4 -> NREM
    5: 2   # REM -> REM
}

CLASS_NAMES: Dict[int, str] = {
    0: "Wake",
    1: "NREM",
    2: "REM"
}

FEATURE_NAMES: List[str] = [
    "hr_mean",
    "hr_std",
    "hr_min",
    "hr_max",
    "hr_delta_baseline",
    "hr_rolling_mean_5m",
    "hr_rolling_std_5m",
    "time_elapsed_minutes"
]

# Group-aware train/test participant split
# 31 total participants: 25 train (with 5-fold GroupKFold), 6 held-out test
HELD_OUT_TEST_SUBJECTS_COUNT: int = 6
CV_FOLDS_COUNT: int = 5
