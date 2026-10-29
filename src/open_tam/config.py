from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    state_dir: Path
    reports_dir: Path
    traces_dir: Path
    content_dir: Path
    book_dir: Path
    model_primary: str
    model_fallback: str
    model_timeout: float
    max_steps: int
    char_budget: int
    metrics_backend: str
    logs_backend: str
    regions: tuple[str, ...]
    aliyun_region: str
    aliyun_access_key_id: str
    aliyun_access_key_secret: str
    aliyun_sls_project: str
    aliyun_sls_logstore: str
    dedup_window_seconds: int
    webhook_secret: str
    skills_dir: Path
    database_url: str
    auth_enabled: bool
    notify_dingtalk_webhook: str
    notify_feishu_webhook: str
    notify_slack_webhook: str

    @classmethod
    def load(cls) -> Settings:
        base = Path(os.environ.get("OPEN_TAM_BASE_DIR", "."))
        return cls(
            state_dir=Path(os.environ.get("OPEN_TAM_STATE_DIR", base / "var")),
            reports_dir=Path(os.environ.get("OPEN_TAM_REPORTS_DIR", base / "reports")),
            traces_dir=Path(os.environ.get("OPEN_TAM_TRACES_DIR", base / "traces")),
            content_dir=Path(os.environ.get(
                "OPEN_TAM_CONTENT_DIR",
                Path(__file__).resolve().parents[2] / "content",
            )),
            book_dir=Path(os.environ.get(
                "OPEN_TAM_BOOK_DIR",
                Path(__file__).resolve().parents[2] / "content" / "tam-book",
            )),
            model_primary=os.environ.get("OPEN_TAM_MODEL_PRIMARY", "qwen-plus"),
            model_fallback=os.environ.get("OPEN_TAM_MODEL_FALLBACK", "qwen-turbo"),
            model_timeout=float(os.environ.get("OPEN_TAM_MODEL_TIMEOUT", "120")),
            max_steps=int(os.environ.get("OPEN_TAM_MAX_STEPS", "15")),
            char_budget=int(os.environ.get("OPEN_TAM_CHAR_BUDGET", "60000")),
            metrics_backend=os.environ.get("OPEN_TAM_METRICS_BACKEND", "mock"),
            logs_backend=os.environ.get("OPEN_TAM_LOGS_BACKEND", "mock"),
            regions=tuple(r.strip() for r in os.environ.get("OPEN_TAM_REGIONS", "").split(",") if r.strip()),
            aliyun_region=os.environ.get("OPEN_TAM_ALIYUN_REGION", "cn-hangzhou"),
            aliyun_access_key_id=os.environ.get("OPEN_TAM_ALIYUN_ACCESS_KEY_ID", os.environ.get("ALIYUN_ACCESS_KEY_ID", "")),
            aliyun_access_key_secret=os.environ.get("OPEN_TAM_ALIYUN_ACCESS_KEY_SECRET", os.environ.get("ALIYUN_ACCESS_KEY_SECRET", "")),
            aliyun_sls_project=os.environ.get("OPEN_TAM_ALIYUN_SLS_PROJECT", ""),
            aliyun_sls_logstore=os.environ.get("OPEN_TAM_ALIYUN_SLS_LOGSTORE", ""),
            dedup_window_seconds=int(os.environ.get("OPEN_TAM_DEDUP_WINDOW_SECONDS", "300")),
            webhook_secret=os.environ.get("OPEN_TAM_WEBHOOK_SECRET", ""),
            skills_dir=Path(os.environ.get("OPEN_TAM_SKILLS_DIR", base / "skills")),
            database_url=os.environ.get("OPEN_TAM_DATABASE_URL", f"sqlite:///{base / 'var' / 'open_tam.db'}"),
            auth_enabled=os.environ.get("OPEN_TAM_AUTH_ENABLED", "false").lower() == "true",
            notify_dingtalk_webhook=os.environ.get("OPEN_TAM_NOTIFY_DINGTALK_WEBHOOK", ""),
            notify_feishu_webhook=os.environ.get("OPEN_TAM_NOTIFY_FEISHU_WEBHOOK", ""),
            notify_slack_webhook=os.environ.get("OPEN_TAM_NOTIFY_SLACK_WEBHOOK", ""),
        )

    def aliyun_env(self) -> dict[str, str]:
        """Environment variables expected by the Aliyun MCP servers."""
        values = {
            "ALIYUN_ACCESS_KEY_ID": self.aliyun_access_key_id,
            "ALIYUN_ACCESS_KEY_SECRET": self.aliyun_access_key_secret,
            "ALIYUN_REGION": self.aliyun_region,
            "ALIYUN_SLS_PROJECT": self.aliyun_sls_project,
            "ALIYUN_SLS_LOGSTORE": self.aliyun_sls_logstore,
        }
        return {k: v for k, v in values.items() if v}
