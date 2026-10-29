"""Safe filesystem naming helpers.

Alert ids and skill ids can originate from external payloads. They must never
be used as raw path components.
"""
from __future__ import annotations

import hashlib
import re
from pathlib import Path

_SAFE_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
_UNSAFE = re.compile(r"[^A-Za-z0-9_-]+")


def safe_alert_id(value: str, fallback: str = "alert") -> str:
    """Return a path-safe alert id, preserving normal ids unchanged."""
    value = str(value or "").strip()
    if _SAFE_ID.fullmatch(value):
        return value
    cleaned = _UNSAFE.sub("_", value).strip("_-")[:48]
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()[:8]
    return f"{cleaned or fallback}-{digest}"


def valid_skill_id(value: str) -> bool:
    return bool(_SAFE_ID.fullmatch(str(value or "")))


def resolve_within(base: Path | str, filename: str) -> Path:
    """Resolve base/filename and reject traversal outside base."""
    base_path = Path(base).resolve()
    path = (base_path / filename).resolve()
    if path.parent != base_path:
        raise ValueError(f"path escapes base directory: {filename!r}")
    return path
