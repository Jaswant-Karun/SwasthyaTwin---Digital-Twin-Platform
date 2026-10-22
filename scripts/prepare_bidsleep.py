#!/usr/bin/env python3
"""
Step 1 — Download and prepare BiDSleep v1.0.1 dataset from PhysioNet.
Official source: https://www.physionet.org/content/bidsleep-dataset/1.0.1/

Usage:
  python scripts/prepare_bidsleep.py [--max-subjects 3] [--include-motion] [--output-dir data]
"""

import sys
import os
import argparse

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
if not os.path.exists(backend_dir):
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "backend"))
sys.path.insert(0, backend_dir)

from app.ml.bidsleep_dataset import BiDSleepPipeline

def main():
    parser = argparse.ArgumentParser(description="Download and prepare BiDSleep v1.0.1 dataset from PhysioNet.")
    parser.add_argument("--max-subjects", type=int, default=3, help="Number of subjects to download and process (default: 3).")
    parser.add_argument("--participants", nargs="+", default=None, help="Explicit participant IDs to process (e.g. Bidslab00 Bidslab01).")
    parser.add_argument("--include-motion", action="store_true", default=False, help="Include high-frequency 50Hz accelerometry (~100MB/night).")
    parser.add_argument("--base-data-dir", type=str, default=None, help="Base data directory (default: <root>/data).")

    args = parser.parse_args()

    # Determine data directory paths outside frontend
    if args.base_data_dir:
        base_dir = os.path.abspath(args.base_data_dir)
    else:
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
        if not os.path.exists(os.path.dirname(base_dir)):
            base_dir = os.path.abspath("data")

    raw_dir = os.path.join(base_dir, "raw", "bidsleep-dataset")
    processed_dir = os.path.join(base_dir, "processed")
    models_dir = os.path.join(base_dir, "models")
    reports_dir = os.path.join(base_dir, "reports")

    os.makedirs(raw_dir, exist_ok=True)
    os.makedirs(processed_dir, exist_ok=True)
    os.makedirs(models_dir, exist_ok=True)
    os.makedirs(reports_dir, exist_ok=True)

    print("=" * 70)
    print("SwasthyaTwin AI — BiDSleep v1.0.1 Dataset Preparation Pipeline")
    print("=" * 70)
    print(f"Raw data target:       {raw_dir}")
    print(f"Processed target:      {processed_dir}")
    print(f"Models target:         {models_dir}")
    print(f"Reports target:        {reports_dir}")
    print(f"Include motion (50Hz): {args.include_motion}")

    pipeline = BiDSleepPipeline(
        raw_dir=raw_dir,
        processed_dir=processed_dir,
        reports_dir=reports_dir
    )

    print("\n1. Fetching dataset metadata and SHA256 checksums from PhysioNet...")
    checksums = pipeline.download_metadata()
    print(f"   Indexed {len(checksums)} verified files across the dataset.")

    available_subjects = pipeline.discover_participants()
    print(f"   Discovered {len(available_subjects)} total subjects in BiDSleep v1.0.1.")

    if args.participants:
        selected = [s for s in args.participants if s in available_subjects]
    else:
        selected = available_subjects[:args.max_subjects]

    print(f"\n2. Selected participant cohort ({len(selected)} subjects): {', '.join(selected)}")
    print("   Starting chunked download and 30-second epoch temporal alignment...")

    df_features, report = pipeline.process_participants(selected, include_motion=args.include_motion)

    if not df_features.empty:
        print("\n" + "=" * 70)
        print("Dataset Preparation Summary:")
        print(f" - Participants: {report['participants_processed_count']}")
        print(f" - Total Nights: {report['total_nights_count']}")
        print(f" - Total Labeled Epochs (30s): {report['total_epochs_count']:,} ({report['total_sleep_hours']} hours)")
        print(f" - Wake Epochs: {report['class_distribution_3class']['Wake (0)']:,} ({report['class_percentages_3class']['Wake_pct']}%)")
        print(f" - NREM Epochs: {report['class_distribution_3class']['NREM (1)']:,} ({report['class_percentages_3class']['NREM_pct']}%)")
        print(f" - REM Epochs:  {report['class_distribution_3class']['REM (2)']:,} ({report['class_percentages_3class']['REM_pct']}%)")
        print("=" * 70)
        print("Ready for Step 2 — Model Training and Cross-Validation.")
    else:
        print("Error: No valid epochs were processed.")
        sys.exit(1)

if __name__ == "__main__":
    main()
