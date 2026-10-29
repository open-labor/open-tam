from __future__ import annotations

import asyncio
import json
import logging
import os
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, PlainTextResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, StrictBool, ValidationError

from open_tam.auth.roles import PERMISSIONS, Role, has_permission
from open_tam.book import BookError, load_book
from open_tam.catalog import CatalogError, load_catalog
from open_tam.config import Settings
from open_tam.faults import FAULT_MODES, FaultState
from open_tam.persistence.repositories import (
    AuditRepository,
    CaseAttemptRecord,
    CaseAttemptRepository,
    LearningProgressRepository,
    TeamRecord,
    TeamRepository,
    UserRepository,
    WorkflowRunRecord,
    WorkflowRunRepository,
)
from open_tam.receiver.adapters import adapt_alert
from open_tam.receiver.alert_receiver import normalize_alert
from open_tam.receiver.dedup import AlertDedup
from open_tam.receiver.webhook import verify_signature
from open_tam.web.events import InvestigationHub
from open_tam.web.service import start_investigation
from open_tam.workflows import load_workflows

STATIC_DIR = Path(__file__).parent / "static"
logger = logging.getLogger(__name__)


class ConfirmPayload(BaseModel):
    request_id: str
    approved: StrictBool = False


class ProgressUpdate(BaseModel):
    object_type: Literal["module", "skill", "case"]
    object_id: str
    status: Literal["completed", "in_progress"] = "completed"
    score: float | None = None


class ProgressMergePayload(BaseModel):
    items: list[ProgressUpdate] = []


class AttemptCreatePayload(BaseModel):
    investigation_id: str | None = None


class AttemptUpdatePayload(BaseModel):
    investigation_id: str | None = None
    status: Literal["started", "completed", "reviewed"] | None = None
    score: float | None = None
    root_cause: str | None = None
    evidence_sufficiency: float | None = None
    review_note: str | None = None


class ReviewPayload(BaseModel):
    score: float
    review_note: str = ""


class TeamCreatePayload(BaseModel):
    name: str


class WorkflowRunPatch(BaseModel):
    steps: list[dict] | None = None
    notes: str | None = None
    status: Literal["in_progress", "completed"] | None = None


def _current_user(request: Request):
    return getattr(request.state, "user", None)


def _is_admin(user) -> bool:
    return user is not None and str(user.role) == "admin"


def _ensure_investigation_access(inv, user) -> None:
    if user is None or _is_admin(user):
        return
    if inv.user_id is not None and inv.user_id != user.id:
        raise HTTPException(status_code=403, detail="no access to this investigation")


def _ensure_record_access(record, user) -> None:
    if user is None or _is_admin(user):
        return
    if record.user_id is not None and record.user_id != user.id:
        raise HTTPException(status_code=403, detail="no access to this investigation")


def _require_user(request: Request):
    user = _current_user(request)
    if user is None:
        raise HTTPException(status_code=401, detail="authentication required")
    return user


def _catalog_object_exists(catalog, object_type: str, object_id: str) -> bool:
    if object_type == "module":
        return catalog.module(object_id) is not None
    if object_type == "skill":
        return catalog.skill(object_id) is not None
    return catalog.case(object_id) is not None


def _progress_payload(record) -> dict:
    return {
        "object_type": record.object_type,
        "object_id": record.object_id,
        "status": record.status,
        "score": record.score,
        "updated_at": record.updated_at,
    }


def _attempt_payload(record: CaseAttemptRecord) -> dict:
    return {
        "id": record.id,
        "user_id": record.user_id,
        "case_id": record.case_id,
        "investigation_id": record.investigation_id,
        "status": record.status,
        "score": record.score,
        "root_cause": record.root_cause,
        "evidence_sufficiency": record.evidence_sufficiency,
        "reviewer_id": record.reviewer_id,
        "review_note": record.review_note,
        "created_at": record.created_at,
        "updated_at": record.updated_at,
    }


def _score_case(case, root_cause: str | None) -> float:
    if not root_cause or not case.keywords:
        return 0.0
    text = root_cause.lower()
    return 1.0 if any(keyword.lower() in text for keyword in case.keywords) else 0.0


