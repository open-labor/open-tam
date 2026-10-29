"""Workspace shell APIs: settings metadata and audit access."""
from __future__ import annotations

from datetime import datetime

import pytest
from httpx import ASGITransport, AsyncClient

from open_tam.auth.apikey import generate_api_key, hash_api_key
from open_tam.persistence.database import Database, reset_database
from open_tam.persistence.repositories import (
    AuditEntry,
    AuditRepository,
    InvestigationRecord,
    InvestigationRepository,
    UserRecord,
    UserRepository,
)
from open_tam.web.app import create_app


@pytest.fixture
def db(tmp_path):
    reset_database()
    database = Database(tmp_path / "test.db")
    database.connect()
    database.migrate()
    yield database
    database.close()
    reset_database()


def _user(db, username="tam", role="mentor"):
    key = generate_api_key()
    UserRepository(db).create(UserRecord(
        id=f"u-{username}", username=username, api_key_hash=hash_api_key(key),
        role=role, created_at=datetime.now().isoformat(),
        updated_at=datetime.now().isoformat(),
    ))
    return key


async def test_config_exposes_workspace_metadata(db):
    app = create_app(db=db, auth_enabled=False)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        body = (await c.get("/api/config")).json()
    assert body["roles"]["admin"]
    assert "view_team" in body["roles"]["mentor"]
    assert "manage_teams" not in body["roles"]["mentor"]
    assert body["notifications"] == {
        "dingtalk": False, "feishu": False, "slack": False,
    }
    assert body["webhook_secret_configured"] is False
    assert body["model_fallback"]


async def test_audit_demo_public_and_admin_only(db):
    AuditRepository(db).create(AuditEntry(
        id=0, action="restart_pod", actor="tam", params={"pod": "api-1"},
        result="ok", dry_run=False, created_at=datetime.now().isoformat(),
    ))
    demo = create_app(db=db, auth_enabled=False)
    async with AsyncClient(transport=ASGITransport(app=demo), base_url="http://t") as c:
        body = (await c.get("/api/audit")).json()
    assert body["entries"][0]["action"] == "restart_pod"

    admin_key = _user(db, "admin", "admin")
    viewer_key = _user(db, "viewer", "viewer")
    app = create_app(db=db, auth_enabled=True)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        assert (await c.get("/api/audit")).status_code == 401
        assert (await c.get(
            "/api/audit", headers={"X-API-Key": viewer_key},
        )).status_code == 403
        admin = await c.get("/api/audit", headers={"X-API-Key": admin_key})
        assert admin.status_code == 200
        assert admin.json()["entries"][0]["actor"] == "tam"


async def test_history_report_served_and_confined(tmp_path, monkeypatch, db):
    reports = tmp_path / "reports"
    reports.mkdir()
    report = reports / "2026-10-25-inv1.md"
    report.write_text("# RCA\n\nroot cause", encoding="utf-8")
    outside = tmp_path / "secret.md"
    outside.write_text("secret", encoding="utf-8")
    InvestigationRepository(db).create(InvestigationRecord(
        id="inv1", alert_id="alert-1", user_id=None, status="done",
        root_cause="root cause", confidence="high", report_path=str(report),
        trace_path=None, created_at=datetime.now().isoformat(),
        updated_at=datetime.now().isoformat(),
    ))
    monkeypatch.setenv("OPEN_TAM_BASE_DIR", str(tmp_path))
    monkeypatch.setenv("OPEN_TAM_STATE_DIR", str(tmp_path))
    monkeypatch.setenv("OPEN_TAM_REPORTS_DIR", str(reports))
    app = create_app(db=db, auth_enabled=False)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        response = await c.get("/api/history/inv1/report")
        assert response.status_code == 200
        assert "root cause" in response.text

        InvestigationRepository(db).update_status("inv1", status="done",
                                                   report_path=str(outside))
        assert (await c.get("/api/history/inv1/report")).status_code == 404
