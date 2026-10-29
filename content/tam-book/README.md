# TAM Book source

This directory contains the Open TAM Web UI's copy of the TAM handbook.

- `manuscript/` — 28 chapters, 22 appendices, reading guide and outline
- `templates/` — 19 reusable Markdown templates

Source: `allengaller/the-tam-book` (manuscript snapshot 2026-10-25).

To refresh:

```bash
cp the-tam-book/the-tam-book/manuscript/*.md content/tam-book/manuscript/
cp the-tam-book/the-tam-book/templates/*.md content/tam-book/templates/
```

Then restart `open-tam serve`; the `/api/book` index and every topic page are rebuilt from these files. Markdown is rendered server-side with raw HTML disabled.

Every `##` heading in a chapter, appendix or template becomes a workflow step under `/api/workflows`; the Web UI exposes these as the “实战流程” center. Do not maintain workflow steps separately or they will drift from the manuscript.
