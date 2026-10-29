"""CLI entrypoints for storm correlation and playbook execution."""
from __future__ import annotations

import json

from typer.testing import CliRunner

from open_tam.cli import app


def _alert(name: str, severity: str, service: str = "demo-app") -> dict:
    return {"alert_name": name, "service": service, "metric": "cpu_usage",
            "threshold": 80, "current_value": 92.5, "severity": severity}


def test_storm_analyze_groups_and_orders(tmp_path, monkeypatch):
    monkeypatch.setenv("OPEN_TAM_STATE_DIR", str(tmp_path / "var"))
    path = tmp_path / "alerts.json"
    path.write_text(json.dumps([
        _alert("CPU 告警", "critical"),
        _alert("延迟告警", "warning"),
    ]), encoding="utf-8")

    result = CliRunner().invoke(app, ["storm", "analyze",
                                      "--alerts-file", str(path)])
    assert result.exit_code == 0, result.output
    assert "聚合为 1 组" in result.output
    assert "P0" in result.output and "P2" in result.output


def test_playbook_run_executes_guarded_step(tmp_path, monkeypatch):
    from open_tam.faults import FaultState

    monkeypatch.setenv("OPEN_TAM_STATE_DIR", str(tmp_path / "var"))
    FaultState().activate("cpu_spike", duration_minutes=30)
    playbook = tmp_path / "fix.yaml"
    playbook.write_text(
        "id: fix-cpu\n"
        "name: fix cpu\n"
        "trigger:\n"
        "  alert_pattern: 'cpu_*'\n"
        "  confidence_threshold: 0.5\n"
        "steps:\n"
        "  - order: 1\n"
        "    action: clear_fault\n"
        "    params: {name: cpu_spike}\n"
        "    sensitivity: safe\n",
        encoding="utf-8",
    )

    result = CliRunner().invoke(app, ["playbook", "run", str(playbook), "--yes"])
    assert result.exit_code == 0, result.output
    assert "[done]" in result.output
    assert not FaultState().is_active("cpu_spike")
