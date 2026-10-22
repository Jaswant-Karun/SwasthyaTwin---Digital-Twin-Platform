"""
SwasthyaTwin AI — Leakage-Resistant Participant-Level Dataset Splitter (Phase 3)
Enforces strict group-aware splitting: all epochs from a participant belong exclusively
to Train, Validation, or Test. Never mixes epochs from the same participant across splits.
"""

import os
import sys
import json
import argparse
from typing import Dict, Any, List, Tuple, Set

import numpy as np
import pandas as pd

from ml_pipeline.config import (
    PROCESSED_FEATURES_CSV,
    SPLIT_MANIFEST_PATH,
    RANDOM_SEED,
    SLEEP_STAGE_MAP
)


class LeakageError(Exception):
    """Raised when participant leakage is detected across split boundaries."""
    pass


def perform_group_split(
    df: pd.DataFrame,
    seed: int = RANDOM_SEED,
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15
) -> Dict[str, Any]:
    """
    Partitions participants into disjoint Train, Validation, and Test sets.
    Verifies that train_subs ∩ val_subs ∩ test_subs == ∅.
    """
    if "subject_id" not in df.columns:
        raise ValueError("DataFrame must contain 'subject_id' column for group-aware splitting.")

    subjects = sorted(list(df["subject_id"].unique()))
    n_subjects = len(subjects)

    if n_subjects == 0:
        raise ValueError("No subjects found in dataset.")

    rng = np.random.RandomState(seed)
    shuffled_subjects = list(rng.permutation(subjects))

    if n_subjects == 1:
        raise ValueError("Cannot perform train/val/test split with only 1 participant.")
    elif n_subjects == 2:
        # 1 train, 0 val, 1 test
        train_subs = [shuffled_subjects[0]]
        val_subs = []
        test_subs = [shuffled_subjects[1]]
    elif n_subjects == 3:
        # Exactly 1 for train, 1 for val, 1 for test (disjoint single-subject splits)
        train_subs = [shuffled_subjects[0]]
        val_subs = [shuffled_subjects[1]]
        test_subs = [shuffled_subjects[2]]
    else:
        n_test = max(1, int(round(n_subjects * test_ratio)))
        n_val = max(1, int(round(n_subjects * val_ratio)))
        n_train = n_subjects - n_val - n_test
        if n_train < 1:
            n_train = 1
            if n_val > 1:
                n_val -= 1
            else:
                n_test -= 1

        train_subs = sorted(shuffled_subjects[:n_train])
        val_subs = sorted(shuffled_subjects[n_train:n_train + n_val])
        test_subs = sorted(shuffled_subjects[n_train + n_val:])

    # Strict Leakage Verification
    s_train: Set[str] = set(train_subs)
    s_val: Set[str] = set(val_subs)
    s_test: Set[str] = set(test_subs)

    leakage_train_val = s_train.intersection(s_val)
    leakage_train_test = s_train.intersection(s_test)
    leakage_val_test = s_val.intersection(s_test)

    if leakage_train_val or leakage_train_test or leakage_val_test:
        raise LeakageError(
            f"Participant Leakage Detected!\n"
            f"Train/Val Overlap: {leakage_train_val}\n"
            f"Train/Test Overlap: {leakage_train_test}\n"
            f"Val/Test Overlap: {leakage_val_test}"
        )

    # Compile subset DataFrames
    df_train = df[df["subject_id"].isin(s_train)].copy()
    df_val = df[df["subject_id"].isin(s_val)].copy() if s_val else pd.DataFrame()
    df_test = df[df["subject_id"].isin(s_test)].copy()

    def get_class_dist(subset: pd.DataFrame) -> Dict[str, int]:
        if subset.empty or "raw_stage_id" not in subset.columns:
            return {}
        counts = subset["raw_stage_id"].value_counts().to_dict()
        return {SLEEP_STAGE_MAP.get(k, f"Class_{k}"): int(v) for k, v in sorted(counts.items())}

    manifest = {
        "dataset": "BiDSleep v1.0.1",
        "random_seed": seed,
        "total_participants": n_subjects,
        "all_participants": subjects,
        "splits": {
            "train": {
                "participant_count": len(train_subs),
                "participants": train_subs,
                "epoch_count": len(df_train),
                "epoch_percentage": round((len(df_train) / max(1, len(df))) * 100, 2),
                "class_distribution": get_class_dist(df_train)
            },
            "validation": {
                "participant_count": len(val_subs),
                "participants": val_subs,
                "epoch_count": len(df_val),
                "epoch_percentage": round((len(df_val) / max(1, len(df))) * 100, 2),
                "class_distribution": get_class_dist(df_val)
            },
            "test": {
                "participant_count": len(test_subs),
                "participants": test_subs,
                "epoch_count": len(df_test),
                "epoch_percentage": round((len(df_test) / max(1, len(df))) * 100, 2),
                "class_distribution": get_class_dist(df_test)
            }
        },
        "leakage_audit": {
            "status": "PASSED_ZERO_LEAKAGE",
            "train_val_overlap": list(leakage_train_val),
            "train_test_overlap": list(leakage_train_test),
            "val_test_overlap": list(leakage_val_test)
        }
    }

    return manifest


def main():
    parser = argparse.ArgumentParser(description="Create group-aware train/val/test split manifest.")
    parser.add_argument("--features-csv", default=PROCESSED_FEATURES_CSV, help="Path to processed features CSV")
    parser.add_argument("--output-manifest", default=SPLIT_MANIFEST_PATH, help="Output manifest path")
    parser.add_argument("--seed", type=int, default=RANDOM_SEED, help="Random seed")
    args = parser.parse_args()

    print("=" * 70)
    print("SwasthyaTwin AI — Leakage-Resistant Participant Splitting")
    print("=" * 70)

    if not os.path.exists(args.features_csv):
        print(f"Error: Processed features not found at {args.features_csv}")
        print("Please run `python -m ml_pipeline.preprocess_bidsleep` first.")
        sys.exit(1)

    df = pd.read_csv(args.features_csv)
    manifest = perform_group_split(df, seed=args.seed)

    os.makedirs(os.path.dirname(os.path.abspath(args.output_manifest)), exist_ok=True)
    with open(args.output_manifest, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"\nManifest successfully created at: {args.output_manifest}")
    for split_name, split_data in manifest["splits"].items():
        print(f"\n[{split_name.upper()}] Participants: {split_data['participants']}")
        print(f"Epochs: {split_data['epoch_count']:,} ({split_data['epoch_percentage']}%)")
        print(f"Classes: {split_data['class_distribution']}")

    print(f"\nLeakage Audit: {manifest['leakage_audit']['status']}")


if __name__ == "__main__":
    main()
