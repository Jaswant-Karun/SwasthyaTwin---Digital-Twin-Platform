#!/usr/bin/env python3
"""
Step 1 — Download and prepare BiDSleep v1.0.1 dataset from PhysioNet.
"""
import sys
import os

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_dir)

# Execute main script
root_script = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "scripts", "prepare_bidsleep.py"))
if os.path.exists(root_script):
    import runpy
    runpy.run_path(root_script, run_name="__main__")
else:
    print("Cannot find root prepare_bidsleep.py")
