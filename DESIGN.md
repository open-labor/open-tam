---
name: Open TAM Enterprise Workspace
description: IBM-inspired light TAM operating console — white surfaces, blue actions, hairline structure, compact density, and a 10-module information architecture.
colors:
  bg: "#f4f4f4"
  surface: "#ffffff"
  surface-muted: "#fafafa"
  border: "#e0e0e0"
  border-strong: "#8d8d8d"
  text: "#161616"
  text-2: "#525252"
  text-3: "#6f6f6f"
  blue-60: "#0f62fe"
  blue-70: "#0043ce"
  blue-10: "#edf5ff"
  blue-20: "#a6c8ff"
  green: "#24a148"
  green-10: "#defbe6"
  green-20: "#a7f0ba"
  green-70: "#0e6027"
  yellow: "#f1c21b"
  yellow-10: "#fcf4d6"
  yellow-5: "#fff8e1"
  yellow-70: "#684e00"
  warn-ink: "#8e6a00"
  red: "#da1e28"
  red-10: "#fff1f1"
  red-20: "#ffb3b8"
  red-70: "#a2191f"
  neutral-soft: "#e8e8e8"
  quote-rule: "#c6c6c6"
  overlay: "rgba(22,22,22,.5)"
  overlay-strong: "rgba(11,16,22,.86)"
  shadow: "rgba(0,0,0,.18)"
  shadow-soft: "rgba(0,0,0,.16)"
  shadow-strong: "rgba(0,0,0,.2)"
  green-border: "rgba(52,211,153,.35)"
  yellow-border: "rgba(251,191,36,.35)"
  blue-border: "rgba(56,189,248,.35)"
  agent-k8s: "#A78BFA"
  scrollbar-hover: "#3B5270"
  brand-ink: "#06131D"
  red-border: "rgba(248,113,113,.5)"
typography:
  sans: "IBM Plex Sans, Helvetica Neue, PingFang SC, Microsoft YaHei, Arial, sans-serif"
  mono: "IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
  page-title: "18–22px / 600"
  section-title: "12.5–13px / 600"
  body: "11.5–12.5px / 1.5"
  meta: "8.5–10px mono / uppercase when it labels a system value"
layout:
  rail: "264px, sticky, independently scrollable, environment footer pinned"
  topbar: "56px, sticky, 3px blue top rule"
  content: "max 1500px, 12-column grid, 12px gap"
  density: "8px base grid; 8–13px panel padding; compact tables"
  breakpoints:
    - "1120px: detail/aside collapses"
    - "960px: rail becomes off-canvas drawer"
    - "760px: KPI 2-up, grids single column, topbar labels collapse"
radius: "0px on structural surfaces; circular only for status dots"
motion: "150–180ms background/border/transform; no decorative animation; reduced-motion honored"
---

# Design System: Open TAM Enterprise Workspace

## Overview

**Creative North Star: "TAM Operating Console"** · updated 2026-10-25

The product is a TAM's working surface, not a marketing page. It borrows IBM Carbon's discipline: white panels on a light grey ground, a single blue action color, square corners, 1px hairlines, compact type, and mono for anything the system produced. Visual hierarchy comes from layout, spacing, and weight — not from decoration.

The information architecture is the product. Ten first-level modules (今日工作台, 任务中心, 客户工作, 服务执行, 事件与问题, 协同与经营, 我的成长, 团队管理, 知识与工具, 系统设置) contain the full TAM operating model. Only the active module expands by default; favorites and the current module stay reachable. Existing open-tam capabilities — investigation workbench, history, RCA, cases, handbook, 69 workflows, skills, evals, team — are embedded under this model rather than exposed as a parallel menu.

**Data modes:** learning progress, case attempts, workflow runs, investigations, team and evals are server-backed. Customer, task, service-execution, collaboration, growth-goal, performance and time records form a documented demo workspace in `localStorage`. The UI never presents the demo workspace as live CRM/ITSM data; settings states the boundary and offers a reset.

## Colors

All colors are tokens in `:root`; components never hardcode theme colors.

