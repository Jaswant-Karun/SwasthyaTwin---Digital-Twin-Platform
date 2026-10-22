"""
SwasthyaTwin AI — Sleep-Stage Label & Timestamp Alignment
Mathematical mapping between continuous device timestamps and discrete 30-second polysomnography epochs.
"""

import math
import zoneinfo
from datetime import datetime
from typing import Tuple, Union, Optional
import numpy as np
import pandas as pd


def parse_rec_start_to_unix(rec_start_input: Union[str, np.ndarray, list]) -> float:
    """
    Parses the `recStart` metadata from labels.mat into UTC Unix timestamp in seconds.
    
    Format: 'YYYY-MM-DD HH:MM:SS'
    Timezone: U.S. Eastern Time (America/New_York) per official BiDSleep v1.0.1 specification.
    """
    if isinstance(rec_start_input, np.ndarray):
        if rec_start_input.size == 0:
            raise ValueError("recStart is empty numpy array")
        raw_str = str(rec_start_input.flat[0]).strip()
    elif isinstance(rec_start_input, (list, tuple)):
        raw_str = str(rec_start_input[0]).strip()
    else:
        raw_str = str(rec_start_input).strip()

    try:
        dt_et = datetime.strptime(raw_str, "%Y-%m-%d %H:%M:%S").replace(
            tzinfo=zoneinfo.ZoneInfo("America/New_York")
        )
        return dt_et.timestamp()
    except Exception as e:
        raise ValueError(f"Failed to parse recStart '{raw_str}': {e}")


def timestamp_to_epoch_index(
    timestamp: float,
    rec_start_unix: float,
    epoch_duration_seconds: float = 30.0
) -> int:
    """
    Converts a continuous UTC timestamp into a 1-indexed 30-second epoch number:
    k = floor((t - recStart) / epoch_duration) + 1
    """
    delta = timestamp - rec_start_unix
    return math.floor(delta / epoch_duration_seconds) + 1


def epoch_index_to_time_interval(
    epoch_idx: int,
    rec_start_unix: float,
    epoch_duration_seconds: float = 30.0
) -> Tuple[float, float]:
    """
    Returns the [start_ts, end_ts) interval for epoch k.
    """
    start_ts = rec_start_unix + (epoch_idx - 1) * epoch_duration_seconds
    end_ts = start_ts + epoch_duration_seconds
    return start_ts, end_ts


def align_sensor_telemetry(
    df: pd.DataFrame,
    rec_start_unix: float,
    total_epochs: int,
    timestamp_col: str = "timestamp",
    epoch_duration_seconds: float = 30.0
) -> pd.DataFrame:
    """
    Assigns each sensor reading to its corresponding 30s epoch index and trims readings
    falling outside the labeled polysomnography window [1, total_epochs].
    """
    if df.empty or timestamp_col not in df.columns:
        return pd.DataFrame()

    aligned = df.copy()
    # Handle possible duplicate timestamps by taking mean or dropping
    aligned = aligned.drop_duplicates(subset=[timestamp_col])
    
    # Calculate epoch index
    aligned["epoch_idx"] = np.floor(
        (aligned[timestamp_col] - rec_start_unix) / epoch_duration_seconds
    ).astype(int) + 1

    # Filter to valid polysomnography interval [1, total_epochs]
    valid_mask = (aligned["epoch_idx"] >= 1) & (aligned["epoch_idx"] <= total_epochs)
    return aligned[valid_mask].copy()
