"""
SwasthyaTwin Real Research Dataset Loader
Reads, inspects, and parses authentic PhysioNet Sleep-Accel subject files.
Strictly separated from synthetic demonstration data and MongoDB operational records.
"""

import os
import glob
import logging
from typing import Dict, List, Tuple, Optional, Any
import numpy as np
import pandas as pd

from app.ml.config import RAW_DATA_DIR, DATASET_NAME, DATASET_VERSION
from app.ml.validator import validate_raw_subject_files, DatasetValidationError

logger = logging.getLogger(__name__)

class PhysioNetSleepDatasetLoader:
    """Loads and validates genuine PhysioNet Sleep-Accel wearable recordings."""

    def __init__(self, raw_dir: Optional[str] = None):
        self.raw_dir = str(raw_dir) if raw_dir else str(RAW_DATA_DIR)
        self.labels_dir = os.path.join(self.raw_dir, "labels")
        self.hr_dir = os.path.join(self.raw_dir, "heart_rate")

    def get_available_subject_ids(self) -> List[str]:
        """Returns sorted list of verified subject IDs having both HR and label files."""
        if not os.path.exists(self.labels_dir) or not os.path.exists(self.hr_dir):
            return []

        label_files = glob.glob(os.path.join(self.labels_dir, "*_labeled_sleep.txt"))
        hr_files = glob.glob(os.path.join(self.hr_dir, "*_heartrate.txt"))

        label_ids = set(os.path.basename(f).replace("_labeled_sleep.txt", "") for f in label_files)
        hr_ids = set(os.path.basename(f).replace("_heartrate.txt", "") for f in hr_files)

        common_ids = sorted(list(label_ids.intersection(hr_ids)))
        return common_ids

    def verify_dataset_integrity(self) -> Dict[str, Any]:
        """
        Inspects all subjects in raw data directory, validating physical files and format.
        Fails loudly if files are missing or corrupted.
        """
        subject_ids = self.get_available_subject_ids()
        if not subject_ids:
            return {
                "dataset_name": DATASET_NAME,
                "version": DATASET_VERSION,
                "is_available": False,
                "subject_count": 0,
                "error": f"Raw data directory '{self.raw_dir}' is missing or contains no valid subject pairs."
            }

        valid_subjects = []
        errors = []
        total_epochs = 0
        total_hr_samples = 0

        for s_id in subject_ids:
            hr_path = os.path.join(self.hr_dir, f"{s_id}_heartrate.txt")
            label_path = os.path.join(self.labels_dir, f"{s_id}_labeled_sleep.txt")
            try:
                stats = validate_raw_subject_files(s_id, hr_path, label_path)
                valid_subjects.append(s_id)
                total_epochs += stats["epoch_count"]
                total_hr_samples += stats["hr_samples_count"]
            except DatasetValidationError as e:
                errors.append(str(e))

        is_healthy = len(errors) == 0 and len(valid_subjects) >= 10
        return {
            "dataset_name": DATASET_NAME,
            "version": DATASET_VERSION,
            "is_available": is_healthy,
            "subject_count": len(valid_subjects),
            "total_epochs": total_epochs,
            "total_hr_samples": total_hr_samples,
            "subject_ids": valid_subjects,
            "validation_errors": errors
        }

    def load_subject_raw_data(self, subject_id: str) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """
        Loads raw time-series for a single subject:
        Returns:
            df_labels: columns ['timestamp_sec', 'raw_stage']
            df_hr: columns ['timestamp_sec', 'bpm']
        """
        hr_path = os.path.join(self.hr_dir, f"{subject_id}_heartrate.txt")
        label_path = os.path.join(self.labels_dir, f"{subject_id}_labeled_sleep.txt")

        if not os.path.exists(hr_path) or not os.path.exists(label_path):
            raise FileNotFoundError(f"Data files for subject {subject_id} not found in {self.raw_dir}")

        # Parse labels: whitespace separated: timestamp stage
        label_rows = []
        with open(label_path, "r", encoding="utf-8") as f:
            for line in f:
                parts = line.strip().split()
                if len(parts) == 2:
                    label_rows.append((float(parts[0]), int(parts[1])))
        df_labels = pd.DataFrame(label_rows, columns=["timestamp_sec", "raw_stage"])

        # Parse heart rate: comma separated: timestamp,bpm
        hr_rows = []
        with open(hr_path, "r", encoding="utf-8") as f:
            for line in f:
                parts = line.strip().split(",")
                if len(parts) == 2:
                    hr_rows.append((float(parts[0]), float(parts[1])))
        df_hr = pd.DataFrame(hr_rows, columns=["timestamp_sec", "bpm"])

        return df_labels, df_hr

# Global singleton loader
dataset_loader = PhysioNetSleepDatasetLoader()
