"""Security regression tests for path handling, RBAC and confirm parsing."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from pydantic import ValidationError

from open_tam.auth.apikey import generate_api_key, hash_api_key
from open_tam.models import AlertEvent
from open_tam.orchestrator.loop import DiagnosisResult
from open_tam.persistence.database import Database, reset_database
from open_tam.persistence.repositories import UserRecord, UserRepository
from open_tam.receiver.webhook import create_webhook_app
from open_tam.reporting.report import save_report
from open_tam.skills.loader import SkillLoader
from open_tam.skills.models import Skill
from open_tam.tracing.trace import TraceRecorder
from open_tam.web.app import ConfirmPayload, create_app


def test_trace_and_report_stay_inside_base_dir(tmp_path):
    alert = AlertEvent.model_validate({
        "alert_id": "../../escape", "alert_name": "x", "service": "demo-app",
        "metric": "cpu_usage", "threshold": 80, "current_value": 92.5,
    })
    trace = TraceRecorder(alert_id=alert.alert_id, traces_dir=tmp_path / "traces")
    trace.record("alert_received", user="x")
    assert trace.path.parent == (tmp_path / "traces").resolve()
    assert not (tmp_path / "escape.jsonl").exists()

    result = DiagnosisResult(alert_id=alert.alert_id, root_cause="rc",
                             evidence=[], actions=[], confidence="high",
                             excluded=[], steps=[])
    report = save_report(alert, result, reports_dir=tmp_path / "reports")
    assert report.parent == (tmp_path / "reports").resolve()
    assert not (tmp_path / "escape.md").exists()


def test_skill_delete_rejects_traversal(tmp_path):
    skills = tmp_path / "skills"
    skills.mkdir()
    victim = tmp_path / "victim.yaml"
    victim.write_text("id: victim\n", encoding="utf-8")

    loader = SkillLoader(skills)
    assert loader.delete("../victim") is False
    assert victim.exists()
    assert loader.delete("..%2Fvictim") is False
    assert victim.exists()


def test_skill_save_rejects_invalid_id(tmp_path):
    loader = SkillLoader(tmp_path / "skills")
    with pytest.raises(ValueError):
        loader.save(Skill(id="../evil", name="x", alert_pattern="*"))


def test_webhook_inbox_rejects_traversal(tmp_path):
    app = create_webhook_app(
        inbox_dir=tmp_path / "inbox",
        state_dir=tmp_path / "state",
        dedup_window_seconds=0,
    )
    client = TestClient(app)
    r = client.post("/alerts", json={
        "alertId": "../../escape", "alertName": "x", "metricName": "cpu_usage",
        "dimensions": {"instanceId": "demo-app"}, "level": "1",
    })
    assert r.status_code == 201
    assert (tmp_path / "inbox").exists()
    assert not (tmp_path / "escape.json").exists()
    assert len(list((tmp_path / "inbox").glob("*.json"))) == 1


def test_confirm_payload_rejects_string_bool():
    with pytest.raises(ValidationError):
        ConfirmPayload.model_validate({"request_id": "r1", "approved": "false"})
    assert ConfirmPayload.model_validate({"request_id": "r1", "approved": False}).approved is False


@pytest.fixture
def db(tmp_path):
    reset_database()
    database = Database(tmp_path / "test.db")
    database.connect()
    database.migrate()
    yield database
    database.close()
    reset_database()


def _user(db, user_id, role):
    key = generate_api_key()
    UserRepository(db).create(UserRecord(
        id=user_id, username=user_id, api_key_hash=hash_api_key(key),
        role=role, created_at="2026-10-23T00:00:00",
        updated_at="2026-10-23T00:00:00",
    ))
    return key


ALERT = {"alert_name": "CPU使用率过高", "service": "demo-app",
         "metric": "cpu_usage", "threshold": 80, "current_value": 92.5}


async def test_viewer_cannot_inject_faults(db):
    viewer_key = _user(db, "u-viewer", "viewer")
    app = create_app(db=db, auth_enabled=True)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        r = await c.post("/api/faults/cpu_spike/activate",
                         headers={"X-API-Key": viewer_key})
    assert r.status_code == 403


async def test_other_operator_cannot_access_investigation(db, monkeypatch):
    import open_tam.web.service as service_mod
    from open_tam.faults import FaultState

    FaultState().activate("cpu_spike", duration_minutes=30)

    def fake_run(alert, settings, **kwargs):
        from types import SimpleNamespace
        return (SimpleNamespace(root_cause="rc", confidence="high",
                                evidence=[], actions=[]), "/tmp/report.md")

    monkeypatch.setattr(service_mod, "run_investigation", fake_run)
    op_key = _user(db, "u-op", "operator")
    other_key = _user(db, "u-other", "operator")
    viewer_key = _user(db, "u-viewer2", "viewer")
    app = create_app(db=db, auth_enabled=True)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        r = await c.post("/api/investigations", json={"alert": ALERT, "fake": True},
                         headers={"X-API-Key": op_key})
        assert r.status_code == 202
        inv_id = r.json()["id"]

        r = await c.get(f"/api/investigations/{inv_id}/events",
                        headers={"X-API-Key": other_key})
        assert r.status_code == 403
        r = await c.post(f"/api/investigations/{inv_id}/confirm",
                         json={"request_id": "x", "approved": True},
                         headers={"X-API-Key": other_key})
        assert r.status_code == 403
        r = await c.post(f"/api/investigations/{inv_id}/confirm",
                         json={"request_id": "x", "approved": True},
                         headers={"X-API-Key": viewer_key})
        assert r.status_code == 403
