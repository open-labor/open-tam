"""The TAM Book content loader.

The manuscript is Markdown authored in `the-tam-book`. Every chapter,
appendix and template gets a stable slug and a server-rendered topic page.
Raw HTML is escaped so the public book API cannot inject markup.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from pathlib import Path

from markdown_it import MarkdownIt


class BookError(ValueError):
    pass


PARTS = [
    ("guide", "导读", "如何使用这本书"),
    ("part1", "第一部分", "定位篇：TAM 是谁"),
    ("part2", "第二部分", "内涵篇：TAM 核心能力模型"),
    ("part3", "第三部分", "外延篇：工作全景与生态协同"),
    ("part4", "第四部分", "金融级实战篇：顶级大项目落地"),
    ("part5", "第五部分", "AI 变革篇：AI 时代的新课题"),
    ("part6", "第六部分", "度量与成长篇"),
    ("appendix", "附录", "术语、流程、标准与工具"),
    ("tools", "第七部分", "开源工具箱（模板与清单库）"),
]
PART_ORDER = {part_id: index for index, (part_id, _, _) in enumerate(PARTS)}
PART_INDEX = {part_id: (title, subtitle) for part_id, title, subtitle in PARTS}


@dataclass(frozen=True)
class BookDocument:
    slug: str
    number: str
    title: str
    kind: str  # guide | chapter | appendix | tool
    part_id: str
    order: int
    summary: str
    minutes: int
    body: str
    source: str


@dataclass
class BookPart:
    id: str
    title: str
    subtitle: str
    documents: list[BookDocument] = field(default_factory=list)


@dataclass(frozen=True)
class RenderedDocument:
    slug: str
    number: str
    title: str
    kind: str
    part_id: str
    part_title: str
    part_subtitle: str
    summary: str
    minutes: int
    html: str
    toc: list[dict]
    prev: dict | None
    next: dict | None


def _plain(text: str) -> str:
    text = re.sub(r"`([^`]*)`", r"\1", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"^[>\-\s]+", "", text)
    return re.sub(r"\s+", " ", text).strip()


def _summary(body: str) -> str:
    lines = body.splitlines()
    quote: list[str] = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith(">"):
            quote.append(re.sub(r"^>\s?", "", stripped))
        elif quote:
            break
    if quote:
        text = _plain(" ".join(quote))
    else:
        text = ""
        for line in lines:
            stripped = line.strip()
            if not stripped or stripped.startswith(("#", "|", "-", "*", "---", "```")):
                continue
            text = _plain(stripped)
            break
    return text[:190]


def _strip_leading_quote(body: str) -> str:
    lines = body.splitlines()
    out: list[str] = []
    in_quote = False
    started = False
    for line in lines:
        stripped = line.strip()
        if not started and not stripped:
            continue
        if not started and stripped.startswith(">"):
            in_quote = True
            started = True
            continue
        if in_quote:
            if stripped.startswith(">"):
                continue
            if not stripped:
                continue
            in_quote = False
        started = True
        out.append(line)
    return "\n".join(out)


def _parse_title(raw: str) -> tuple[str, str]:
    lines = raw.splitlines()
    for index, line in enumerate(lines):
        if line.startswith("# "):
            title = line[2:].strip()
            return title, "\n".join(lines[:index] + lines[index + 1:])
    return "", raw


def _document_from_file(path: Path, kind_hint: str) -> BookDocument:
    raw = path.read_text(encoding="utf-8")
    if not raw.strip():
        raise BookError(f"empty book document: {path}")
    title, body = _parse_title(raw)
    stem = path.stem
    if kind_hint == "template":
        match = re.match(r"^(\d+)", stem)
        if not match:
            raise BookError(f"template filename needs a number: {path.name}")
        number = f"模板 {int(match.group(1)):02d}"
        kind = "tool"
        part_id = "tools"
        order = 200 + int(match.group(1))
        short_title = re.sub(r"^模板\s*\d+\s*[　 ]*", "", title) or title
    elif stem.startswith("ch"):
        match = re.match(r"^ch(\d+)", stem)
        if not match:
            raise BookError(f"chapter filename needs a number: {path.name}")
        chapter_no = int(match.group(1))
        number = f"第 {chapter_no} 章"
        kind = "chapter"
        part_id = (
            "part1" if chapter_no <= 4 else
            "part2" if chapter_no <= 10 else
            "part3" if chapter_no <= 15 else
            "part4" if chapter_no <= 20 else
            "part5" if chapter_no <= 25 else
            "part6"
        )
        order = 10 + chapter_no
        short_title = re.sub(r"^第\s*\d+\s*章\s*[　 ]*", "", title) or title
    elif stem.startswith("appx-"):
        match = re.match(r"^appx-([a-z])", stem)
        if not match:
            raise BookError(f"appendix filename needs a letter: {path.name}")
        letter = match.group(1).upper()
        number = f"附录 {letter}"
        kind = "appendix"
        part_id = "appendix"
        order = 100 + (ord(letter) - ord("A"))
        short_title = re.sub(r"^附录\s*[A-Z]\s*[　 ]*", "", title) or title
    elif stem == "00-reading-guide":
        number = "导读"
        kind = "guide"
        part_id = "guide"
        order = 1
        short_title = re.sub(r"^导读[：:]\s*", "", title) or title
    elif stem == "00-outline":
        number = "总目录"
        kind = "guide"
        part_id = "guide"
        order = 0
        short_title = "总体目录"
    else:
        raise BookError(f"unrecognized book document: {path.name}")

    plain_body = re.sub(r"\s+", "", body)
    minutes = max(1, math.ceil(len(plain_body) / 500))
    summary = _summary(body)
    body = _strip_leading_quote(body)
    return BookDocument(
        slug=stem,
        number=number,
        title=short_title,
        kind=kind,
        part_id=part_id,
        order=order,
        summary=summary,
        minutes=minutes,
        body=body,
        source=str(path),
    )


def _render_body(body: str) -> tuple[str, list[dict]]:
    md = MarkdownIt("commonmark", {
        "html": False,
        "linkify": False,
        "typographer": False,
    })
    md.enable("table")
    tokens = md.parse(body)
    toc: list[dict] = []
    heading_index = 0
    for index, token in enumerate(tokens):
        if token.type != "heading_open" or token.tag not in ("h2", "h3"):
            continue
        inline = tokens[index + 1] if index + 1 < len(tokens) else None
        if inline is None:
            continue
        heading_index += 1
        anchor = f"sec-{heading_index}"
        text = "".join(
            child.content for child in (inline.children or [])
            if child.type in ("text", "code_inline")
        ) or inline.content
        token.attrSet("id", anchor)
        toc.append({"id": anchor, "text": _plain(text), "level": int(token.tag[1])})
    html = md.renderer.render(tokens, md.options, {})
    html = re.sub(
        r'<a href="(https?://[^"]+)"',
        r'<a href="\1" target="_blank" rel="noopener noreferrer"',
        html,
    )
    # Render GFM-style task list markers as real disabled checkboxes.
    html = re.sub(r"<li>\[ \]\s*", '<li class="task"><input type="checkbox" disabled> ', html)
    html = re.sub(r"<li>\[[xX]\]\s*", '<li class="task"><input type="checkbox" checked disabled> ', html)
    return html, toc


class Book:
    def __init__(self, documents: list[BookDocument]) -> None:
        self.documents = sorted(documents, key=lambda item: (item.order, item.slug))
        self.by_slug = {document.slug: document for document in self.documents}
        if len(self.by_slug) != len(self.documents):
            raise BookError("duplicate book slugs")
        self._cache: dict[str, RenderedDocument] = {}
        self._ordered = self.documents
        self._prev: dict[str, str | None] = {}
        self._next: dict[str, str | None] = {}
        for index, document in enumerate(self._ordered):
            self._prev[document.slug] = self._ordered[index - 1].slug if index else None
            self._next[document.slug] = (
                self._ordered[index + 1].slug if index + 1 < len(self._ordered) else None
            )

    def document(self, slug: str) -> BookDocument | None:
        return self.by_slug.get(slug)

    def _doc_summary(self, document: BookDocument) -> dict | None:
        if not document:
            return None
        return {
            "slug": document.slug,
            "number": document.number,
            "title": document.title,
        }

    def render(self, slug: str) -> RenderedDocument | None:
        document = self.by_slug.get(slug)
        if document is None:
            return None
        if slug in self._cache:
            return self._cache[slug]
        html, toc = _render_body(document.body)
        part_title, part_subtitle = PART_INDEX[document.part_id]
        rendered = RenderedDocument(
            slug=document.slug,
            number=document.number,
            title=document.title,
            kind=document.kind,
            part_id=document.part_id,
            part_title=part_title,
            part_subtitle=part_subtitle,
            summary=document.summary,
            minutes=document.minutes,
            html=html,
            toc=toc,
            prev=self._doc_summary(self.by_slug.get(self._prev[slug] or "")),
            next=self._doc_summary(self.by_slug.get(self._next[slug] or "")),
        )
        self._cache[slug] = rendered
        return rendered

    def index_payload(self) -> dict:
        parts: list[dict] = []
        for part_id, title, subtitle in PARTS:
            documents = [item for item in self.documents if item.part_id == part_id]
            if not documents:
                continue
            parts.append({
                "id": part_id,
                "title": title,
                "subtitle": subtitle,
                "documents": [
                    {
                        "slug": item.slug,
                        "number": item.number,
                        "title": item.title,
                        "kind": item.kind,
                        "summary": item.summary,
                        "minutes": item.minutes,
                    }
                    for item in documents
                ],
            })
        counts = {
            "chapters": sum(1 for item in self.documents if item.kind == "chapter"),
            "appendices": sum(1 for item in self.documents if item.kind == "appendix"),
            "templates": sum(1 for item in self.documents if item.kind == "tool"),
            "guides": sum(1 for item in self.documents if item.kind == "guide"),
        }
        counts["total"] = len(self.documents)
        return {
            "source": "the-tam-book",
            "counts": counts,
            "parts": parts,
        }


def load_book(book_dir: str | Path) -> Book:
    book_dir = Path(book_dir)
    manuscript_dir = book_dir / "manuscript"
    if not manuscript_dir.exists():
        raise BookError(f"book manuscript directory missing: {manuscript_dir}")
    documents = [
        _document_from_file(path, "manuscript")
        for path in sorted(manuscript_dir.glob("*.md"))
    ]
    templates_dir = book_dir / "templates"
    if templates_dir.exists():
        documents.extend(
            _document_from_file(path, "template")
            for path in sorted(templates_dir.glob("*.md"))
        )
    if not documents:
        raise BookError(f"no book documents found in {book_dir}")
    return Book(documents)
