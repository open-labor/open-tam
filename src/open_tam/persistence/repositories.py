"""Repository classes for database entities."""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from open_tam.persistence.database import Database


@dataclass
class UserRecord:
    id: str
    username: str
    api_key_hash: str
    role: str
    created_at: str
    updated_at: str
    team_id: str | None = None


@dataclass
class InvestigationRecord:
    id: str
    alert_id: str
    user_id: str | None
    status: str
    root_cause: str | None
    confidence: str | None
    report_path: str | None
    trace_path: str | None
    created_at: str
    updated_at: str


@dataclass
class AlertRecord:
    id: str
    alert_name: str
    service: str
    metric: str
    severity: str
    payload: dict[str, Any]
    created_at: str


@dataclass
class AuditEntry:
    id: int
    action: str
    actor: str
    params: dict[str, Any] | None
    result: str | None
    dry_run: bool
    created_at: str


@dataclass
class EvalRunRecord:
    id: str
    model_label: str
    total: int
    located_rate: float
    hit_rate: float
    avg_steps: float
    avg_elapsed_s: float
    avg_evidence_sufficiency: float
    runs: list[dict[str, Any]]
    report_path: str | None
    created_at: str


class UserRepository:
    def __init__(self, db: Database) -> None:
        self.db = db

    def create(self, user: UserRecord) -> None:
        assert self.db._conn is not None
        self.db._conn.execute(
            """INSERT INTO users
               (id, username, api_key_hash, role, team_id, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (user.id, user.username, user.api_key_hash, user.role, user.team_id,
             user.created_at, user.updated_at),
        )
        self.db._conn.commit()

    def get_by_id(self, user_id: str) -> UserRecord | None:
        assert self.db._conn is not None
        row = self.db._conn.execute(
            "SELECT * FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        return UserRecord(**dict(row)) if row else None

    def get_by_username(self, username: str) -> UserRecord | None:
        assert self.db._conn is not None
        row = self.db._conn.execute(
            "SELECT * FROM users WHERE username = ?", (username,)
        ).fetchone()
        return UserRecord(**dict(row)) if row else None

    def list_all(self) -> list[UserRecord]:
        assert self.db._conn is not None
        rows = self.db._conn.execute(
            "SELECT * FROM users ORDER BY created_at DESC"
        ).fetchall()
        return [UserRecord(**dict(r)) for r in rows]

    def list_by_team(self, team_id: str) -> list[UserRecord]:
        assert self.db._conn is not None
        rows = self.db._conn.execute(
            "SELECT * FROM users WHERE team_id = ? ORDER BY created_at DESC",
            (team_id,),
        ).fetchall()
        return [UserRecord(**dict(row)) for row in rows]

    def set_team(self, user_id: str, team_id: str | None) -> None:
        assert self.db._conn is not None
        self.db._conn.execute(
            "UPDATE users SET team_id = ?, updated_at = ? WHERE id = ?",
            (team_id, datetime.now().isoformat(), user_id),
        )
        self.db._conn.commit()

    def delete(self, user_id: str) -> bool:
        assert self.db._conn is not None
        cursor = self.db._conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
        self.db._conn.commit()
        return cursor.rowcount > 0


class InvestigationRepository:
    def __init__(self, db: Database) -> None:
        self.db = db

    def create(self, inv: InvestigationRecord) -> None:
        assert self.db._conn is not None
        self.db._conn.execute(
            """INSERT INTO investigations
               (id, alert_id, user_id, status, root_cause, confidence,
                report_path, trace_path, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (inv.id, inv.alert_id, inv.user_id, inv.status, inv.root_cause,
             inv.confidence, inv.report_path, inv.trace_path,
             inv.created_at, inv.updated_at),
        )
        self.db._conn.commit()

    def get_by_id(self, inv_id: str) -> InvestigationRecord | None:
        assert self.db._conn is not None
        row = self.db._conn.execute(
            "SELECT * FROM investigations WHERE id = ?", (inv_id,)
        ).fetchone()
        return InvestigationRecord(**dict(row)) if row else None

    def update_status(
        self, inv_id: str, status: str,
        root_cause: str | None = None, confidence: str | None = None,
        report_path: str | None = None, trace_path: str | None = None,
    ) -> None:
        assert self.db._conn is not None
        now = datetime.now().isoformat()
        self.db._conn.execute(
            """UPDATE investigations
               SET status = ?, root_cause = ?, confidence = ?,
                   report_path = ?, trace_path = ?, updated_at = ?
               WHERE id = ?""",
            (status, root_cause, confidence, report_path, trace_path, now, inv_id),
        )
        self.db._conn.commit()

    def list_by_user(self, user_id: str, limit: int = 50) -> list[InvestigationRecord]:
        assert self.db._conn is not None
        rows = self.db._conn.execute(
            "SELECT * FROM investigations WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
        return [InvestigationRecord(**dict(r)) for r in rows]

    def list_all(self, limit: int = 50) -> list[InvestigationRecord]:
        assert self.db._conn is not None
        rows = self.db._conn.execute(
            "SELECT * FROM investigations ORDER BY created_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
        return [InvestigationRecord(**dict(r)) for r in rows]


class AlertRepository:
    def __init__(self, db: Database) -> None:
        self.db = db

    def create(self, alert: AlertRecord) -> None:
        assert self.db._conn is not None
        self.db._conn.execute(
            """INSERT INTO alerts (id, alert_name, service, metric, severity, payload, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (alert.id, alert.alert_name, alert.service, alert.metric,
             alert.severity, json.dumps(alert.payload, ensure_ascii=False),
             alert.created_at),
        )
        self.db._conn.commit()

    def get_by_id(self, alert_id: str) -> AlertRecord | None:
        assert self.db._conn is not None
        row = self.db._conn.execute(
            "SELECT * FROM alerts WHERE id = ?", (alert_id,)
        ).fetchone()
        if not row:
            return None
        d = dict(row)
        d["payload"] = json.loads(d["payload"])
        return AlertRecord(**d)

    def list_by_service(self, service: str, limit: int = 50) -> list[AlertRecord]:
        assert self.db._conn is not None
        rows = self.db._conn.execute(
            "SELECT * FROM alerts WHERE service = ? ORDER BY created_at DESC LIMIT ?",
            (service, limit),
        ).fetchall()
        results = []
        for r in rows:
            d = dict(r)
            d["payload"] = json.loads(d["payload"])
            results.append(AlertRecord(**d))
        return results


class AuditRepository:
    def __init__(self, db: Database) -> None:
        self.db = db

    def create(self, entry: AuditEntry) -> int:
        assert self.db._conn is not None
        cursor = self.db._conn.execute(
            """INSERT INTO audit_entries (action, actor, params, result, dry_run, created_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (entry.action, entry.actor,
             json.dumps(entry.params, ensure_ascii=False) if entry.params else None,
             entry.result, int(entry.dry_run), entry.created_at),
        )
        self.db._conn.commit()
        return cursor.lastrowid

    def list_by_actor(self, actor: str, limit: int = 50) -> list[AuditEntry]:
        assert self.db._conn is not None
        rows = self.db._conn.execute(
            "SELECT * FROM audit_entries WHERE actor = ? ORDER BY created_at DESC LIMIT ?",
            (actor, limit),
        ).fetchall()
        results = []
        for r in rows:
            d = dict(r)
            d["params"] = json.loads(d["params"]) if d["params"] else None
            d["dry_run"] = bool(d["dry_run"])
            results.append(AuditEntry(**d))
        return results

    def list_all(self, limit: int = 50) -> list[AuditEntry]:
        assert self.db._conn is not None
        rows = self.db._conn.execute(
            "SELECT * FROM audit_entries ORDER BY created_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
        results = []
        for r in rows:
            d = dict(r)
            d["params"] = json.loads(d["params"]) if d["params"] else None
            d["dry_run"] = bool(d["dry_run"])
            results.append(AuditEntry(**d))
        return results


class EvalRunRepository:
    def __init__(self, db: Database) -> None:
        self.db = db

    def create(self, rec: EvalRunRecord) -> None:
        assert self.db._conn is not None
        self.db._conn.execute(
            """INSERT INTO eval_runs
               (id, model_label, total, located_rate, hit_rate, avg_steps,
                avg_elapsed_s, avg_evidence_sufficiency, runs_json, report_path, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (rec.id, rec.model_label, rec.total, rec.located_rate, rec.hit_rate,
             rec.avg_steps, rec.avg_elapsed_s, rec.avg_evidence_sufficiency,
             json.dumps(rec.runs, ensure_ascii=False), rec.report_path, rec.created_at),
        )
        self.db._conn.commit()

    def get_by_id(self, run_id: str) -> EvalRunRecord | None:
        assert self.db._conn is not None
        row = self.db._conn.execute(
            "SELECT * FROM eval_runs WHERE id = ?", (run_id,)
        ).fetchone()
        if not row:
            return None
        d = dict(row)
        d["runs"] = json.loads(d.pop("runs_json"))
        return EvalRunRecord(**d)

    def list_all(self, limit: int = 20) -> list[EvalRunRecord]:
        assert self.db._conn is not None
        rows = self.db._conn.execute(
            "SELECT * FROM eval_runs ORDER BY created_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
        results = []
        for r in rows:
            d = dict(r)
            d["runs"] = json.loads(d.pop("runs_json"))
            results.append(EvalRunRecord(**d))
        return results


@dataclass
class TeamRecord:
    id: str
    name: str
    created_at: str


@dataclass
class LearningProgressRecord:
    user_id: str
    object_type: str
    object_id: str
    status: str
    score: float | None
    updated_at: str


@dataclass
class CaseAttemptRecord:
    id: str
    user_id: str
    case_id: str
    investigation_id: str | None
    status: str
    score: float | None
    root_cause: str | None
    evidence_sufficiency: float | None
    reviewer_id: str | None
    review_note: str | None
    created_at: str
    updated_at: str


class TeamRepository:
    def __init__(self, db: Database) -> None:
        self.db = db

    def create(self, team: TeamRecord) -> None:
        assert self.db._conn is not None
        self.db._conn.execute(
            "INSERT INTO teams (id, name, created_at) VALUES (?, ?, ?)",
            (team.id, team.name, team.created_at),
        )
        self.db._conn.commit()

    def get_by_id(self, team_id: str) -> TeamRecord | None:
        assert self.db._conn is not None
        row = self.db._conn.execute(
            "SELECT * FROM teams WHERE id = ?", (team_id,)
        ).fetchone()
        return TeamRecord(**dict(row)) if row else None

    def get_by_name(self, name: str) -> TeamRecord | None:
        assert self.db._conn is not None
        row = self.db._conn.execute(
            "SELECT * FROM teams WHERE name = ?", (name,)
        ).fetchone()
        return TeamRecord(**dict(row)) if row else None

    def list_all(self) -> list[TeamRecord]:
        assert self.db._conn is not None
        rows = self.db._conn.execute(
            "SELECT * FROM teams ORDER BY created_at DESC"
        ).fetchall()
        return [TeamRecord(**dict(row)) for row in rows]


class LearningProgressRepository:
    def __init__(self, db: Database) -> None:
        self.db = db

    def upsert(self, user_id: str, object_type: str, object_id: str,
               status: str, score: float | None = None) -> None:
        assert self.db._conn is not None
        now = datetime.now().isoformat()
        self.db._conn.execute(
            """INSERT INTO learning_progress
               (user_id, object_type, object_id, status, score, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(user_id, object_type, object_id) DO UPDATE SET
                 status = excluded.status,
                 score = COALESCE(excluded.score, learning_progress.score),
                 updated_at = excluded.updated_at""",
            (user_id, object_type, object_id, status, score, now),
        )
        self.db._conn.commit()

    def list_by_user(self, user_id: str) -> list[LearningProgressRecord]:
        assert self.db._conn is not None
        rows = self.db._conn.execute(
            "SELECT * FROM learning_progress WHERE user_id = ? ORDER BY updated_at DESC",
            (user_id,),
        ).fetchall()
        return [LearningProgressRecord(**dict(row)) for row in rows]

    def list_by_team(self, team_id: str) -> list[LearningProgressRecord]:
        assert self.db._conn is not None
        rows = self.db._conn.execute(
            """SELECT lp.* FROM learning_progress lp
               JOIN users u ON u.id = lp.user_id
               WHERE u.team_id = ?
               ORDER BY lp.updated_at DESC""",
            (team_id,),
        ).fetchall()
        return [LearningProgressRecord(**dict(row)) for row in rows]


class CaseAttemptRepository:
    def __init__(self, db: Database) -> None:
        self.db = db

    def create(self, attempt: CaseAttemptRecord) -> None:
        assert self.db._conn is not None
        self.db._conn.execute(
            """INSERT INTO case_attempts
               (id, user_id, case_id, investigation_id, status, score,
                root_cause, evidence_sufficiency, reviewer_id, review_note,
                created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (attempt.id, attempt.user_id, attempt.case_id, attempt.investigation_id,
             attempt.status, attempt.score, attempt.root_cause,
             attempt.evidence_sufficiency, attempt.reviewer_id, attempt.review_note,
             attempt.created_at, attempt.updated_at),
        )
        self.db._conn.commit()

    def get_by_id(self, attempt_id: str) -> CaseAttemptRecord | None:
        assert self.db._conn is not None
        row = self.db._conn.execute(
            "SELECT * FROM case_attempts WHERE id = ?", (attempt_id,)
        ).fetchone()
        return CaseAttemptRecord(**dict(row)) if row else None

    def update(self, attempt_id: str, **fields: object) -> bool:
        allowed = {
            "investigation_id", "status", "score", "root_cause",
            "evidence_sufficiency", "reviewer_id", "review_note",
        }
        updates = {key: value for key, value in fields.items() if key in allowed}
        if not updates:
            return False
        updates["updated_at"] = datetime.now().isoformat()
        assignments = ", ".join(f"{key} = ?" for key in updates)
        values = list(updates.values()) + [attempt_id]
        assert self.db._conn is not None
        cursor = self.db._conn.execute(
            f"UPDATE case_attempts SET {assignments} WHERE id = ?", values
        )
        self.db._conn.commit()
        return cursor.rowcount > 0

    def list_by_user(self, user_id: str, limit: int = 50) -> list[CaseAttemptRecord]:
        assert self.db._conn is not None
        rows = self.db._conn.execute(
            "SELECT * FROM case_attempts WHERE user_id = ? "
            "ORDER BY created_at DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
        return [CaseAttemptRecord(**dict(row)) for row in rows]

    def list_by_team(self, team_id: str, limit: int = 100) -> list[CaseAttemptRecord]:
        assert self.db._conn is not None
        rows = self.db._conn.execute(
            """SELECT ca.* FROM case_attempts ca
               JOIN users u ON u.id = ca.user_id
               WHERE u.team_id = ?
               ORDER BY ca.created_at DESC LIMIT ?""",
            (team_id, limit),
        ).fetchall()
        return [CaseAttemptRecord(**dict(row)) for row in rows]

    def list_pending_review(self, team_id: str | None = None,
                            limit: int = 50) -> list[CaseAttemptRecord]:
        assert self.db._conn is not None
        if team_id:
            rows = self.db._conn.execute(
                """SELECT ca.* FROM case_attempts ca
                   JOIN users u ON u.id = ca.user_id
                   WHERE u.team_id = ? AND ca.status = 'completed'
                   ORDER BY ca.updated_at ASC LIMIT ?""",
                (team_id, limit),
            ).fetchall()
        else:
            rows = self.db._conn.execute(
                "SELECT * FROM case_attempts WHERE status = 'completed' "
                "ORDER BY updated_at ASC LIMIT ?",
                (limit,),
            ).fetchall()
        return [CaseAttemptRecord(**dict(row)) for row in rows]


@dataclass
class WorkflowRunRecord:
    id: str
    user_id: str
    workflow_id: str
    status: str
    steps: list[dict]
    notes: str | None
    created_at: str
    updated_at: str


class WorkflowRunRepository:
    def __init__(self, db: Database) -> None:
        self.db = db

    @staticmethod
    def _from_row(row) -> WorkflowRunRecord:
        data = dict(row)
        data["steps"] = json.loads(data.pop("steps_json"))
        return WorkflowRunRecord(**data)

    def create(self, run: WorkflowRunRecord) -> None:
        assert self.db._conn is not None
        self.db._conn.execute(
            """INSERT INTO workflow_runs
               (id, user_id, workflow_id, status, steps_json, notes, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (run.id, run.user_id, run.workflow_id, run.status,
             json.dumps(run.steps, ensure_ascii=False), run.notes,
             run.created_at, run.updated_at),
        )
        self.db._conn.commit()

    def get_by_id(self, run_id: str) -> WorkflowRunRecord | None:
        assert self.db._conn is not None
        row = self.db._conn.execute(
            "SELECT * FROM workflow_runs WHERE id = ?", (run_id,)
        ).fetchone()
        return self._from_row(row) if row else None

    def update(self, run_id: str, *, steps: list[dict] | None = None,
               notes: str | None = None, status: str | None = None) -> bool:
        assert self.db._conn is not None
        current = self.get_by_id(run_id)
        if current is None:
            return False
        self.db._conn.execute(
            """UPDATE workflow_runs
               SET steps_json = ?, notes = ?, status = ?, updated_at = ?
               WHERE id = ?""",
            (json.dumps(steps if steps is not None else current.steps, ensure_ascii=False),
             notes if notes is not None else current.notes,
             status if status is not None else current.status,
             datetime.now().isoformat(), run_id),
        )
        self.db._conn.commit()
        return True

    def list_by_user(self, user_id: str, limit: int = 50) -> list[WorkflowRunRecord]:
        assert self.db._conn is not None
        rows = self.db._conn.execute(
            "SELECT * FROM workflow_runs WHERE user_id = ? "
            "ORDER BY updated_at DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
        return [self._from_row(row) for row in rows]

    def delete(self, run_id: str, user_id: str) -> bool:
        assert self.db._conn is not None
        cursor = self.db._conn.execute(
            "DELETE FROM workflow_runs WHERE id = ? AND user_id = ?",
            (run_id, user_id),
        )
        self.db._conn.commit()
        return cursor.rowcount > 0