def _workflow_run_payload(run: WorkflowRunRecord, workflows) -> dict:
    workflow = workflows.get(run.workflow_id)
    steps = run.steps or []
    done = sum(1 for step in steps if step.get("done"))
    return {
        "id": run.id,
        "user_id": run.user_id,
        "workflow_id": run.workflow_id,
        "workflow_title": workflow.title if workflow else run.workflow_id,
        "stage": workflow.stage if workflow else "",
        "kind": workflow.kind if workflow else "",
        "status": run.status,
        "steps": steps,
        "notes": run.notes,
        "step_count": len(steps),
        "progress": (done / len(steps)) if steps else 0.0,
        "created_at": run.created_at,
        "updated_at": run.updated_at,
    }


def _normalize_run_steps(workflow, incoming: list[dict] | None,
                         current: list[dict]) -> list[dict]:
    current_done = {
        str(step.get("id")): bool(step.get("done"))
        for step in current if isinstance(step, dict)
    }
    incoming_done = {
        str(step.get("id")): bool(step.get("done"))
        for step in (incoming or []) if isinstance(step, dict)
    }
    if workflow is None:
        return incoming or current
    return [
        {
            "id": step.id,
            "title": step.title,
            "done": incoming_done.get(step.id, current_done.get(step.id, False)),
        }
        for step in workflow.steps
    ]


