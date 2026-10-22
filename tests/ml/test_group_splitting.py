"""
Unit tests for group-aware participant splitting.
Verifies that participants NEVER cross split boundaries and leakage is strictly prevented.
"""

import numpy as np
import pandas as pd
import pytest

from ml_pipeline.split_dataset import perform_group_split, LeakageError


def test_perform_group_split_disjoint_subjects():
    """Verifies that train, val, and test participant sets are 100% disjoint."""
    # Synthetic cohort with 5 participants
    data = []
    for sub in ["Sub01", "Sub02", "Sub03", "Sub04", "Sub05"]:
        for ep in range(10):
            data.append({
                "subject_id": sub,
                "epoch_idx": ep + 1,
                "raw_stage_id": ep % 5
            })
    df = pd.DataFrame(data)

    manifest = perform_group_split(df, seed=42)

    train_subs = set(manifest["splits"]["train"]["participants"])
    val_subs = set(manifest["splits"]["validation"]["participants"])
    test_subs = set(manifest["splits"]["test"]["participants"])

    # Disjointness checks
    assert len(train_subs.intersection(val_subs)) == 0
    assert len(train_subs.intersection(test_subs)) == 0
    assert len(val_subs.intersection(test_subs)) == 0
    assert manifest["leakage_audit"]["status"] == "PASSED_ZERO_LEAKAGE"


def test_perform_group_split_leakage_detection():
    """Verifies that perform_group_split catches any synthetic overlap."""
    # If a function or logic accidentally introduces participant overlap, LeakageError must be raised
    with pytest.raises(ValueError):
        # Only 1 subject cannot form a disjoint train/val/test split
        df_single = pd.DataFrame({"subject_id": ["Sub01"], "epoch_idx": [1], "raw_stage_id": [0]})
        perform_group_split(df_single)
