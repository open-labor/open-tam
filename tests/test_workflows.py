"""Book-derived workflows: catalog, run persistence and APIs."""
from __future__ import annotations

from datetime import datetime

import pytest
from httpx import ASGITransport, AsyncClient

from open_tam.auth.apikey import generate_api_key, hash_api_key
from open_tam.book import load_book
from open_tam.config import Settings
from open_tam.persistence.database import Database, reset_database
from open_tam.persistence.repositories import UserRecord, UserRepository
from open_tam.web.app import create_app
from open_tam.workflows import load_workflows


@pytest.fixture
def book():
    return load_book(Settings.load().book_dir)


@pytest.fixture
def workflows(book):
    return load_workflows(book)


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


def test_workflow_catalog_covers_book(workflows, book):
    payload = workflows.index_payload()
    assert payload["counts"] == {
        "total": 69, "practice": 28, "standard": 22, "tool": 19,
    }
    assert len(payload["stages"]) == 8
    chapter = workflows.get("practice-ch01-tam-origin-evolution")
    assert chapter is not None and len(chapter.steps) >= 5
    tool = workflows.get("tool-01-service-plan")
    assert tool is not None and len(tool.steps) >= 5
    detail = workflows.detail_payload(chapter, book)
    assert detail["chapters"][0]["slug"] == "ch01-tam-origin-evolution"
    assert any(item["kind"] == "practice" for item in workflows.for_document("ch01-tam-origin-evolution"))
    assert [item["kind"] for item in workflows.for_document("01-service-plan")] == ["tool"]


async def test_workflow_catalog_is_demo_public(db):
    app = create_app(db=db, auth_enabled=False)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        index = await c.get("/api/workflows")
        assert index.status_code == 200
        assert index.json()["counts"]["total"] == 69
        detail = await c.get("/api/workflows/practice-ch04-ai-era-tam-redefined")
        assert detail.status_code == 200
        assert detail.json()["steps"]
        chapter = await c.get("/api/book/ch04-ai-era-tam-redefined")
        assert chapter.status_code == 200
        assert chapter.json()["workflows"]


async def test_workflow_requires_login_when_auth_enabled(db):
    key = _user(db)
    app = create_app(db=db, auth_enabled=True)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        assert (await c.get("/api/workflows")).status_code == 401
        headers = {"X-API-Key": key}
        assert (await c.get("/api/workflows", headers=headers)).status_code == 200
        assert (await c.post("/api/workflows/practice-ch01-tam-origin-evolution/runs")).status_code == 401


async def test_workflow_run_lifecycle(db):
    key = _user(db, "runner")
    headers = {"X-API-Key": key}
    app = create_app(db=db, auth_enabled=True)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        created = await c.post(
            "/api/workflows/practice-ch01-tam-origin-evolution/runs",
            headers=headers,
        )
        assert created.status_code == 201
        run = created.json()
        run_id = run["id"]
        assert run["progress"] == 0.0 and run["steps"]

        steps = [dict(step) for step in run["steps"]]
        steps[0]["done"] = True
        patched = await c.patch(
            f"/api/workflow-runs/{run_id}", headers=headers,
            json={"steps": steps, "notes": "完成第一节", "status": "in_progress"},
        )
        assert patched.status_code == 200
        assert patched.json()["progress"] > 0
        assert patched.json()["notes"] == "完成第一节"

        detail = await c.get(f"/api/workflow-runs/{run_id}", headers=headers)
        assert detail.status_code == 200
        assert detail.json()["workflow"]["id"] == "practice-ch01-tam-origin-evolution"

        listed = await c.get("/api/workflow-runs", headers=headers)
        assert listed.status_code == 200
        assert listed.json()["runs"][0]["id"] == run_id

        completed = await c.patch(
            f"/api/workflow-runs/{run_id}", headers=headers,
            json={"status": "completed"},
        )
        assert completed.status_code == 200
        assert completed.json()["status"] == "completed"

        deleted = await c.delete(f"/api/workflow-runs/{run_id}", headers=headers)
        assert deleted.status_code == 200
        assert (await c.get(f"/api/workflow-runs/{run_id}", headers=headers)).status_code == 404
