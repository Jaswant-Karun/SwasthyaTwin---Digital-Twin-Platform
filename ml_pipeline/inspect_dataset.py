"""
SwasthyaTwin AI — BiDSleep Dataset Inspector (Phase 1)
Memory-conscious audit and schema verification of BiDSleep v1.0.1 on local disk.

Features:
- Validates local directory structure and file integrity.
- Memory-conscious: streams CSVs line-by-line or in small chunks, never loading full nights into RAM.
- Inspects MATLAB `labels.mat` files, extracting recStart, expert_label, dreem_label.
- Computes per-subject and per-night statistics, class distribution, missingness, timestamp ranges.
- Outputs machine-readable report to reports/bidsleep_inspection_report.json.

Usage:
    python -m ml_pipeline.inspect_dataset [--data-dir <path>] [--output <path>]
"""

import os
import sys
import json
import argparse
import zoneinfo
from datetime import datetime
from typing import Dict, Any, List, Optional

import numpy as np
import scipy.io

from ml_pipeline.config import (
    RAW_DATA_DIR,
    REPORTS_DIR,
    SLEEP_STAGE_MAP,
    DATASET_NAME,
    DATASET_DOI,
    DATASET_CITATION,
    DATASET_LICENSE
)


def parse_rec_start(mat_obj: Dict[str, Any]) -> Dict[str, Any]:
    """
    Safely inspects and decodes `recStart` from labels.mat without assumptions.
    Returns parsed string, raw representation, and UTC unix timestamp.
    """
    if "recStart" not in mat_obj:
        return {"error": "recStart variable missing from MAT file"}
    
    val = mat_obj["recStart"]
    raw_repr = repr(val)
    
    # Handle numpy ndarray of strings or object array
    if isinstance(val, np.ndarray):
        if val.size == 0:
            return {"error": "recStart is empty ndarray"}
        rec_str = str(val.flat[0]).strip()
    elif isinstance(val, (list, tuple)):
        rec_str = str(val[0]).strip()
    else:
        rec_str = str(val).strip()

    # Documentation: recStart is stored as human-readable time in U.S. Eastern Time (America/New_York)
    try:
        dt_et = datetime.strptime(rec_str, "%Y-%m-%d %H:%M:%S").replace(
            tzinfo=zoneinfo.ZoneInfo("America/New_York")
        )
        unix_ts = dt_et.timestamp()
        iso_utc = dt_et.astimezone(zoneinfo.ZoneInfo("UTC")).isoformat()
        return {
            "raw_str": rec_str,
            "raw_type": type(val).__name__,
            "timezone": "America/New_York (U.S. Eastern)",
            "unix_timestamp": unix_ts,
            "iso_utc": iso_utc,
            "valid": True
        }
    except Exception as e:
        return {
            "raw_str": rec_str,
            "raw_type": type(val).__name__,
            "error": f"Failed to parse datetime: {e}",
            "valid": False
        }


