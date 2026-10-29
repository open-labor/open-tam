"""The TAM Book content loader and public topic-page API."""
from __future__ import annotations

from datetime import datetime

import pytest
from httpx import ASGITransport, AsyncClient

from open_tam.auth.apikey import generate_api_key, hash_api_key
from open_tam.book import BookError, load_book
from open_tam.config import Settings
from open_tam.persistence.database import Database, reset_database
from open_tam.persistence.repositories import UserRecord, UserRepository
from open_tam.web.app import create_app


def test_book_loads_all_manuscript_sections():
    book = load_book(Settings.load().book_dir)
    index = book.index_payload()
    counts = index["counts"]
    assert counts["chapters"] == 28
    assert counts["appendices"] == 22
    assert counts["templates"] == 19
    assert counts["guides"] == 2
    assert counts["total"] == 71
    part_ids = {part["id"] for part in index["parts"]}
    assert {"guide", "part1", "part2", "part3", "part4", "part5", "part6", "appendix", "tools"} <= part_ids


def test_chapter_render_has_toc_and_full_text():
    book = load_book(Settings.load().book_dir)
    chapter = book.render("ch01-tam-origin-evolution")
    assert chapter is not None
    assert chapter.number == "第 1 章"
    assert "起源" in chapter.title
    assert chapter.toc
    assert "1.1" in chapter.html
    assert "<h1" not in chapter.html
    assert chapter.prev and chapter.prev["slug"] == "00-reading-guide"
    assert chapter.next and chapter.next["slug"] == "ch02-role-boundary-map"
    assert chapter.minutes >= 1


def test_reading_guide_and_appendix_are_pages():
    book = load_book(Settings.load().book_dir)
    guide = book.render("00-reading-guide")
    appendix = book.render("appx-a-glossary")
    assert guide is not None and "如何使用这本书" in guide.title
    assert appendix is not None and appendix.number == "附录 A"
    assert "术语" in appendix.html


def test_book_render_escapes_raw_html(tmp_path):
    manuscript = tmp_path / "manuscript"
    manuscript.mkdir()
    (manuscript / "ch99-safety.md").write_text(
        "# 第 99 章　安全测试\n\n<script>alert('xss')</script>\n\n## 小节\n\n正文。\n",
        encoding="utf-8",
    )
    book = load_book(tmp_path)
    rendered = book.render("ch99-safety")
    assert rendered is not None
    assert "<script>" not in rendered.html
    assert "&lt;script&gt;" in rendered.html


def test_book_requires_manuscript(tmp_path):
    with pytest.raises(BookError):
        load_book(tmp_path)


@pytest.fixture
def db(tmp_path):
    reset_database()
    database = Database(tmp_path / "test.db")
    database.connect()
    database.migrate()
    yield database
    database.close()
    reset_database()


async def test_book_api_requires_login_when_auth_enabled(db, tmp_path, monkeypatch):
    monkeypatch.setenv("OPEN_TAM_BASE_DIR", str(tmp_path))
    key = generate_api_key()
    UserRepository(db).create(UserRecord(
        id="u-book", username="book-reader", api_key_hash=hash_api_key(key),
        role="viewer", created_at=datetime.now().isoformat(),
        updated_at=datetime.now().isoformat(),
    ))
    app = create_app(db=db, auth_enabled=True)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as c:
        assert (await c.get("/api/book")).status_code == 401
        assert (await c.get("/api/book/ch04-ai-era-tam-redefined")).status_code == 401

        headers = {"X-API-Key": key}
        index = await c.get("/api/book", headers=headers)
        assert index.status_code == 200
        assert index.json()["counts"]["chapters"] == 28
        chapter = await c.get("/api/book/ch04-ai-era-tam-redefined", headers=headers)
        assert chapter.status_code == 200
        assert "AI" in chapter.json()["title"]
        missing = await c.get("/api/book/not-a-chapter", headers=headers)
        assert missing.status_code == 404