- **bg `#f4f4f4` / surface `#ffffff`** — page ground and panels. White is the normal working surface; grey is inset/active/secondary.
- **border `#e0e0e0` / border-strong `#8d8d8d`** — all structure is a 1px hairline. Strong borders only on inputs, primary outlines and the rail edge.
- **text `#161616` / text-2 `#525252` / text-3 `#6f6f6f`** — primary, body, metadata.
- **blue-60 `#0f62fe` / blue-70 `#0043ce` / blue-10 `#edf5ff`** — links, active navigation, focus, primary actions, selected rows. Blue is the only action color.
- **green / yellow / red** — semantic status only: success or closed, warning or in-progress, critical or overdue. Never decorative.
- **RAG tints** (`#defbe6`, `#fcf4d6`, `#fff1f1`) — status chips and health signals, always paired with a text label and a dot/shape.
- **Tonal ramp and legacy aliases** (`green-70`, `red-70`, `blue-20`, `yellow-5`, `warn-ink`, `neutral-soft`, `quote-rule`, `overlay*`, `shadow*`, `agent-k8s`) — used by the pre-refactor inline components for status text, K8s agent labels, overlays and shadows. They are documented compatibility aliases, not new palette entries; new components should use the core tokens above.

**The Action-Is-Blue Rule.** Primary buttons, active nav and selected context use blue. Red is reserved for critical status, destructive confirmation and overdue signals.

**The Hairline Rule.** Separation is a 1px border or background shift, not a shadow. Modal/drawer may use one soft shadow because they float above the page.

## Typography

**Sans:** IBM Plex Sans (Latin, self-hosted WOFF2) with PingFang SC / Microsoft YaHei for Chinese. **Mono:** IBM Plex Mono for IDs, timestamps, counts, sources, system labels and code.

- **Page title** 18–22px/600; one per page, paired with a one-line purpose in text-2.
- **Section/panel title** 12.5–13px/600. Panel meta is 8.5–9px mono uppercase in text-3.
- **Body** 11.5–12.5px/1.5. Dense but readable; long-form handbook text uses 13.5px/1.7 inside the book reader.
- **KPI value** 22px mono; label 10px; sub 9.5px. Numbers are tabular.
- **Chinese text never uses letter-spacing.** Mono uppercase tracking applies to Latin system labels only.

**The Readout Rule.** IDs, timestamps, counts, source types, environment flags and audit values are mono. Business copy is sans.

**The No-Redundant-Label Rule.** Do not repeat the page title in the page body. Do not add helper copy that the layout already explains. Avoid secondary labels unless they change a decision.

## Layout

**Shell:** fixed 264px rail on desktop; sticky 56px topbar with a 3px blue top rule; compact context strip; content area with a 1500px cap and 12-column grid. The rail scrolls independently so the environment footer never overlaps navigation.

**Navigation:** 10 module headers with a single-character code, chevron, and collapsible children. Only the active module and 今日工作台 open by default. Favorites appear above modules. Manager-only 团队管理 is hidden for operators/viewers. A nav badge appears only when a count needs action (overdue tasks, active incidents, pending reviews).

**Topbar:** global customer switcher, global search (⌘K), quick create, AI assistant, notification center, user. Page title/sub remain on the left. On mobile the customer name and secondary labels collapse; the page title never clips.

**Grids:** KPI strip 4-up desktop, 2-up tablet/mobile. Dashboards use 7/5 or 6/6 splits; detail pages use `minmax(0,1fr) 300px` with a sticky aside. Tables scroll horizontally rather than crushing columns.

**Density:** 8px base. Panel padding 12–14px; row padding 6–8px; table cell 7px 10px; nav item 28–34px height. The workbench is compact by design; the book reader is the one generous reading surface.

## Components

### Navigation rail
White ground, 1px right border, blue active bar. Group header: 17px code box, 12px/600 label, chevron. Child item: 28px height, 37px left padding; nested lifecycle children indent to 49px. Active: blue-10 fill, blue text, 3px blue left rule. Favorites use the same item shape under a small mono heading.

### Topbar actions
30px text buttons with a mono glyph box; transparent until hover, 1px border on hover, blue fill for the primary “新建”. Customer switcher shows the active customer name; the context strip always mirrors it. Notifications carry a red count only when actionable.

### Page header
Title + one-line purpose + actions + a favorite control. No eyebrow unless it identifies the object type in a detail view. Customer detail uses a dedicated header instead (name, industry, stage, owner, next node, renewal, ARR, top risk, health score, actions).

### KPI strip
One bordered white strip, 4 cells separated by hairlines. Label above, mono value, one short sub-line. Critical values use red; warning values amber; normal values black. No icons.

