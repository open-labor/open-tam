"""SQLite persistence layer with simple version-based migration."""
from __future__ import annotations

import sqlite3
import threading
from collections.abc import Generator
from contextlib import contextmanager
from pathlib import Path

CURRENT_SCHEMA_VERSION = 4


class Database:
    """SQLite database with WAL mode, one connection per thread."""

    def __init__(self, db_path: str | Path) -> None:
        self.db_path = str(db_path)
        self._local = threading.local()
        self._connections: list[sqlite3.Connection] = []
        self._lock = threading.Lock()

    def connect(self) -> None:
        self._get_conn()

    def _get_conn(self) -> sqlite3.Connection:
        conn = getattr(self._local, "conn", None)
        if conn is None:
            conn = sqlite3.connect(self.db_path, check_same_thread=False)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA foreign_keys=ON")
            self._local.conn = conn
            with self._lock:
                self._connections.append(conn)
        return conn

    @property
    def _conn(self) -> sqlite3.Connection:
        return self._get_conn()

    def close(self) -> None:
        with self._lock:
            connections = list(self._connections)
            self._connections.clear()
        for conn in connections:
            try:
                conn.close()
            except Exception:
                pass
        self._local = threading.local()

    @contextmanager
    def transaction(self) -> Generator[sqlite3.Connection, None, None]:
        conn = self._conn
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise

    def migrate(self) -> None:
        assert self._conn is not None, "Database not connected"
        current = self._get_schema_version()
        if current < 1:
            self._migrate_v1()
        if current < 2:
            self._migrate_v2()
        if current < 3:
            self._migrate_v3()
        if current < 4:
            self._migrate_v4()
        self._set_schema_version(CURRENT_SCHEMA_VERSION)

    def _get_schema_version(self) -> int:
        assert self._conn is not None
        try:
            row = self._conn.execute(
                "SELECT version FROM schema_version LIMIT 1"
            ).fetchone()
            return row[0] if row else 0
        except sqlite3.OperationalError:
            return 0

    def _set_schema_version(self, version: int) -> None:
        assert self._conn is not None
        self._conn.execute(
            "INSERT OR REPLACE INTO schema_version (id, version) VALUES (1, ?)",
            (version,),
        )
        self._conn.commit()

    def _migrate_v1(self) -> None:
        assert self._conn is not None
        self._conn.executescript("""
            CREATE TABLE IF NOT EXISTS schema_version (
                id INTEGER PRIMARY KEY,
                version INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                api_key_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'viewer',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS investigations (
                id TEXT PRIMARY KEY,
                alert_id TEXT NOT NULL,
                user_id TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                root_cause TEXT,
                confidence TEXT,
                report_path TEXT,
                trace_path TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS alerts (
                id TEXT PRIMARY KEY,
                alert_name TEXT NOT NULL,
                service TEXT NOT NULL,
                metric TEXT NOT NULL,
                severity TEXT NOT NULL DEFAULT 'warning',
                payload TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS audit_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT NOT NULL,
                actor TEXT NOT NULL,
                params TEXT,
                result TEXT,
                dry_run INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS skill_index (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                alert_pattern TEXT NOT NULL,
                confidence REAL NOT NULL,
                file_path TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_investigations_user ON investigations(user_id);
            CREATE INDEX IF NOT EXISTS idx_investigations_status ON investigations(status);
            CREATE INDEX IF NOT EXISTS idx_alerts_service ON alerts(service);
            CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_entries(actor);
        """)
        self._conn.commit()

    def _migrate_v2(self) -> None:
        assert self._conn is not None
        self._conn.executescript("""
            CREATE TABLE IF NOT EXISTS eval_runs (
                id TEXT PRIMARY KEY,
                model_label TEXT NOT NULL,
                total INTEGER NOT NULL,
                located_rate REAL NOT NULL,
                hit_rate REAL NOT NULL,
                avg_steps REAL NOT NULL,
                avg_elapsed_s REAL NOT NULL,
                avg_evidence_sufficiency REAL NOT NULL,
                runs_json TEXT NOT NULL,
                report_path TEXT,
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_eval_runs_created ON eval_runs(created_at);
        """)
        self._conn.commit()

    def _migrate_v3(self) -> None:
        assert self._conn is not None
        self._conn.executescript("""
            CREATE TABLE IF NOT EXISTS teams (
                id TEXT PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                created_at TEXT NOT NULL
            );

            ALTER TABLE users ADD COLUMN team_id TEXT;

            CREATE TABLE IF NOT EXISTS learning_progress (
                user_id TEXT NOT NULL,
                object_type TEXT NOT NULL,
                object_id TEXT NOT NULL,
                status TEXT NOT NULL,
                score REAL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (user_id, object_type, object_id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE INDEX IF NOT EXISTS idx_learning_user ON learning_progress(user_id);
            CREATE INDEX IF NOT EXISTS idx_learning_object
                ON learning_progress(object_type, object_id);

            CREATE TABLE IF NOT EXISTS case_attempts (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                case_id TEXT NOT NULL,
                investigation_id TEXT,
                status TEXT NOT NULL DEFAULT 'started',
                score REAL,
                root_cause TEXT,
                evidence_sufficiency REAL,
                reviewer_id TEXT,
                review_note TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE INDEX IF NOT EXISTS idx_attempts_user ON case_attempts(user_id);
            CREATE INDEX IF NOT EXISTS idx_attempts_case ON case_attempts(case_id);
            CREATE INDEX IF NOT EXISTS idx_attempts_status ON case_attempts(status);
        """)
        self._conn.commit()

    def _migrate_v4(self) -> None:
        assert self._conn is not None
        self._conn.executescript("""
            CREATE TABLE IF NOT EXISTS workflow_runs (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                workflow_id TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'in_progress',
                steps_json TEXT NOT NULL,
                notes TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE INDEX IF NOT EXISTS idx_workflow_runs_user
                ON workflow_runs(user_id);
            CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow
                ON workflow_runs(workflow_id);
            CREATE INDEX IF NOT EXISTS idx_workflow_runs_updated
                ON workflow_runs(updated_at);
        """)
        self._conn.commit()


_db_instance: Database | None = None


def get_database(db_path: str | Path | None = None) -> Database:
    global _db_instance
    if _db_instance is None:
        if db_path is None:
            raise ValueError("db_path required on first call")
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        _db_instance = Database(db_path)
        _db_instance.connect()
        _db_instance.migrate()
    return _db_instance


def reset_database() -> None:
    global _db_instance
    if _db_instance:
        _db_instance.close()
        _db_instance = None