def inspect_night_folder(night_path: str, subject_id: str, night_id: str) -> Dict[str, Any]:
    """
    Audits a single subject-night directory using streaming / memory-efficient inspection.
    """
    files_present = os.listdir(night_path)
    summary: Dict[str, Any] = {
        "subject_id": subject_id,
        "night_id": night_id,
        "files_present": files_present,
        "hr_csv_present": "hr.csv" in files_present,
        "labels_mat_present": "labels.mat" in files_present,
        "motion_csv_present": "motion.csv" in files_present,
    }

    # 1. Audit labels.mat
    labels_file = os.path.join(night_path, "labels.mat")
    if os.path.exists(labels_file):
        try:
            mat = scipy.io.loadmat(labels_file)
            summary["labels_mat_keys"] = [k for k in mat.keys() if not k.startswith("__")]
            
            # Check recStart
            rec_info = parse_rec_start(mat)
            summary["rec_start"] = rec_info
            
            # Check expert_label
            if "expert_label" in mat and mat["expert_label"].size > 0:
                el = mat["expert_label"].flatten()
                summary["expert_label_count"] = int(len(el))
                summary["expert_label_shape"] = list(mat["expert_label"].shape)
                unique_classes, counts = np.unique(el, return_counts=True)
                summary["expert_label_distribution"] = {
                    int(c): int(cnt) for c, cnt in zip(unique_classes, counts)
                }
                summary["has_expert_label"] = True
            else:
                summary["has_expert_label"] = False
                summary["expert_label_count"] = 0

            # Check dreem_label
            if "dreem_label" in mat and mat["dreem_label"].size > 0:
                dl = mat["dreem_label"].flatten()
                summary["dreem_label_count"] = int(len(dl))
                summary["has_dreem_label"] = True
            else:
                summary["has_dreem_label"] = False
                summary["dreem_label_count"] = 0

        except Exception as e:
            summary["labels_mat_error"] = str(e)

    # 2. Audit hr.csv (Streaming line-by-line: memory footprint < 100 KB)
    hr_file = os.path.join(night_path, "hr.csv")
    if os.path.exists(hr_file):
        try:
            hr_count = 0
            hr_min = float("inf")
            hr_max = float("-inf")
            hr_sum = 0.0
            ts_first = None
            ts_last = None
            invalid_lines = 0

            with open(hr_file, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    parts = line.split(",")
                    if len(parts) >= 2:
                        try:
                            ts = float(parts[0])
                            hr = float(parts[1])
                            if ts_first is None:
                                ts_first = ts
                            ts_last = ts
                            hr_min = min(hr_min, hr)
                            hr_max = max(hr_max, hr)
                            hr_sum += hr
                            hr_count += 1
                        except ValueError:
                            invalid_lines += 1
                    else:
                        invalid_lines += 1

            summary["hr_samples_count"] = hr_count
            summary["hr_invalid_lines"] = invalid_lines
            if hr_count > 0:
                summary["hr_min"] = round(hr_min, 1)
                summary["hr_max"] = round(hr_max, 1)
                summary["hr_mean"] = round(hr_sum / hr_count, 1)
                summary["hr_timestamp_range_unix"] = [ts_first, ts_last]
                duration_hrs = round((ts_last - ts_first) / 3600.0, 2) if ts_last and ts_first else 0.0
                summary["hr_duration_hours"] = duration_hrs
                summary["hr_approx_hz"] = round(hr_count / max(1.0, (ts_last - ts_first)), 3) if ts_last and ts_first else 0.0
        except Exception as e:
            summary["hr_csv_error"] = str(e)

    # 3. Audit motion.csv (Only headers and line count check if present)
    motion_file = os.path.join(night_path, "motion.csv")
    if os.path.exists(motion_file):
        summary["motion_file_size_bytes"] = os.path.getsize(motion_file)
        try:
            with open(motion_file, "r", encoding="utf-8") as f:
                header = f.readline().strip()
                summary["motion_header"] = header
        except Exception as e:
            summary["motion_error"] = str(e)

    return summary


def inspect_dataset(data_dir: str = RAW_DATA_DIR) -> Dict[str, Any]:
    """
    Performs full memory-conscious dataset inspection.
    """
    report: Dict[str, Any] = {
        "dataset_name": DATASET_NAME,
        "dataset_doi": DATASET_DOI,
        "citation": DATASET_CITATION,
        "license": DATASET_LICENSE,
        "inspected_at": datetime.now(zoneinfo.ZoneInfo("UTC")).isoformat(),
        "local_data_path": os.path.abspath(data_dir),
        "data_directory_exists": os.path.exists(data_dir)
    }

    if not os.path.exists(data_dir):
        report["status"] = "DATASET_NOT_FOUND"
        report["error"] = (
            f"The directory '{data_dir}' does not exist on disk.\n"
            "Download instruction: Use scripts/prepare_bidsleep.py or fetch from "
            "https://physionet.org/content/bidsleep-dataset/1.0.1/"
        )
        return report

    # Check root metadata files
    root_files = os.listdir(data_dir)
    report["root_files_present"] = root_files
    report["has_readme"] = "README.md" in root_files
    report["has_license"] = "LICENSE.txt" in root_files
    report["has_sha256sums"] = "SHA256SUMS.txt" in root_files

    # Find subject directories
    subjects = sorted([
        d for d in root_files
        if os.path.isdir(os.path.join(data_dir, d)) and d.startswith("Bidslab")
    ])
    report["subjects_count"] = len(subjects)
    report["subject_ids"] = subjects

    if len(subjects) == 0:
        report["status"] = "NO_SUBJECT_DIRECTORIES"
        report["error"] = f"No 'BidslabXX' subject directories found in '{data_dir}'."
        return report

    # Iterate subjects and nights memory-consciously
    total_nights = 0
    total_epochs = 0
    total_hr_samples = 0
    overall_class_distribution: Dict[int, int] = {c: 0 for c in range(6)}
    nights_reports: List[Dict[str, Any]] = []

    for sub in subjects:
        sub_dir = os.path.join(data_dir, sub)
        nights = sorted([
            n for n in os.listdir(sub_dir)
            if os.path.isdir(os.path.join(sub_dir, n)) and n.isdigit()
        ], key=int)

        for n in nights:
            night_path = os.path.join(sub_dir, n)
            n_summary = inspect_night_folder(night_path, sub, n)
            nights_reports.append(n_summary)
            total_nights += 1

            if n_summary.get("has_expert_label"):
                total_epochs += n_summary["expert_label_count"]
                dist = n_summary.get("expert_label_distribution", {})
                for c_id, cnt in dist.items():
                    overall_class_distribution[c_id] = overall_class_distribution.get(c_id, 0) + cnt

            if "hr_samples_count" in n_summary:
                total_hr_samples += n_summary["hr_samples_count"]

    report["total_nights_inspected"] = total_nights
    report["total_expert_epochs"] = total_epochs
    report["total_sleep_hours_approx"] = round(total_epochs * 30.0 / 3600.0, 2)
    report["total_hr_samples"] = total_hr_samples
    
    # Class breakdown with names
    class_breakdown = {}
    for c_id, count in sorted(overall_class_distribution.items()):
        name = SLEEP_STAGE_MAP.get(c_id, f"Class_{c_id}")
        pct = round((count / max(1, total_epochs)) * 100, 2)
        class_breakdown[f"{name} ({c_id})"] = {
            "count": count,
            "percentage": pct
        }
    report["class_distribution"] = class_breakdown
    report["unknown_labels_count"] = overall_class_distribution.get(5, 0)
    report["night_summaries"] = nights_reports
    report["status"] = "SUCCESS"

    return report


def main():
    parser = argparse.ArgumentParser(description="Memory-conscious inspection of BiDSleep v1.0.1 dataset.")
    parser.add_argument("--data-dir", default=RAW_DATA_DIR, help=f"Path to bidsleep-dataset (default: {RAW_DATA_DIR})")
    parser.add_argument("--output", default=os.path.join(REPORTS_DIR, "bidsleep_inspection_report.json"), help="Output JSON report path")
    args = parser.parse_args()

    print("=" * 70)
    print("SwasthyaTwin AI — BiDSleep v1.0.1 Dataset Inspection & Audit")
    print("=" * 70)
    print(f"Dataset path: {args.data_dir}")

    report = inspect_dataset(args.data_dir)

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\nAudit Status: {report.get('status')}")
    if report.get("status") == "SUCCESS":
        print(f"Subjects Found:        {report['subjects_count']} ({', '.join(report['subject_ids'])})")
        print(f"Total Nights:          {report['total_nights_inspected']}")
        print(f"Total 30s Epochs:      {report['total_expert_epochs']:,} (~{report['total_sleep_hours_approx']} hours)")
        print(f"Total HR Telemetries:  {report['total_hr_samples']:,}")
        print("\nSleep-Stage Class Distribution (5-Stage Ground Truth):")
        for cls_name, info in report["class_distribution"].items():
            print(f"  {cls_name:<15}: {info['count']:>6} epochs ({info['percentage']:>5.2f}%)")
        print(f"\nReport written to: {args.output}")
    else:
        print(f"Error: {report.get('error')}")
        sys.exit(1)


if __name__ == "__main__":
    main()