### Panels and lists
White panel, 1px border, 12–13px padding. Panel head: 12.5px title, mono meta, optional link. Rows are separated by hairlines; clickable rows are keyboard-focusable and act as links. Row title 12px/500, sub 10px text-3, meta 9px mono.

### Tables
Header in grey with mono uppercase labels; rows 11.5px; no zebra striping. Numeric columns right-aligned. Rows are links with Enter/Space support. Minimum table width 640px; horizontal scrolling is expected on small screens.

### Status
Square chips with 16–18px line-height, 8.5px mono text, RAG tint. Status always has a text label; color is never the only signal. Priority P1/P2/P3 uses mono text with red/amber/grey.

### Customer 360°
Header with identity and facts; 10 tabs (总览, 生命周期, 服务与权益, 技术与资产, 风险与事件, 采纳与价值, 关系与协同, 经营信号, 时间与决策记录, 档案与交接). Tabs scroll horizontally without a visible scrollbar. Each tab answers one question; the 总览 tab is not a dump of every field. Risks/events/signals are customer-filtered views; their authoritative ledgers remain in service execution, incidents and collaboration.

### Unified detail skeleton
Every business object (task, service record, collaboration record, event) uses the same seven sections: 基本信息 → 当前结论 → 执行内容 → 协作信息 → 关联对象 → 时间线 → 关闭标准. The aside holds actions and record metadata. This consistency is more important than bespoke layouts per object.

### War room
The live incident surface. A distinct banner (red left rule) sits above the existing investigation workbench: incident name, customer, commander, next communication, links to event detail / RCA template / major-incidents ledger. The war room is temporary; it does not become a permanent ledger. When active it is pinned in the nav and on the home dashboard.

### Handbook and workflow reader
Server-rendered Markdown on white; 13.5px/1.7 body; sticky 220px TOC; 1px table borders; code/tables scroll within the article. Chapter pages expose related executable workflows. The workflow reader uses checklists, notes, auto-save and Markdown export; it is a work surface, not a document viewer.

### Overlays
- **Search palette:** centered 620px, full-width input, grouped results, keyboard Enter opens the first result.
- **Quick create:** anchored menu with mono shortcut keys.
- **AI assistant:** right drawer; context summary, rule-based actions and an input. It is labelled 本地上下文助手 and never implies an ungrounded model call.
- **Notifications:** right drawer; each item is a route to the source object.
- **Modal:** 520px default, 3px blue top rule, title, form, footer actions.

### Forms
Label 8.5px mono uppercase in text-3; controls 1px border-strong, square, 12px text. Focus is a 2px blue inset outline. Errors appear as a toast or inline text, never as color alone.

## Motion

Transitions are functional: 150–180ms for background, border, drawer transform. No entrance animations, parallax or decorative pulsing. `prefers-reduced-motion` removes transitions. Loading uses a simple text empty state, not spinners.

## Accessibility

- Every interactive row supports keyboard focus, Enter and Space.
- Nav group headers expose `aria-expanded`; nav items use `aria-current="page"`.
- Tabs expose `role="tablist"` / `role="tab"` and `aria-selected`.
- Modals/drawers expose `role="dialog"`, `aria-modal` and an accessible label.
- Focus-visible is a 2px blue outline with offset.
- Mobile navigation is a drawer with backdrop and inert background; the page title remains visible at 390px.
- Color is never the only carrier of status; chips include text.

## Do's and Don'ts

### Do
- Use the 10-module IA and put every new capability under an existing module rather than adding a parallel top-level menu.
- Use the unified detail skeleton for new business objects.
- Keep authoritative data in its owning module; customer views are filtered projections.
- Use blue for action, RAG only for status, and hairlines for structure.
- Keep the active module expanded and the rail independently scrollable.
- Show real server-backed evidence for learning, investigations, workflows, team and evals.
- Mark demo-workspace boundaries in settings and reset affordances.
- Verify at 1440px, 960px and 390px, including zero horizontal overflow.

### Don't
- Don't reintroduce a dark ops-console theme, gradients, glass, rounded cards or decorative shadows.
- Don't stack every customer field on the 总览 tab.
- Don't repeat the page title or add explanatory subtitles that the layout already conveys.
- Don't hide sensitive access behind menu visibility alone; enforce it server-side.
- Don't create a permanent “war room” ledger; the war room is an incident state.
- Don't claim fake evaluation or demo workspace data represents production behavior.
