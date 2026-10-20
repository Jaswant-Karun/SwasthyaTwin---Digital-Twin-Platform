#!/usr/bin/env python3
"""
SwasthyaTwin Synthetic Demonstration Dataset CLI Utility
========================================================

One-command seed, reset, and live observation injection for hackathon demonstrations.

Usage:
    python backend/scripts/seed_demo.py                # Populate demo cohort if not present
    python backend/scripts/seed_demo.py --force        # Force re-seeding all 5 synthetic profiles
    python backend/scripts/seed_demo.py --reset        # Safely remove demo data only (preserves user records)
    python backend/scripts/seed_demo.py --live-inject  # Ingest acute live observation & recompute twin state
"""

import sys
import os
import argparse
import json

# Ensure backend root is on sys.path
backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

from app.database.connection import db_manager, get_db
from app.database.seed import seed_synthetic_patients, reset_demo_data, inject_live_observation

def main():
    parser = argparse.ArgumentParser(
        description="SwasthyaTwin Synthetic Cohort Manager (5 Profiles, 90-Day Telemetry)"
    )
    parser.add_argument(
        "--force", action="store_true", help="Force re-seed even if demo cohort is already present."
    )
    parser.add_argument(
        "--reset", action="store_true", help="Safely delete only demo records (preserves all real user data)."
    )
    parser.add_argument(
        "--live-inject", action="store_true", help="Inject a synthetic live observation and recalculate twin state."
    )
    parser.add_argument(
        "--patient", default="PT-1001", help="Target patient ID for live injection (default: PT-1001)."
    )
    parser.add_argument(
        "--metric", default="heart_rate", help="Metric type for live injection (default: heart_rate)."
    )
    parser.add_argument(
        "--value", type=float, default=None, help="Numeric value for live injection (default: acute preset)."
    )

    args = parser.parse_args()

    print("=" * 60)
    print(" SwasthyaTwin — Digital Twin Synthetic Data Manager")
    print("=" * 60)

    db_manager.connect()
    if not db_manager.is_connected:
        print("[ERROR] Could not establish connection to MongoDB. Check MONGODB_URI.")
        sys.exit(1)

    db = get_db()

    try:
        if args.reset:
            print("[INFO] Executing safe reset of synthetic demo cohort...")
            res = reset_demo_data(db, confirm=True)
            print(f"[SUCCESS] {res['message']}")
            print(json.dumps(res.get("deleted_counts", {}), indent=2))

        elif args.live_inject:
            print(f"[INFO] Injecting live synthetic observation for patient {args.patient}...")
            res = inject_live_observation(
                db=db,
                patient_id=args.patient,
                metric_type=args.metric,
                value=args.value
            )
            print(f"[SUCCESS] {res['message']}")
            print(f"  Observation ID: {res['observation']['observation_id']}")
            print(f"  Metric: {res['observation']['metric_type']} = {res['observation']['value']} {res['observation']['unit']}")
            print(f"  Recalculated Vitality Index: {res['recalculated_vitality_index']}")

        else:
            print(f"[INFO] Seeding synthetic cohort (force={args.force})...")
            res = seed_synthetic_patients(db, force=args.force)
            print(f"[SUCCESS] Status: {res['status']}")
            print(f"  {res.get('message', '')}")
            if "patients_created" in res:
                print(f"  Profiles Created: {res['patients_created']}")
                print(f"  Observations Created: {res['observations_created']}")

    finally:
        db_manager.close()
        print("=" * 60)

if __name__ == "__main__":
    main()
