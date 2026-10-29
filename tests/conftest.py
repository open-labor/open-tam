"""Shared test setup.

httpx reads the macOS system proxy configuration, which intercepts even
loopback requests and makes real-uvicorn tests fail with 502. Keep local
test traffic out of any system proxy.
"""
from __future__ import annotations

import os

os.environ.setdefault("NO_PROXY", "127.0.0.1,localhost")
os.environ.setdefault("no_proxy", "127.0.0.1,localhost")
