"""Learning progress, case attempts and team progress APIs."""
from __future__ import annotations

from datetime import datetime

import pytest
from httpx import ASGITransport, AsyncClient

from open_tam.auth.apikey import generate_api_key, hash_api_key
from open_tam.persistence.database import Database, reset_database
from open_tam.persistence.repositories import (
    TeamRecord,
    TeamRepository,
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


def _team(db, name="TAM-A"):
    team = TeamRecord(id=f"team-{name}", name=name,
                      created_at=datetime.now().isoformat())
    TeamRepository(db).create(team)
    return team.id


def _user(db, username, role="operator", team_id=None):
    key = generate_api_key()
    UserRepository(db).create(UserRecord(
        id=f"u-{username}", username=username, api_key_hash=hash_api_key(key),
        role=role, created_at=datetime.now().isoformat(),
        updated_at=datetime.now().isoformat(), team_id=team_id,
    ))
    return key


@pytest.fixture
def app(db):
    return create_app(db=db, auth_enabled=True)


async def test_catalog_is_public(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        r = await c.get("/api/catalog")
    assert r.status_code == 200
    body = r.json()
    assert len(body["modules"]) == 6
    assert len(body["skills"]) == 8
    assert len(body["cases"]) == 12


async def test_progress_roundtrip_and_merge(db, app):
    key = _user(db, "alice")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        r = await c.put("/api/learning/progress", headers={"X-API-Key": key},
                        json={"object_type": "module", "object_id": "alert",
                              "status": "completed"})
        assert r.status_code == 200
        r = await c.get("/api/learning/progress", headers={"X-API-Key": key})
        assert r.status_code == 200
        assert any(item["object_id"] == "alert" for item in r.json()["progress"])

        r = await c.post("/api/learning/progress/merge", headers={"X-API-Key": key},
                         json={"items": [
                             {"object_type": "case", "object_id": "cpu_spike",
                              "status": "completed"},
                             {"object_type": "module", "object_id": "metrics",
                              "status": "in_progress"},
                         ]})
        assert r.status_code == 200
        progress = {(item["object_type"], item["object_id"]): item
                    for item in r.json()["progress"]}
        assert progress[("case", "cpu_spike")]["status"] == "completed"
        assert progress[("module", "metrics")]["status"] == "in_progress"

        r = await c.put("/api/learning/progress", headers={"X-API-Key": key},
                        json={"object_type": "module", "object_id": "nope",
                              "status": "completed"})
        assert r.status_code == 422


async def test_case_attempt_completes_progress(db, app):
    key = _user(db, "bob")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        r = await c.post("/api/cases/cpu_spike/attempts",
                         headers={"X-API-Key": key}, json={})
        assert r.status_code == 201
        attempt_id = r.json()["id"]

        r = await c.patch(f"/api/attempts/{attempt_id}",
                          headers={"X-API-Key": key},
                          json={"status": "completed",
                                "root_cause": "demo-app /search 接口正则回溯导致 CPU 飙升"})
        assert r.status_code == 200
        assert r.json()["score"] == 1.0

        r = await c.get("/api/learning/progress", headers={"X-API-Key": key})
        progress = {(item["object_type"], item["object_id"]): item
                    for item in r.json()["progress"]}
        assert progress[("case", "cpu_spike")]["status"] == "completed"


async def test_team_progress_and_review(db, app):
    team_id = _team(db)
    mentor_key = _user(db, "mentor", role="mentor", team_id=team_id)
    member_key = _user(db, "member", role="operator", team_id=team_id)
    viewer_key = _user(db, "viewer", role="viewer", team_id=team_id)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        r = await c.post("/api/cases/cpu_spike/attempts",
                         headers={"X-API-Key": member_key}, json={})
        attempt_id = r.json()["id"]
        await c.patch(f"/api/attempts/{attempt_id}",
                      headers={"X-API-Key": member_key},
                      json={"status": "completed",
                            "root_cause": "正则回溯导致 CPU 飙升"})

        r = await c.get("/api/team/progress", headers={"X-API-Key": mentor_key})
        assert r.status_code == 200
        body = r.json()
        assert body["team_id"] == team_id
        assert len(body["members"]) == 3
        assert len(body["skills"]) == 8
        assert body["pending_reviews"]

        r = await c.get("/api/team/progress", headers={"X-API-Key": viewer_key})
        assert r.status_code == 403

        r = await c.post(f"/api/attempts/{attempt_id}/review",
                         headers={"X-API-Key": mentor_key},
                         json={"score": 0.9, "review_note": "证据链完整"})
        assert r.status_code == 200
        assert r.json()["status"] == "reviewed"
        assert r.json()["reviewer_id"] == "u-mentor"

        r = await c.get("/api/me", headers={"X-API-Key": mentor_key})
        assert r.json()["team_id"] == team_id
        assert r.json()["team_name"] == "TAM-A"
