from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from open_tam.config import Settings
from open_tam.eval_judge import EvidenceJudge, fake_judge_model
from open_tam.faults import FAULT_MODES, FaultMode, FaultState
from open_tam.models import AlertEvent
from open_tam.orchestrator.investigate import run_investigation
from open_tam.tracing.trace import TraceRecorder, load_trace


@dataclass(frozen=True)
class EvalRun:
    fault: str
    root_cause: str | None
    keyword_hit: bool
    confidence: str
    steps: int
    elapsed_s: float
    evidence_sufficiency: float = 0.0


@dataclass(frozen=True)
class EvalReport:
    model_label: str
    runs: list[EvalRun]

    @property
    def total(self) -> int:
        return len(self.runs)

    @property
    def located_rate(self) -> float:
        return sum(r.root_cause is not None for r in self.runs) / self.total if self.total else 0.0

    @property
    def hit_rate(self) -> float:
        return sum(r.keyword_hit for r in self.runs) / self.total if self.total else 0.0

    @property
    def avg_steps(self) -> float:
        return sum(r.steps for r in self.runs) / self.total if self.total else 0.0

    @property
    def avg_elapsed_s(self) -> float:
        return sum(r.elapsed_s for r in self.runs) / self.total if self.total else 0.0

    @property
    def avg_evidence_sufficiency(self) -> float:
        return sum(r.evidence_sufficiency for r in self.runs) / self.total if self.total else 0.0

    def check_min_hit_rate(self, min_rate: float) -> bool:
        return self.hit_rate >= min_rate


def alert_for(mode: FaultMode) -> AlertEvent:
    return AlertEvent.model_validate({
        "alert_name": f"{mode.metric} 异常",
        "service": mode.service,
        "metric": mode.metric,
        "threshold": mode.baseline_high,
        "current_value": mode.spike_value,
    })


def keyword_hit(mode: FaultMode, root_cause: str | None) -> bool:
    if not root_cause:
        return False
    text = root_cause.lower()
    return any(kw.lower() in text for kw in mode.eval_keywords)


def _transport(settings: Settings, fake: bool) -> str:
    if fake:
        return "inline"
    if settings.metrics_backend != "mock" or settings.logs_backend != "mock":
        return "mcp"
    return "inline"


def _judge_model(settings: Settings, fake: bool):
    if fake:
        return fake_judge_model(0.85)
    from open_tam.orchestrator.llm import AgentScopeChatModel

    return AgentScopeChatModel(
        primary=settings.model_primary,
        fallback=settings.model_fallback,
        timeout=settings.model_timeout,
    )


def run_eval(
    fault_names: list[str], *, settings: Settings, runs: int = 1, fake: bool,
    model_label: str | None = None,
) -> EvalReport:
    if model_label:
        label = f"{model_label}（fake 回放）" if fake else model_label
    elif fake:
        label = "fake（脚本回放，仅验证评测链路）"
    else:
        label = settings.model_primary

    judge = None if fake else EvidenceJudge(_judge_model(settings, fake=False))
    results: list[EvalRun] = []
    for name in fault_names:
        mode = FAULT_MODES[name]
        for _ in range(runs):
            alert = alert_for(mode)
            state = FaultState()
            state.activate(name, duration_minutes=30)
            trace = TraceRecorder(alert_id=alert.alert_id, traces_dir=settings.traces_dir)
            metric_trace = TraceRecorder(
                alert_id=alert.alert_id, traces_dir=settings.traces_dir, agent="metric")
            log_trace = TraceRecorder(
                alert_id=alert.alert_id, traces_dir=settings.traces_dir, agent="log")
            k8s_trace = TraceRecorder(
                alert_id=alert.alert_id, traces_dir=settings.traces_dir, agent="k8s")
            start = time.monotonic()
            try:
                outcome, report_path = run_investigation(
                    alert, settings, fake=fake,
                    transport=_transport(settings, fake),
                    trace=trace, metric_trace=metric_trace, log_trace=log_trace,
                    k8s_trace=k8s_trace,
                    fake_fault=name if fake else None,
                )
            finally:
                state.clear(name)
            elapsed_s = time.monotonic() - start

            score = 0.0
            try:
                verdict = EvidenceJudge(
                    _judge_model(settings, fake=fake) if fake else judge
                ).judge(
                    Path(report_path).read_text(encoding="utf-8"),
                    load_trace(trace.path),
                    mode.root_cause,
                )
                score = verdict.score
            except Exception:
                score = 0.0

            results.append(EvalRun(
                fault=name,
                root_cause=outcome.root_cause,
                keyword_hit=keyword_hit(mode, outcome.root_cause),
                confidence=outcome.confidence,
                steps=len(outcome.steps),
                elapsed_s=elapsed_s,
                evidence_sufficiency=score,
            ))
    return EvalReport(model_label=label, runs=results)


def write_eval_report(report: EvalReport, reports_dir: Path) -> Path:
    reports_dir = Path(reports_dir)
    reports_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    path = reports_dir / f"eval-{ts}.md"
    lines = [
        "# open-tam 评测报告",
        "",
        f"- 模型: {report.model_label}",
        f"- 样本数: {report.total}（故障模式 × 运行次数）",
        f"- 根因定位率: {report.located_rate:.0%}",
        f"- 关键词命中率: {report.hit_rate:.0%}",
        f"- 证据充分性: {report.avg_evidence_sufficiency:.2f}",
        f"- 平均步数: {report.avg_steps:.1f}",
        f"- 平均耗时: {report.avg_elapsed_s:.1f}s",
        "",
        "| 故障 | 根因 | 命中 | 证据分 | 置信度 | 步数 | 耗时s |",
        "|---|---|---|---|---|---|---|",
    ]
    for r in report.runs:
        cause = (r.root_cause or "未定位").replace("|", "\\|").replace("\n", " ")
        mark = "✓" if r.keyword_hit else "✗"
        lines.append(
            f"| {r.fault} | {cause} | {mark} | {r.evidence_sufficiency:.2f} | {r.confidence} | {r.steps} | {r.elapsed_s:.1f} |"
        )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


def persist_eval_report(db, report: EvalReport, report_path: Path | None) -> str:
    """评测结果落 SQLite（Web 评测标签页数据源），返回 run id。"""
    from open_tam.persistence.repositories import EvalRunRecord, EvalRunRepository

    rec = EvalRunRecord(
        id=uuid4().hex[:12],
        model_label=report.model_label,
        total=report.total,
        located_rate=report.located_rate,
        hit_rate=report.hit_rate,
        avg_steps=report.avg_steps,
        avg_elapsed_s=report.avg_elapsed_s,
        avg_evidence_sufficiency=report.avg_evidence_sufficiency,
        runs=[{
            "fault": r.fault, "root_cause": r.root_cause,
            "keyword_hit": r.keyword_hit, "confidence": r.confidence,
            "steps": r.steps, "elapsed_s": r.elapsed_s,
            "evidence_sufficiency": r.evidence_sufficiency,
        } for r in report.runs],
        report_path=str(report_path) if report_path else None,
        created_at=datetime.now().isoformat(),
    )
    EvalRunRepository(db).create(rec)
    return rec.id
