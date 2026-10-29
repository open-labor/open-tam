"""Versioned TAM capability content: modules, skills and cases.

Content lives in YAML so curriculum changes can be reviewed like code. The
loader validates references and enriches fault cases from the fault registry,
so a case never drifts from the injectable fault it practices.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator

from open_tam.faults import FAULT_MODES


class CatalogError(ValueError):
    pass


class Module(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    order: int
    title: str
    level: str
    time: str
    goal: str
    points: list[str] = Field(default_factory=list)
    practice: str
    practice_label: str
    skill_ids: list[str] = Field(default_factory=list)


class Skill(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    order: int
    name: str
    category: str
    level: str
    description: str
    when_to_use: str = ""
    case_ids: list[str] = Field(default_factory=list)


class Case(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    order: int
    title: str
    kind: Literal["fault", "reading"] = "fault"
    fault_name: str | None = None
    category: str
    level: str
    tags: list[str] = Field(default_factory=list)
    objective: str
    steps: list[str] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)
    summary: str | None = None
    log_signature: str = ""
    root_cause: str | None = None
    remediation: str | None = None
    service: str | None = None
    metric: str | None = None
    alert_name: str | None = None
    threshold: float | None = None
    current_value: float | None = None
    skill_ids: list[str] = Field(default_factory=list)
    synthetic: bool = False
    keywords: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_kind_fields(self) -> Case:
        if self.kind == "fault" and not self.fault_name:
            raise ValueError(f"fault case {self.id!r} must declare fault_name")
        if self.kind == "reading" and (not self.root_cause or not self.remediation):
            raise ValueError(
                f"reading case {self.id!r} must declare root_cause and remediation")
        return self


@dataclass(frozen=True)
class Catalog:
    modules: list[Module]
    skills: list[Skill]
    cases: list[Case]

    def module(self, module_id: str) -> Module | None:
        return next((item for item in self.modules if item.id == module_id), None)

    def skill(self, skill_id: str) -> Skill | None:
        return next((item for item in self.skills if item.id == skill_id), None)

    def case(self, case_id: str) -> Case | None:
        return next((item for item in self.cases if item.id == case_id), None)

    def api_payload(self) -> dict:
        skill_names = {skill.id: skill.name for skill in self.skills}
        return {
            "modules": [
                {
                    "id": item.id,
                    "order": item.order,
                    "title": item.title,
                    "level": item.level,
                    "time": item.time,
                    "goal": item.goal,
                    "points": item.points,
                    "practice": item.practice,
                    "practice_label": item.practice_label,
                    "skill_ids": item.skill_ids,
                    "skill": skill_names.get(item.skill_ids[0], "") if item.skill_ids else "",
                }
                for item in sorted(self.modules, key=lambda x: (x.order, x.id))
            ],
            "skills": [
                {
                    "id": item.id,
                    "order": item.order,
                    "name": item.name,
                    "category": item.category,
                    "level": item.level,
                    "desc": item.description,
                    "description": item.description,
                    "when": item.when_to_use,
                    "cases": item.case_ids,
                    "case_ids": item.case_ids,
                }
                for item in sorted(self.skills, key=lambda x: (x.order, x.id))
            ],
            "cases": [
                {
                    "id": item.id,
                    "name": item.id,
                    "order": item.order,
                    "title": item.title,
                    "kind": item.kind,
                    "reading": item.kind == "reading",
                    "synthetic": item.synthetic,
                    "fault_name": item.fault_name,
                    "category": item.category,
                    "level": item.level,
                    "tags": item.tags,
                    "objective": item.objective,
                    "steps": item.steps,
                    "extraEvidence": item.evidence,
                    "evidence": item.evidence,
                    "anomaly_desc": item.summary or "",
                    "summary": item.summary or "",
                    "log_signature": item.log_signature,
                    "root_cause": item.root_cause or "",
                    "remediation": item.remediation or "",
                    "service": item.service or "",
                    "metric": item.metric or "",
                    "alert_name": item.alert_name or (f"{item.fault_name} 告警" if item.fault_name else item.title),
                    "threshold": item.threshold,
                    "current_value": item.current_value,
                    "skill_ids": item.skill_ids,
                    "keywords": item.keywords,
                }
                for item in sorted(self.cases, key=lambda x: (x.order, x.id))
            ],
        }


def _read_yaml(path: Path) -> object:
    if not path.exists():
        raise CatalogError(f"content file missing: {path}")
    try:
        return yaml.safe_load(path.read_text(encoding="utf-8"))
    except yaml.YAMLError as exc:
        raise CatalogError(f"invalid YAML in {path}: {exc}") from exc


def _require_list(path: Path, data: object) -> list[dict]:
    if not isinstance(data, list):
        raise CatalogError(f"{path} must contain a YAML list")
    return data


def _enrich_fault_cases(cases: list[Case]) -> list[Case]:
    enriched: list[Case] = []
    for case in cases:
        if case.kind == "reading":
            enriched.append(case)
            continue
        mode = FAULT_MODES.get(case.fault_name or "")
        if mode is None:
            raise CatalogError(
                f"case {case.id!r} references unknown fault: {case.fault_name!r}")
        enriched.append(case.model_copy(update={
            "summary": case.summary or mode.anomaly_desc,
            "log_signature": case.log_signature or mode.log_signature,
            "root_cause": case.root_cause or mode.root_cause,
            "remediation": case.remediation or mode.remediation,
            "service": case.service or mode.service,
            "metric": case.metric or mode.metric,
            "alert_name": case.alert_name or f"{mode.name} 告警",
            "threshold": mode.baseline_high if case.threshold is None else case.threshold,
            "current_value": mode.spike_value if case.current_value is None else case.current_value,
            "keywords": case.keywords or list(mode.eval_keywords),
        }))
    return enriched


def _validate_relationships(modules: list[Module], skills: list[Skill], cases: list[Case]) -> None:
    module_ids = [item.id for item in modules]
    skill_ids = [item.id for item in skills]
    case_ids = [item.id for item in cases]
    for label, ids in (("module", module_ids), ("skill", skill_ids), ("case", case_ids)):
        duplicates = sorted({item for item in ids if ids.count(item) > 1})
        if duplicates:
            raise CatalogError(f"duplicate {label} ids: {duplicates}")
    known_skills = set(skill_ids)
    known_cases = set(case_ids)
    for module in modules:
        missing = sorted(set(module.skill_ids) - known_skills)
        if missing:
            raise CatalogError(f"module {module.id!r} references unknown skills: {missing}")
    for skill in skills:
        missing = sorted(set(skill.case_ids) - known_cases)
        if missing:
            raise CatalogError(f"skill {skill.id!r} references unknown cases: {missing}")
    for case in cases:
        missing = sorted(set(case.skill_ids) - known_skills)
        if missing:
            raise CatalogError(f"case {case.id!r} references unknown skills: {missing}")


def load_catalog(content_dir: str | Path) -> Catalog:
    """Load and validate the capability curriculum from a content directory."""
    content_dir = Path(content_dir)
    modules = [
        Module.model_validate(item)
        for item in _require_list(content_dir / "modules.yaml",
                                  _read_yaml(content_dir / "modules.yaml"))
    ]
    skills = [
        Skill.model_validate(item)
        for item in _require_list(content_dir / "skills.yaml",
                                  _read_yaml(content_dir / "skills.yaml"))
    ]
    cases = [
        Case.model_validate(item)
        for item in _require_list(content_dir / "cases.yaml",
                                  _read_yaml(content_dir / "cases.yaml"))
    ]
    cases = _enrich_fault_cases(cases)
    _validate_relationships(modules, skills, cases)
    return Catalog(modules=modules, skills=skills, cases=cases)
