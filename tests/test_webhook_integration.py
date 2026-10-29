"""End-to-end tests for the mounted alert webhook and config wiring."""
from __future__ import annotations

import hashlib
import hmac
import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

import open_tam.web.app as web_app
from open_tam.config import Settings
from open_tam.notifications import build_dispatcher
from open_tam.persistence.database import Database, reset_database
from open_tam.web.app import create_app

ALERT = {
    "alert_name": "CPU使用率过高",
    "service": "demo-app",
    "metric": "cpu_usage",
    "threshold": 80,
    "current_value": 92.5,
}


@pytest.fixture
def db(tmp_path):
    reset_database()
    database = Database(tmp_path / "test.db")
    database.connect()
    database.migrate()
    yield database
    database.close()
    reset_database()


def _client(tmp_path, monkeypatch, secret: str = "s3cret") -> tuple[TestClient, list]:
    monkeypatch.setenv("OPEN_TAM_BASE_DIR", str(tmp_path))
    monkeypatch.setenv("OPEN_TAM_WEBHOOK_SECRET", secret)
    monkeypatch.setenv("OPEN_TAM_DEDUP_WINDOW_SECONDS", "300")
    monkeypatch.setenv("DASHSCOPE_API_KEY", "test-key")
    calls: list = []

    def fake_start(hub, alert, **kwargs):
        calls.append({"alert": alert, **kwargs})
        return SimpleNamespace(id=f"inv-{len(calls)}", status="running")

    monkeypatch.setattr(web_app, "start_investigation", fake_start)
    return TestClient(create_app(auth_enabled=True)), calls


def _post(client: TestClient, payload: dict, secret: str = "s3cret"):
    body = json.dumps(payload).encode("utf-8")
    signature = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return client.post("/alerts", content=body,
                       headers={"X-Signature": signature,
                                "Content-Type": "application/json"})


def test_webhook_is_public_and_starts_investigation(db, tmp_path, monkeypatch):
    client, calls = _client(tmp_path, monkeypatch)
    r = _post(client, ALERT)
    assert r.status_code == 202
    assert r.json()["dedup"] is False
    assert len(calls) == 1
    assert calls[0]["alert"].service == "demo-app"
    assert calls[0]["fake"] is False


def test_webhook_dedup_suppresses_duplicates(db, tmp_path, monkeypatch):
    client, calls = _client(tmp_path, monkeypatch)
    assert _post(client, ALERT).status_code == 202
    r = _post(client, ALERT)
    assert r.status_code == 202
    assert r.json()["dedup"] is True
    assert len(calls) == 1


def test_webhook_rejects_bad_signature(db, tmp_path, monkeypatch):
    client, calls = _client(tmp_path, monkeypatch)
    body = json.dumps(ALERT).encode("utf-8")
    r = client.post("/alerts", content=body,
                    headers={"X-Signature": "bad",
                             "Content-Type": "application/json"})
    assert r.status_code == 401
    assert calls == []


def test_health_is_public(db, tmp_path, monkeypatch):
    client, _ = _client(tmp_path, monkeypatch)
    assert client.get("/health").status_code == 200
    assert client.get("/api/health").json()["status"] == "ok"


def test_aliyun_env_exported(monkeypatch):
    monkeypatch.setenv("OPEN_TAM_ALIYUN_ACCESS_KEY_ID", "ak")
    monkeypatch.setenv("OPEN_TAM_ALIYUN_ACCESS_KEY_SECRET", "sk")
    monkeypatch.setenv("OPEN_TAM_ALIYUN_REGION", "cn-shanghai")
    monkeypatch.setenv("OPEN_TAM_ALIYUN_SLS_PROJECT", "proj")
    monkeypatch.setenv("OPEN_TAM_ALIYUN_SLS_LOGSTORE", "store")
    env = Settings.load().aliyun_env()
    assert env == {
        "ALIYUN_ACCESS_KEY_ID": "ak",
        "ALIYUN_ACCESS_KEY_SECRET": "sk",
        "ALIYUN_REGION": "cn-shanghai",
        "ALIYUN_SLS_PROJECT": "proj",
        "ALIYUN_SLS_LOGSTORE": "store",
    }


def test_notification_dispatcher_from_settings(monkeypatch):
    monkeypatch.setenv("OPEN_TAM_NOTIFY_DINGTALK_WEBHOOK", "https://example.invalid/ding")
    monkeypatch.setenv("OPEN_TAM_NOTIFY_FEISHU_WEBHOOK", "https://example.invalid/fei")
    monkeypatch.setenv("OPEN_TAM_NOTIFY_SLACK_WEBHOOK", "https://example.invalid/slack")
    dispatcher = build_dispatcher(Settings.load())
    assert len(dispatcher.notifiers) == 3
