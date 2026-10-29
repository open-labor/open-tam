from __future__ import annotations

import math
import random
from datetime import datetime, timedelta

from open_tam.faults import FAULT_MODES, FaultState
from open_tam.models import MetricPoint


def generate_series(
    metric: str,
    service: str,
    start: datetime,
    end: datetime,
    step_seconds: int = 60,
    seed: int = 42,
    state: FaultState | None = None,
    region: str = "cn-hangzhou",
) -> list[MetricPoint]:
    mode = next((m for m in FAULT_MODES.values() if m.metric == metric and m.service == service), None)
    fault_window = state.window(mode.name) if (state and mode) else None
    fault_region = state.region_of(mode.name) if (state and mode and fault_window) else None

    rng = random.Random(seed)
    points: list[MetricPoint] = []
    ts = start
    while ts <= end:
        base = mode.baseline_mid if mode else 30.0
        if mode:
            base += mode.baseline_amplitude * math.sin(ts.timestamp() / 600)
        noise = mode.baseline_noise if mode else 3.0
        value = base + rng.uniform(-noise, noise)
        region_hit = fault_region is None or fault_region == region
        if fault_window and region_hit and fault_window[0] <= ts <= fault_window[1]:
            spike_noise = mode.spike_noise if mode else 2.0
            value = mode.spike_value + rng.uniform(-spike_noise, spike_noise)
        points.append(MetricPoint(ts=ts, value=round(max(0.0, value), 2)))
        ts += timedelta(seconds=step_seconds)
    return points
