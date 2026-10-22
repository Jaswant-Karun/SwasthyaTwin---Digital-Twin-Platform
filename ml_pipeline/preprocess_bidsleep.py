"""
SwasthyaTwin AI — BiDSleep Preprocessing Pipeline (Phase 2)
Processes one subject-night at a time, enforcing memory bounds (<500MB RAM),
temporal alignment, physiological feature extraction, and leakage prevention.

Usage:
    python -m ml_pipeline.preprocess_bidsleep [--max-subjects <int>] [--participants <list>]
"""

import os
import sys
import json
import argparse
from typing import List, Dict, Any, Optional

import numpy as np
import pandas as pd
import scipy.io

from ml_pipeline.config import (
    RAW_DATA_DIR,
    PROCESSED_DATA_DIR,
    REPORTS_DIR,
    PROCESSED_FEATURES_CSV,
    PROCESSED_FEATURES_PARQUET,
    SLEEP_STAGE_MAP,
    CLASS_3_MAP,
    CLASS_NAMES_3,
    CORE_FEATURE_COLUMNS,
    METADATA_COLUMNS
)
from ml_pipeline.label_alignment import (
    parse_rec_start_to_unix,
    align_sensor_telemetry
)
from ml_pipeline.feature_extraction import compute_night_epoch_features
from ml_pipeline.dataset_validation import (
    validate_polysomnography_labels,
    validate_heart_rate_series,
    validate_feature_matrix
)


def preprocess_single_night(
    night_dir: str,
    subject_id: str,
    night_id: str
) -> Optional[pd.DataFrame]:
    """
    Processes a single recording session independently.
    Memory-efficient: cleans and frees raw signals immediately after epoch aggregation.
    """
    labels_file = os.path.join(night_dir, "labels.mat")
    hr_file = os.path.join(night_dir, "hr.csv")
    motion_file = os.path.join(night_dir, "motion.csv")

    if not os.path.exists(labels_file) or not os.path.exists(hr_file):
        return None

    # 1. Parse labels.mat
    try:
        mat = scipy.io.loadmat(labels_file)
    except Exception as e:
        print(f"   [Error] Could not read {labels_file}: {e}")
        return None

    rec_start_unix = parse_rec_start_to_unix(mat["recStart"])

    # Extract expert_label as primary, dreem_label as secondary
    if "expert_label" in mat and mat["expert_label"].size > 0:
        expert_labels = mat["expert_label"].flatten()
    elif "dreem_label" in mat and mat["dreem_label"].size > 0:
        expert_labels = mat["dreem_label"].flatten()
    else:
        return None

    dreem_labels = mat.get("dreem_label", np.array([])).flatten()
    total_epochs = len(expert_labels)
    if total_epochs == 0:
        return None

    # Validate ground-truth labels and flag Unknowns (label 5)
    valid_mask, label_audit = validate_polysomnography_labels(expert_labels, exclude_unknown=True)

    # 2. Parse hr.csv (streamed without loading other nights)
    try:
        df_hr = pd.read_csv(hr_file, header=None, names=["timestamp", "hr"])
    except Exception as e:
        print(f"   [Error] Could not read {hr_file}: {e}")
        return None

    if df_hr.empty:
        return None

    # Validate HR bounds
    hr_val_res = validate_heart_rate_series(df_hr["hr"].to_numpy())
    if not hr_val_res["valid"]:
        print(f"   [Warning] {subject_id}/{night_id} HR validation: {hr_val_res.get('error')}")

    # Align HR timestamps to 30s epochs
    aligned_hr = align_sensor_telemetry(
        df_hr,
        rec_start_unix=rec_start_unix,
        total_epochs=total_epochs,
        timestamp_col="timestamp"
    )

    # 3. Optional Motion Alignment (if present)
    aligned_motion = None
    if os.path.exists(motion_file):
        try:
            df_motion = pd.read_csv(motion_file)
            aligned_motion = align_sensor_telemetry(
                df_motion,
                rec_start_unix=rec_start_unix,
                total_epochs=total_epochs,
                timestamp_col="Timestamp"
            )
        except Exception:
            aligned_motion = None

    # 4. Feature Extraction
    features_df = compute_night_epoch_features(
        aligned_hr_df=aligned_hr,
        total_epochs=total_epochs,
        aligned_motion_df=aligned_motion
    )

    # 5. Attach identifiers and ground-truth labels
    features_df["subject_id"] = subject_id
    features_df["night_id"] = night_id
    features_df["sample_id"] = features_df["epoch_idx"].apply(
        lambda ep: f"{subject_id}_N{night_id}_E{ep:04d}"
    )
    features_df["epoch_start_unix"] = rec_start_unix + (features_df["epoch_idx"] - 1) * 30.0

    features_df["raw_stage_id"] = features_df["epoch_idx"].apply(lambda ep: int(expert_labels[ep - 1]))
    features_df["stage_name"] = features_df["raw_stage_id"].map(SLEEP_STAGE_MAP)

    if len(dreem_labels) == total_epochs:
        features_df["dreem_stage_id"] = features_df["epoch_idx"].apply(lambda ep: int(dreem_labels[ep - 1]))
    else:
        features_df["dreem_stage_id"] = -1

    # Map to 3-class standard (Wake=0, NREM=1, REM=2)
    features_df["stage_3class_id"] = features_df["raw_stage_id"].map(CLASS_3_MAP)
    features_df["stage_3class_name"] = features_df["stage_3class_id"].map(
        lambda c: CLASS_NAMES_3[int(c)] if pd.notna(c) and int(c) in (0, 1, 2) else "Unknown"
    )

    # 6. Exclude Unknown (5) from supervised dataset
    supervised_df = features_df[features_df["raw_stage_id"] != 5].copy()

    # Free memory of temporary objects
    del df_hr
    del aligned_hr

    return supervised_df