def create_app(*, db=None, auth_enabled: bool | None = None) -> FastAPI:
    app = FastAPI(title="open-tam web")
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
    settings = Settings.load()
    if auth_enabled is None:
        auth_enabled = settings.auth_enabled
    try:
        catalog = load_catalog(settings.content_dir)
        catalog_payload = catalog.api_payload()
        book = load_book(settings.book_dir)
        workflows = load_workflows(book)
    except (CatalogError, BookError) as exc:
        raise RuntimeError(f"failed to load TAM content: {exc}") from exc
    hub = InvestigationHub()
    dedup = AlertDedup(
        window_seconds=settings.dedup_window_seconds,
        persist_path=settings.state_dir / "dedup.json",
    )

    if db is None:
        from open_tam.persistence.database import get_database

        db = get_database(settings.database_url.replace("sqlite:///", ""))
    if auth_enabled:
        from open_tam.auth.middleware import AuthMiddleware

        app.add_middleware(AuthMiddleware, db=db, enabled=True)

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; img-src 'self' data:; "
            "connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; "
            "form-action 'self'",
        )
        if request.url.path.startswith("/api/") or request.url.path == "/alerts":
            response.headers.setdefault("Cache-Control", "no-store")
        return response

    @app.post("/api/investigations", status_code=202)
    async def post_investigation(request: Request, payload: dict) -> dict:
        if not isinstance(payload, dict) or "alert" not in payload:
            raise HTTPException(status_code=422, detail="payload must contain 'alert'")
        user = _current_user(request)
        if user is not None and not has_permission(user.role, "investigate"):
            raise HTTPException(status_code=403,
                                detail="role does not allow investigate")
        fake = payload.get("fake", False)
        if not isinstance(fake, bool):
            raise HTTPException(status_code=422, detail="'fake' must be a boolean")
        transport = str(payload.get("transport", "inline"))
        if transport not in ("inline", "mcp"):
            raise HTTPException(status_code=422,
                                detail="'transport' must be inline or mcp")
        try:
            alert = normalize_alert(payload["alert"])
        except Exception as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        loop = asyncio.get_running_loop()
        inv = start_investigation(
            hub, alert,
            fake=fake,
            transport=transport,
            loop=loop, db=db,
            user_id=user.id if user is not None else None,
        )
        return {"id": inv.id, "status": inv.status}

    @app.get("/api/investigations/{investigation_id}/events")
    async def investigation_events(request: Request,
                                   investigation_id: str) -> StreamingResponse:
        inv = hub.get(investigation_id)
        if inv is None:
            raise HTTPException(status_code=404, detail="unknown investigation")
        _ensure_investigation_access(inv, _current_user(request))
        queue: asyncio.Queue = asyncio.Queue()
        loop = asyncio.get_running_loop()
        sub = hub.subscribe(investigation_id, queue=queue, loop=loop)

        async def stream():
            try:
                for event in sub.snapshot:
                    yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
                    if event["kind"] in ("done", "error"):
                        return
                while True:
                    try:
                        event = await asyncio.wait_for(queue.get(), timeout=15)
                    except TimeoutError:
                        yield ": keep-alive\n\n"
                        continue
                    yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
                    if event["kind"] in ("done", "error"):
                        return
            finally:
                hub.unsubscribe(investigation_id, queue)

        return StreamingResponse(stream(), media_type="text/event-stream")

    @app.post("/api/investigations/{investigation_id}/confirm")
    async def confirm_action(request: Request, investigation_id: str,
                             payload: dict) -> dict:
        inv = hub.get(investigation_id)
        if inv is None or inv.confirmer is None:
            raise HTTPException(status_code=404, detail="unknown investigation")
        user = _current_user(request)
        _ensure_investigation_access(inv, user)
        if user is not None and not has_permission(user.role, "investigate"):
            raise HTTPException(status_code=403,
                                detail="role does not allow confirmations")
        try:
            body = ConfirmPayload.model_validate(payload)
        except ValidationError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        pending = getattr(inv.confirmer, "pending", None)
        if not inv.confirmer.resolve(body.request_id, bool(body.approved)):
            raise HTTPException(status_code=409,
                                detail="no pending confirmation for this request_id")
        try:
            import threading

            from open_tam.notifications import notify_action_confirmation

            threading.Thread(
                target=notify_action_confirmation, daemon=True,
                kwargs={
                    "settings": settings,
                    "investigation_id": investigation_id,
                    "action": (pending or {}).get("action", "unknown"),
                    "approved": bool(body.approved),
                },
            ).start()
        except Exception:
            logger.exception("failed to dispatch confirmation notification: %s",
                             investigation_id)
        return {"resolved": True, "approved": bool(body.approved)}

    @app.get("/api/me")
    async def me(request: Request) -> dict:
        user = getattr(request.state, "user", None)
        if user is None:
            return {"authenticated": False}
        team = TeamRepository(db).get_by_id(user.team_id) if user.team_id else None
        return {
            "authenticated": True,
            "username": user.username,
            "role": user.role,
            "team_id": user.team_id,
            "team_name": team.name if team else None,
        }

    @app.get("/api/history")
    async def history_list(request: Request, limit: int = 20) -> dict:
        from open_tam.persistence.repositories import InvestigationRepository

        limit = max(1, min(limit, 200))
        user = _current_user(request)
        repo = InvestigationRepository(db)
        if user is not None and not _is_admin(user):
            records = repo.list_by_user(user.id, limit=limit)
        else:
            records = repo.list_all(limit=limit)
        return {"investigations": [
            {"id": r.id, "alert_id": r.alert_id, "user_id": r.user_id,
             "status": r.status, "root_cause": r.root_cause,
             "confidence": r.confidence, "created_at": r.created_at}
            for r in records
        ]}

    @app.get("/api/history/{investigation_id}")
    async def history_detail(request: Request, investigation_id: str) -> dict:
        from open_tam.persistence.repositories import InvestigationRepository

        r = InvestigationRepository(db).get_by_id(investigation_id)
        if r is None:
            raise HTTPException(status_code=404, detail="unknown investigation")
        _ensure_record_access(r, _current_user(request))
        return {"id": r.id, "alert_id": r.alert_id, "user_id": r.user_id,
                "status": r.status, "root_cause": r.root_cause,
                "confidence": r.confidence, "report_path": r.report_path,
                "trace_path": r.trace_path, "created_at": r.created_at,
                "updated_at": r.updated_at}

    @app.get("/api/history/{investigation_id}/report")
    async def history_report(request: Request,
                             investigation_id: str) -> PlainTextResponse:
        from open_tam.persistence.repositories import InvestigationRepository

        record = InvestigationRepository(db).get_by_id(investigation_id)
        if record is None:
            raise HTTPException(status_code=404, detail="unknown investigation")
        _ensure_record_access(record, _current_user(request))
        if not record.report_path:
            raise HTTPException(status_code=404, detail="report not available")
        path = Path(record.report_path)
        if not path.is_absolute():
            path = Path.cwd() / path
        resolved = path.resolve()
        base = settings.reports_dir.resolve()
        if base not in resolved.parents or not resolved.is_file():
            raise HTTPException(status_code=404, detail="report not found")
        return PlainTextResponse(resolved.read_text(encoding="utf-8"),
                                 media_type="text/markdown; charset=utf-8")

    @app.get("/api/audit")
    async def audit_list(request: Request, limit: int = 50) -> dict:
        user = _current_user(request)
        if auth_enabled and not _is_admin(user):
            if user is None:
                raise HTTPException(status_code=401, detail="authentication required")
            raise HTTPException(status_code=403, detail="admin role required")
        limit = max(1, min(limit, 500))
        repo = AuditRepository(db)
        entries = repo.list_all(limit=limit) if user is None or _is_admin(user) \
            else repo.list_by_actor(user.username, limit=limit)
        return {"entries": [
            {"id": entry.id, "action": entry.action, "actor": entry.actor,
             "params": entry.params, "result": entry.result,
             "dry_run": entry.dry_run, "created_at": entry.created_at}
            for entry in entries
        ]}

    @app.get("/api/skills")
    async def skills_list() -> dict:
        from open_tam.skills.loader import SkillLoader

        skills = SkillLoader(settings.skills_dir).load_all()
        return {"skills": [
            {"id": s.id, "name": s.name, "alert_pattern": s.alert_pattern,
             "service_pattern": s.service_pattern, "description": s.description,
             "confidence": s.confidence}
            for s in sorted(skills, key=lambda x: x.confidence, reverse=True)
        ]}

    @app.get("/api/skills/{skill_id}")
    async def skill_detail(skill_id: str) -> dict:
        from open_tam.skills.loader import SkillLoader

        skill = SkillLoader(settings.skills_dir).get(skill_id)
        if skill is None:
            raise HTTPException(status_code=404, detail="unknown skill")
        return skill.model_dump()

    @app.delete("/api/skills/{skill_id}")
    async def skill_delete(request: Request, skill_id: str) -> dict:
        from open_tam.skills.loader import SkillLoader

        user = getattr(request.state, "user", None)
        if user is not None:
            from open_tam.auth.roles import has_permission

            if not has_permission(user.role, "manage_skills"):
                raise HTTPException(status_code=403,
                                    detail="role does not allow manage_skills")
        if not SkillLoader(settings.skills_dir).delete(skill_id):
            raise HTTPException(status_code=404, detail="unknown skill")
        return {"deleted": skill_id}

    @app.get("/api/evals")
    async def evals_list(limit: int = 20) -> dict:
        from open_tam.persistence.repositories import EvalRunRepository

        limit = max(1, min(limit, 200))
        records = EvalRunRepository(db).list_all(limit=limit)
        return {"evals": [
            {"id": r.id, "model_label": r.model_label, "total": r.total,
             "located_rate": r.located_rate, "hit_rate": r.hit_rate,
             "avg_steps": r.avg_steps, "avg_elapsed_s": r.avg_elapsed_s,
             "avg_evidence_sufficiency": r.avg_evidence_sufficiency,
             "report_path": r.report_path, "created_at": r.created_at}
            for r in records
        ]}

    @app.get("/api/evals/{eval_id}")
    async def eval_detail(eval_id: str) -> dict:
        from open_tam.persistence.repositories import EvalRunRepository

        r = EvalRunRepository(db).get_by_id(eval_id)
        if r is None:
            raise HTTPException(status_code=404, detail="unknown eval run")
        return {"id": r.id, "model_label": r.model_label, "total": r.total,
                "located_rate": r.located_rate, "hit_rate": r.hit_rate,
                "avg_steps": r.avg_steps, "avg_elapsed_s": r.avg_elapsed_s,
                "avg_evidence_sufficiency": r.avg_evidence_sufficiency,
                "runs": r.runs, "report_path": r.report_path,
                "created_at": r.created_at}

    @app.get("/api/config")
    async def config_info() -> dict:
        return {
            "auth_enabled": auth_enabled,
            "metrics_backend": settings.metrics_backend,
            "logs_backend": settings.logs_backend,
            "regions": list(settings.regions),
            "model_primary": settings.model_primary,
            "model_fallback": settings.model_fallback,
            "max_steps": settings.max_steps,
            "webhook_secret_configured": bool(settings.webhook_secret),
            "notifications": {
                "dingtalk": bool(settings.notify_dingtalk_webhook),
                "feishu": bool(settings.notify_feishu_webhook),
                "slack": bool(settings.notify_slack_webhook),
            },
            "roles": {
                role.value: sorted(PERMISSIONS[role])
                for role in Role
            },
        }

    @app.get("/api/catalog")
    async def catalog_info() -> dict:
        return catalog_payload

    @app.get("/api/book")
    async def book_index() -> dict:
        return book.index_payload()

    @app.get("/api/book/{slug}")
    async def book_chapter(slug: str) -> dict:
        rendered = book.render(slug)
        if rendered is None:
            raise HTTPException(status_code=404, detail="unknown book document")
        data = asdict(rendered)
        data["workflows"] = workflows.for_document(slug)
        return data

    def _workflow_reader(request: Request):
        user = _current_user(request)
        if user is None and auth_enabled:
            raise HTTPException(status_code=401, detail="authentication required")
        return user

    @app.get("/api/workflows")
    async def workflows_index(request: Request) -> dict:
        _workflow_reader(request)
        return workflows.index_payload()

    @app.get("/api/workflows/{workflow_id}")
    async def workflow_detail(request: Request, workflow_id: str) -> dict:
        _workflow_reader(request)
        workflow = workflows.get(workflow_id)
        if workflow is None:
            raise HTTPException(status_code=404, detail="unknown workflow")
        return workflows.detail_payload(workflow, book)

    @app.get("/api/workflow-runs")
    async def list_workflow_runs(request: Request, limit: int = 50) -> dict:
        user = _require_user(request)
        limit = max(1, min(limit, 200))
        runs = WorkflowRunRepository(db).list_by_user(user.id, limit=limit)
        return {"runs": [_workflow_run_payload(run, workflows) for run in runs]}

    @app.post("/api/workflows/{workflow_id}/runs", status_code=201)
    async def create_workflow_run(request: Request, workflow_id: str) -> dict:
        user = _require_user(request)
        workflow = workflows.get(workflow_id)
        if workflow is None:
            raise HTTPException(status_code=404, detail="unknown workflow")
        now = datetime.now().isoformat()
        run = WorkflowRunRecord(
            id=uuid4().hex[:12], user_id=user.id, workflow_id=workflow_id,
            status="in_progress",
            steps=[{"id": step.id, "title": step.title, "done": False}
                   for step in workflow.steps],
            notes=None, created_at=now, updated_at=now,
        )
        WorkflowRunRepository(db).create(run)
        return _workflow_run_payload(run, workflows)

    @app.get("/api/workflow-runs/{run_id}")
    async def workflow_run_detail(request: Request, run_id: str) -> dict:
        user = _require_user(request)
        repo = WorkflowRunRepository(db)
        run = repo.get_by_id(run_id)
        if run is None:
            raise HTTPException(status_code=404, detail="unknown workflow run")
        if run.user_id != user.id and not _is_admin(user):
            raise HTTPException(status_code=403, detail="no access to this workflow run")
        payload = _workflow_run_payload(run, workflows)
        workflow = workflows.get(run.workflow_id)
        payload["workflow"] = workflows.detail_payload(workflow, book) if workflow else None
        return payload

    @app.patch("/api/workflow-runs/{run_id}")
    async def update_workflow_run(request: Request, run_id: str,
                                  payload: WorkflowRunPatch) -> dict:
        user = _require_user(request)
        repo = WorkflowRunRepository(db)
        run = repo.get_by_id(run_id)
        if run is None:
            raise HTTPException(status_code=404, detail="unknown workflow run")
        if run.user_id != user.id and not _is_admin(user):
            raise HTTPException(status_code=403, detail="no access to this workflow run")
        workflow = workflows.get(run.workflow_id)
        steps = _normalize_run_steps(workflow, payload.steps, run.steps)
        repo.update(
            run_id, steps=steps,
            notes=payload.notes if payload.notes is not None else run.notes,
            status=payload.status if payload.status is not None else run.status,
        )
        updated = repo.get_by_id(run_id)
        return _workflow_run_payload(updated, workflows) if updated else {"updated": True}

    @app.delete("/api/workflow-runs/{run_id}")
    async def delete_workflow_run(request: Request, run_id: str) -> dict:
        user = _require_user(request)
        repo = WorkflowRunRepository(db)
        run = repo.get_by_id(run_id)
        if run is None:
            raise HTTPException(status_code=404, detail="unknown workflow run")
        if run.user_id != user.id and not _is_admin(user):
            raise HTTPException(status_code=403, detail="no access to this workflow run")
        repo.delete(run_id, run.user_id)
        return {"deleted": run_id}

    @app.get("/api/learning/progress")
    async def get_learning_progress(request: Request) -> dict:
        user = _require_user(request)
        records = LearningProgressRepository(db).list_by_user(user.id)
        return {"progress": [_progress_payload(record) for record in records]}

    @app.put("/api/learning/progress")
    async def save_learning_progress(request: Request,
                                     payload: ProgressUpdate) -> dict:
        user = _require_user(request)
        if not _catalog_object_exists(catalog, payload.object_type, payload.object_id):
            raise HTTPException(status_code=422, detail="unknown catalog object")
        LearningProgressRepository(db).upsert(
            user.id, payload.object_type, payload.object_id,
            payload.status, payload.score,
        )
        return {"saved": True}

    @app.post("/api/learning/progress/merge")
    async def merge_learning_progress(request: Request,
                                      payload: ProgressMergePayload) -> dict:
        user = _require_user(request)
        repo = LearningProgressRepository(db)
        existing = {
            (record.object_type, record.object_id): record
            for record in repo.list_by_user(user.id)
        }
        for item in payload.items:
            if not _catalog_object_exists(catalog, item.object_type, item.object_id):
                continue
            current = existing.get((item.object_type, item.object_id))
            if current and current.status == "completed" and item.status == "in_progress":
                continue
            repo.upsert(user.id, item.object_type, item.object_id,
                        item.status, item.score)
        merged = repo.list_by_user(user.id)
        return {"progress": [_progress_payload(record) for record in merged]}

    @app.get("/api/attempts")
    async def list_attempts(request: Request, limit: int = 50) -> dict:
        user = _require_user(request)
        limit = max(1, min(limit, 200))
        records = CaseAttemptRepository(db).list_by_user(user.id, limit=limit)
        return {"attempts": [_attempt_payload(record) for record in records]}

    @app.post("/api/cases/{case_id}/attempts", status_code=201)
    async def create_case_attempt(request: Request, case_id: str,
                                  payload: AttemptCreatePayload) -> dict:
        user = _require_user(request)
        if catalog.case(case_id) is None:
            raise HTTPException(status_code=404, detail="unknown case")
        now = datetime.now().isoformat()
        attempt = CaseAttemptRecord(
            id=uuid4().hex[:12], user_id=user.id, case_id=case_id,
            investigation_id=payload.investigation_id, status="started",
            score=None, root_cause=None, evidence_sufficiency=None,
            reviewer_id=None, review_note=None, created_at=now, updated_at=now,
        )
        CaseAttemptRepository(db).create(attempt)
        return _attempt_payload(attempt)

    @app.patch("/api/attempts/{attempt_id}")
    async def update_case_attempt(request: Request, attempt_id: str,
                                  payload: AttemptUpdatePayload) -> dict:
        user = _require_user(request)
        repo = CaseAttemptRepository(db)
        attempt = repo.get_by_id(attempt_id)
        if attempt is None:
            raise HTTPException(status_code=404, detail="unknown attempt")
        if attempt.user_id != user.id and not has_permission(user.role, "review_attempts"):
            raise HTTPException(status_code=403, detail="no access to this attempt")
        if payload.status == "reviewed" and not has_permission(user.role, "review_attempts"):
            raise HTTPException(status_code=403, detail="role cannot review attempts")

        updates = payload.model_dump(exclude_none=True)
        case = catalog.case(attempt.case_id)
        if payload.status == "completed":
            root_cause = payload.root_cause or attempt.root_cause
            score = payload.score
            if score is None and case is not None:
                score = _score_case(case, root_cause)
            updates["score"] = score
            if root_cause:
                updates["root_cause"] = root_cause
            if case is not None:
                LearningProgressRepository(db).upsert(
                    attempt.user_id, "case", attempt.case_id, "completed", score)
        repo.update(attempt_id, **updates)
        updated = repo.get_by_id(attempt_id)
        return _attempt_payload(updated) if updated else {"updated": True}

    @app.post("/api/attempts/{attempt_id}/review")
    async def review_case_attempt(request: Request, attempt_id: str,
                                  payload: ReviewPayload) -> dict:
        user = _require_user(request)
        if not has_permission(user.role, "review_attempts"):
            raise HTTPException(status_code=403, detail="role cannot review attempts")
        repo = CaseAttemptRepository(db)
        attempt = repo.get_by_id(attempt_id)
        if attempt is None:
            raise HTTPException(status_code=404, detail="unknown attempt")
        repo.update(
            attempt_id, status="reviewed", score=payload.score,
            reviewer_id=user.id, review_note=payload.review_note,
        )
        LearningProgressRepository(db).upsert(
            attempt.user_id, "case", attempt.case_id, "completed", payload.score)
        updated = repo.get_by_id(attempt_id)
        return _attempt_payload(updated) if updated else {"reviewed": True}

    @app.get("/api/teams")
    async def list_teams(request: Request) -> dict:
        user = _require_user(request)
        if not has_permission(user.role, "manage_teams"):
            raise HTTPException(status_code=403, detail="role cannot manage teams")
        teams = TeamRepository(db).list_all()
        return {"teams": [
            {"id": team.id, "name": team.name, "created_at": team.created_at}
            for team in teams
        ]}

    @app.post("/api/teams", status_code=201)
    async def create_team(request: Request, payload: TeamCreatePayload) -> dict:
        user = _require_user(request)
        if not has_permission(user.role, "manage_teams"):
            raise HTTPException(status_code=403, detail="role cannot manage teams")
        name = payload.name.strip()
        if not name:
            raise HTTPException(status_code=422, detail="team name is required")
        repo = TeamRepository(db)
        if repo.get_by_name(name):
            raise HTTPException(status_code=409, detail="team already exists")
        team = TeamRecord(id=uuid4().hex[:12], name=name,
                          created_at=datetime.now().isoformat())
        repo.create(team)
        return {"id": team.id, "name": team.name, "created_at": team.created_at}

    @app.get("/api/team/progress")
    async def team_progress(request: Request, team_id: str | None = None) -> dict:
        user = _require_user(request)
        if not has_permission(user.role, "view_team"):
            raise HTTPException(status_code=403, detail="role cannot view team progress")
        target_team = team_id if _is_admin(user) and team_id else user.team_id
        if not target_team:
            return {"team_id": None, "members": [], "skills": [], "pending_reviews": []}
        team = TeamRepository(db).get_by_id(target_team)
        if team is None:
            raise HTTPException(status_code=404, detail="unknown team")
        users = UserRepository(db).list_by_team(target_team)
        progress_repo = LearningProgressRepository(db)
        attempt_repo = CaseAttemptRepository(db)
        members = []
        member_progress: dict[str, list] = {}
        for member in users:
            records = progress_repo.list_by_user(member.id)
            member_progress[member.id] = records
            attempts = attempt_repo.list_by_user(member.id, limit=200)
            modules_done = sum(
                1 for record in records
                if record.object_type == "module" and record.status == "completed"
            )
            cases_done = sum(
                1 for record in records
                if record.object_type == "case" and record.status == "completed"
            )
            pending = sum(1 for attempt in attempts if attempt.status == "completed")
            last = max(
                [record.updated_at for record in records]
                + [attempt.updated_at for attempt in attempts],
                default=None,
            )
            members.append({
                "id": member.id, "username": member.username, "role": member.role,
                "modules_completed": modules_done, "cases_completed": cases_done,
                "pending_reviews": pending, "last_activity": last,
            })
        skill_rows = []
        for skill in catalog.skills:
            related_cases = {
                case.id for case in catalog.cases
                if skill.id in case.skill_ids
            }
            related_modules = {
                module.id for module in catalog.modules
                if skill.id in module.skill_ids
            }
            covered = 0
            for records in member_progress.values():
                case_done = {
                    record.object_id for record in records
                    if record.object_type == "case" and record.status == "completed"
                }
                module_done = {
                    record.object_id for record in records
                    if record.object_type == "module" and record.status == "completed"
                }
                if (case_done & related_cases) or (module_done & related_modules):
                    covered += 1
            skill_rows.append({
                "id": skill.id, "name": skill.name, "category": skill.category,
                "covered_members": covered, "total_members": len(users),
            })
        pending_reviews = attempt_repo.list_pending_review(target_team)
        return {
            "team_id": team.id, "team_name": team.name,
            "members": members, "skills": skill_rows,
            "pending_reviews": [_attempt_payload(attempt) for attempt in pending_reviews],
        }

    @app.get("/api/faults")
    async def list_faults() -> dict:
        return {"faults": [
            {"name": m.name, "service": m.service, "metric": m.metric,
             "alert_name": f"{m.name} 告警", "threshold": m.baseline_high,
             "current_value": m.spike_value, "anomaly_desc": m.anomaly_desc,
             "root_cause": m.root_cause, "remediation": m.remediation,
             "log_signature": m.log_signature, "eval_keywords": list(m.eval_keywords)}
            for m in FAULT_MODES.values()
        ]}

    @app.post("/api/faults/{name}/activate")
    async def activate_fault(request: Request, name: str) -> dict:
        user = _current_user(request)
        if user is not None and not has_permission(user.role, "write"):
            raise HTTPException(status_code=403,
                                detail="role does not allow fault injection")
        if name not in FAULT_MODES:
            raise HTTPException(status_code=404, detail=f"unknown fault: {name}")
        FaultState().activate(name, duration_minutes=30)
        return {"activated": name}

    @app.post("/alerts", status_code=202)
    async def receive_alert(request: Request) -> dict:
        """Cloud-monitor/AlertManager webhook: validate, dedup, investigate."""
        body = await request.body()
        if settings.webhook_secret:
            signature = request.headers.get("X-Signature", "")
            if not verify_signature(body, signature, settings.webhook_secret):
                raise HTTPException(status_code=401, detail="invalid signature")
        try:
            payload = json.loads(body)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=422, detail=f"invalid JSON: {exc}") from exc
        if not isinstance(payload, dict):
            raise HTTPException(status_code=422, detail="payload must be an object")
        try:
            event = adapt_alert(payload)
        except Exception as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        if not os.environ.get("DASHSCOPE_API_KEY"):
            raise HTTPException(
                status_code=503,
                detail="DASHSCOPE_API_KEY not configured; webhook investigations need a model",
            )
        if not dedup.should_process(event.alert_name, event.service):
            return {"alert_id": event.alert_id, "dedup": True}
        transport = (
            "mcp"
            if settings.metrics_backend != "mock" or settings.logs_backend != "mock"
            else "inline"
        )
        loop = asyncio.get_running_loop()
        inv = start_investigation(
            hub, event, fake=False, transport=transport,
            loop=loop, db=db, user_id=None,
        )
        return {"alert_id": event.alert_id, "id": inv.id, "dedup": False}

    @app.get("/health")
    @app.get("/api/health")
    async def health() -> dict:
        return {"status": "ok"}

    @app.get("/")
    async def index() -> FileResponse:
        return FileResponse(STATIC_DIR / "index.html")

    return app