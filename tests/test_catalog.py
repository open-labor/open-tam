"""Catalog content loading and relationship validation."""
from __future__ import annotations

import shutil

import pytest
import yaml

from open_tam.catalog import CatalogError, load_catalog
from open_tam.config import Settings


def test_repo_catalog_loads_and_enriches_faults():
    catalog = load_catalog(Settings.load().content_dir)
    assert len(catalog.modules) == 6
    assert len(catalog.skills) == 8
    assert len(catalog.cases) == 12
    assert len([case for case in catalog.cases if case.kind == "fault"]) == 8
    assert len([case for case in catalog.cases if case.kind == "reading"]) == 4

    cpu = catalog.case("cpu_spike")
    assert cpu is not None
    assert cpu.fault_name == "cpu_spike"
    assert cpu.root_cause and "正则" in cpu.root_cause
    assert cpu.threshold == 45.0
    assert cpu.keywords

    payload = catalog.api_payload()
    assert payload["modules"][0]["skill"]
    assert payload["skills"][0]["cases"]
    assert payload["cases"][0]["reading"] is False
    assert any(item["reading"] for item in payload["cases"])


def test_catalog_rejects_unknown_skill_reference(tmp_path):
    source = Settings.load().content_dir
    target = tmp_path / "content"
    shutil.copytree(source, target)
    modules = yaml.safe_load((target / "modules.yaml").read_text(encoding="utf-8"))
    modules[0]["skill_ids"] = ["missing-skill"]
    (target / "modules.yaml").write_text(
        yaml.safe_dump(modules, allow_unicode=True), encoding="utf-8")
    with pytest.raises(CatalogError):
        load_catalog(target)


def test_catalog_rejects_unknown_fault(tmp_path):
    source = Settings.load().content_dir
    target = tmp_path / "content"
    shutil.copytree(source, target)
    cases = yaml.safe_load((target / "cases.yaml").read_text(encoding="utf-8"))
    cases[0]["fault_name"] = "not-a-fault"
    (target / "cases.yaml").write_text(
        yaml.safe_dump(cases, allow_unicode=True), encoding="utf-8")
    with pytest.raises(CatalogError):
        load_catalog(target)