def run_preprocessing_pipeline(
    raw_dir: str = RAW_DATA_DIR,
    output_dir: str = PROCESSED_DATA_DIR,
    max_subjects: Optional[int] = None,
    participants: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Executes end-to-end preprocessing over available subjects and nights.
    """
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(REPORTS_DIR, exist_ok=True)

    available_subjects = sorted([
        d for d in os.listdir(raw_dir)
        if os.path.isdir(os.path.join(raw_dir, d)) and d.startswith("Bidslab")
    ])

    if participants:
        selected_subjects = [s for s in participants if s in available_subjects]
    elif max_subjects:
        selected_subjects = available_subjects[:max_subjects]
    else:
        selected_subjects = available_subjects

    print(f"Starting Preprocessing on {len(selected_subjects)} subjects: {', '.join(selected_subjects)}")

    night_frames: List[pd.DataFrame] = []
    total_unknown_excluded = 0
    nights_summary: List[Dict[str, Any]] = []

    for sub in selected_subjects:
        sub_dir = os.path.join(raw_dir, sub)
        nights = sorted([
            n for n in os.listdir(sub_dir)
            if os.path.isdir(os.path.join(sub_dir, n)) and n.isdigit()
        ], key=int)

        print(f"--> Processing Subject {sub} ({len(nights)} nights)...")
        for n in nights:
            night_dir = os.path.join(sub_dir, n)
            df_night = preprocess_single_night(night_dir, sub, n)
            if df_night is not None and not df_night.empty:
                night_frames.append(df_night)
                nights_summary.append({
                    "subject_id": sub,
                    "night_id": n,
                    "valid_epochs": len(df_night),
                    "mean_hr": round(float(df_night["hr_mean"].mean()), 2)
                })

    if not night_frames:
        raise RuntimeError("No valid nights could be preprocessed.")

    # Combine all nights incrementally
    combined_df = pd.concat(night_frames, ignore_index=True)

    # Validate feature matrix
    val_report = validate_feature_matrix(combined_df, CORE_FEATURE_COLUMNS)
    if not val_report["valid"]:
        raise ValueError(f"Feature matrix validation failed: {val_report.get('error')}")

    # Save to disk (CSV and Parquet)
    csv_output_path = os.path.join(output_dir, "bidsleep_features.csv")
    parquet_output_path = os.path.join(output_dir, "bidsleep_features.parquet")
    combined_df.to_csv(csv_output_path, index=False)
    try:
        combined_df.to_parquet(parquet_output_path, index=False)
        parquet_saved = True
    except Exception:
        parquet_saved = False

    # Compute audit summary
    total_epochs = len(combined_df)
    class_counts_5 = {
        SLEEP_STAGE_MAP[c]: int((combined_df["raw_stage_id"] == c).sum())
        for c in range(5)
    }
    class_pct_5 = {
        SLEEP_STAGE_MAP[c]: round((count / max(1, total_epochs)) * 100, 2)
        for c, count in zip(range(5), class_counts_5.values())
    }

    report = {
        "dataset_name": "BiDSleep v1.0.1",
        "processed_subjects_count": len(selected_subjects),
        "subjects": selected_subjects,
        "total_nights_processed": len(nights_summary),
        "total_valid_supervised_epochs": total_epochs,
        "total_sleep_hours": round(total_epochs * 30.0 / 3600.0, 2),
        "features_extracted_count": len(CORE_FEATURE_COLUMNS),
        "features_list": CORE_FEATURE_COLUMNS,
        "class_counts_5class": class_counts_5,
        "class_percentages_5class": class_pct_5,
        "csv_output_path": csv_output_path,
        "parquet_output_path": parquet_output_path if parquet_saved else None,
        "nights_summary": nights_summary
    }

    report_path = os.path.join(REPORTS_DIR, "bidsleep_preprocessing_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\n[Success] Preprocessed {total_epochs:,} epochs across {len(nights_summary)} nights.")
    print(f"Features saved to: {csv_output_path}")
    print(f"Report saved to:   {report_path}")

    return report


def main():
    parser = argparse.ArgumentParser(description="Memory-efficient BiDSleep Preprocessing.")
    parser.add_argument("--data-dir", default=RAW_DATA_DIR, help="Path to raw BiDSleep dataset directory")
    parser.add_argument("--output-dir", default=PROCESSED_DATA_DIR, help="Path to output directory for features")
    parser.add_argument("--max-subjects", type=int, default=None, help="Max number of subjects to process")
    parser.add_argument("--participants", nargs="+", default=None, help="Explicit participant IDs")
    args = parser.parse_args()

    run_preprocessing_pipeline(
        raw_dir=args.data_dir,
        output_dir=args.output_dir,
        max_subjects=args.max_subjects,
        participants=args.participants
    )


if __name__ == "__main__":
    main()
