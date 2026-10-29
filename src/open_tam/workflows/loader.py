"""Turn every TAM Book chapter, appendix and template into a runnable flow.

The workflow catalog is derived from the manuscript, so the book remains the
single content source. Each h2 becomes a checklist step; templates also link
back to the chapters and appendices they cite.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from open_tam.book.loader import Book, BookDocument

STAGES = [
    ("role", "定位与角色"),
    ("capability", "核心能力"),
    ("lifecycle", "工作全景"),
    ("financial", "金融级实战"),
    ("ai", "AI 时代"),
    ("growth", "度量与成长"),
    ("standards", "标准与治理"),
    ("tools", "工具箱"),
]
STAGE_ORDER = {stage_id: index for index, (stage_id, _) in enumerate(STAGES)}
STAGE_TITLE = {stage_id: title for stage_id, title in STAGES}
PART_STAGE = {
    "part1": "role",
    "part2": "capability",
    "part3": "lifecycle",
    "part4": "financial",
    "part5": "ai",
    "part6": "growth",
}
KIND_LABEL = {
    "practice": "章节实战",
    "standard": "标准落地",
    "tool": "模板工具",
}


@dataclass(frozen=True)
class WorkflowStep:
    id: str
    title: str


@dataclass(frozen=True)
class Workflow:
    id: str
    title: str
    number: str
    kind: str
    stage_id: str
    summary: str
    book_slug: str
    book_number: str
    book_title: str
    chapter_slugs: tuple[str, ...]
    steps: tuple[WorkflowStep, ...]
    minutes: int
    order: int

    @property
    def stage(self) -> str:
        return STAGE_TITLE[self.stage_id]


@dataclass
class WorkflowCatalog:
    workflows: list[Workflow] = field(default_factory=list)

    def __post_init__(self) -> None:
        self.workflows = sorted(
            self.workflows, key=lambda item: (STAGE_ORDER[item.stage_id], item.order, item.id)
        )
        self.by_id = {workflow.id: workflow for workflow in self.workflows}
        self._by_book = {}
        for workflow in self.workflows:
            self._by_book.setdefault(workflow.book_slug, []).append(workflow)

    def get(self, workflow_id: str) -> Workflow | None:
        return self.by_id.get(workflow_id)

    def for_document(self, book_slug: str) -> list[dict]:
        own = self._by_book.get(book_slug, [])
        if own and own[0].kind == "tool":
            selected = own
        else:
            related = [
                workflow for workflow in self.workflows
                if workflow.kind == "tool" and book_slug in workflow.chapter_slugs
            ]
            selected = own + related
        return [
            {
                "id": workflow.id,
                "title": workflow.title,
                "kind": workflow.kind,
                "kind_label": KIND_LABEL[workflow.kind],
                "step_count": len(workflow.steps),
                "stage": workflow.stage,
            }
            for workflow in selected
        ]

    def _workflow_summary(self, workflow: Workflow) -> dict:
        return {
            "id": workflow.id,
            "title": workflow.title,
            "number": workflow.number,
            "kind": workflow.kind,
            "kind_label": KIND_LABEL[workflow.kind],
            "stage_id": workflow.stage_id,
            "stage": workflow.stage,
            "summary": workflow.summary,
            "step_count": len(workflow.steps),
            "book_slug": workflow.book_slug,
            "minutes": workflow.minutes,
        }

    def index_payload(self) -> dict:
        stages = []
        for stage_id, title in STAGES:
            items = [workflow for workflow in self.workflows if workflow.stage_id == stage_id]
            if not items:
                continue
            stages.append({
                "id": stage_id,
                "title": title,
                "workflows": [self._workflow_summary(item) for item in items],
            })
        counts = {
            "total": len(self.workflows),
            "practice": sum(1 for item in self.workflows if item.kind == "practice"),
            "standard": sum(1 for item in self.workflows if item.kind == "standard"),
            "tool": sum(1 for item in self.workflows if item.kind == "tool"),
        }
        return {"stages": stages, "counts": counts}

    def detail_payload(self, workflow: Workflow, book: Book) -> dict:
        chapters = []
        for slug in workflow.chapter_slugs:
            document = book.document(slug)
            if document is None:
                continue
            chapters.append({
                "slug": document.slug,
                "number": document.number,
                "title": document.title,
                "kind": document.kind,
            })
        return {
            "id": workflow.id,
            "title": workflow.title,
            "number": workflow.number,
            "kind": workflow.kind,
            "kind_label": KIND_LABEL[workflow.kind],
            "stage_id": workflow.stage_id,
            "stage": workflow.stage,
            "summary": workflow.summary,
            "book_slug": workflow.book_slug,
            "book_number": workflow.book_number,
            "book_title": workflow.book_title,
            "minutes": workflow.minutes,
            "steps": [{"id": step.id, "title": step.title} for step in workflow.steps],
            "chapters": chapters,
        }


def _steps_from_document(document: BookDocument) -> tuple[WorkflowStep, ...]:
    titles = [
        match.group(1).strip().rstrip("#").strip()
        for match in re.finditer(r"^##\s+(.+?)\s*$", document.body, re.M)
    ]
    titles = [title for title in titles if title]
    if not titles:
        titles = ["阅读并完成本章自检"]
    return tuple(
        WorkflowStep(id=f"step-{index}", title=title)
        for index, title in enumerate(titles, 1)
    )


def _reference_slugs(document: BookDocument, book: Book) -> tuple[str, ...]:
    chapters = {}
    appendices = {}
    for item in book.documents:
        match = re.match(r"^ch(\d+)-", item.slug)
        if match:
            chapters[int(match.group(1))] = item.slug
        match = re.match(r"^appx-([a-z])-", item.slug)
        if match:
            appendices[match.group(1).upper()] = item.slug
    refs: list[str] = []
    for match in re.finditer(r"第\s*(\d+)\s*章", document.body):
        slug = chapters.get(int(match.group(1)))
        if slug and slug not in refs:
            refs.append(slug)
    for match in re.finditer(r"附录\s*([A-Z])", document.body):
        slug = appendices.get(match.group(1))
        if slug and slug not in refs:
            refs.append(slug)
    return tuple(refs)


def load_workflows(book: Book) -> WorkflowCatalog:
    workflows: list[Workflow] = []
    for document in book.documents:
        if document.kind == "guide":
            continue
        if document.kind == "tool":
            workflow_id = f"tool-{document.slug}"
            kind = "tool"
            stage_id = "tools"
            order = 2000 + document.order
            chapter_slugs = _reference_slugs(document, book)
        elif document.kind == "appendix":
            workflow_id = f"practice-{document.slug}"
            kind = "standard"
            stage_id = "standards"
            order = 1000 + document.order
            chapter_slugs = (document.slug,)
        else:
            workflow_id = f"practice-{document.slug}"
            kind = "practice"
            stage_id = PART_STAGE.get(document.part_id, "capability")
            order = 100 + document.order
            chapter_slugs = (document.slug,)
        workflows.append(Workflow(
            id=workflow_id,
            title=document.title,
            number=document.number,
            kind=kind,
            stage_id=stage_id,
            summary=document.summary,
            book_slug=document.slug,
            book_number=document.number,
            book_title=document.title,
            chapter_slugs=chapter_slugs,
            steps=_steps_from_document(document),
            minutes=document.minutes,
            order=order,
        ))
    return WorkflowCatalog(workflows)
