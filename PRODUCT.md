# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

FastAPI + 原生 HTML/CSS/JS 单页工作台，零前端构建链；`src/open_tam/web/static/index.html` 承载既有阅读/排查页面，`workspace.js` / `workspace.css` / `workspace-data.js` 承载 10 模块工作台与演示工作区。仓库本体为 Python（AgentScope + MCP + SQLite），CLI 与 Web 共用同一排查管线。

## Users

- 首要受众：TAM（Technical Account Manager）/ SRE 及相关岗位（运维工程师、平台工程师），以及 TAM 团队负责人 / Mentor。
- 访客/使用者应完成的动作：从今日工作台判断优先事项；在客户 360° 维护服务、风险与价值；从手册和流程执行具体动作；用排查工作台完成事件闭环；用成长与团队视图证明能力与覆盖。

## Product Purpose

open-tam 是基于 AgentScope + MCP 的多 Agent SRE 排障系统：告警进来，自动查指标、翻日志，产出结构化根因报告（结论摘要 + 异常清单 + 建议动作）；排查过程每步思考/工具调用/观察落盘为结构化语料（JSONL trace），可回流语料库沉淀 Skill。对标阿里云 SREAgent 平台能力。

核心目标（用户确认，2026-08-31）：把 TAM 的工作显性化——排查这类隐性经验变成显式、可读、可评测的资产。新 TAM 照着 trace 入职上手，老 TAM 用报告与账本梳理自己的工作，团队从中学习并沉淀最佳实践；多 Agent 排障系统是实现这一目标的机制。

## Positioning

总定位：**把 TAM 的工作显性化**（入职 / 梳理 / 最佳实践，见 Product Purpose）。支撑它的是三个相邻产品无法照抄的机制：

1. **排查即语料**——每次排查全程落盘为结构化 trace 与报告，是可评测、可复用的资产，不是一次性对话。
2. **MCP 工具总线**——query_metrics / query_logs 签名固定，mock 与真实后端（alibabacloud-observability / SLS）互换零改动。
3. **护栏前置**——命令白名单 + dry-run + 敏感操作人工确认 + 审计日志。

## Operating Context

- 交付形态：CLI（`open-tam`）+ Web 企业工作台（`open-tam serve`）；工作台默认使用演示工作区数据，服务端提供学习、流程、排查、团队、评测与审计事实源。
- 模型：DashScope Qwen（主备自动切换，默认 qwen-plus/qwen-turbo）；无 Key 演示用 FakeChatModel 闭环。
- 数据源：先 mock 后实盘（M5 接云监控 webhook + alibabacloud-observability MCP；SLS 日志）。
- 故障模式注册表（同时是评测集）：cpu_spike / slow_query / oom / connection_pool_exhausted。
- 演进路线：M0 骨架 → M1 排查闭环 → M2 多 Agent + 语料 → M3 护栏 + 巡检 → M4 Web UI → M5 实盘接入 → M6 Skill → M7 多租户/生产化 → M8 K8s（mock）→ M9 评测闭环 → M10 告警风暴/Playbook。

## Capabilities and Constraints

- 已实现（M0–M10）：告警 Webhook / CLI 注入 → ReAct 多 Agent 排查 → 指标/日志/K8s 证据 → 三段式根因报告；trace 语料、Skill 沉淀、护栏与审计、SQLite/认证/通知、告警风暴分析、Playbook、跨区域 fan-out、评测与 CI 质量门。
- Web UI（2026-10-25 重构）：企业级 IBM 风格工作台，左侧 10 模块 IA（今日工作台、任务中心、客户工作、服务执行、事件与问题、协同与经营、我的成长、团队管理、知识与工具、系统设置）；顶部客户切换器、全局搜索、快速新建、AI 助手、通知中心；保留并重组能力路径、案例库、排查工作台、排查历史、Skills、评测、手册与流程。
- 核心页面：今日工作台聚合；客户 360° 十 Tab；统一七段详情骨架；重大事件作战室；成长总览/能力雷达/证据档案；团队分配/负载/质量/认证；系统设置/审计。
- 数据边界：客户、任务、服务执行、协同、成长目标/绩效/工时是浏览器 localStorage 演示工作区；学习进度、案例尝试、流程运行、排查历史、团队、评测与审计走服务端。设置页提供重置与边界说明。
- 能力发展层（2026-10-23 P0）：模块/Skill/案例迁移到 `content/*.yaml` 并由 `/api/catalog` 输出；登录用户进度落库、案例尝试自动评分，Mentor/Admin 可查看团队进度与 Skill 覆盖；未登录仍使用 localStorage。
- TAM 手册（2026-10-25）：接入 the-tam-book 完整书稿（28 章 + 22 附录 + 19 模板），每篇都有独立专题页，支持目录搜索、TOC 与上下篇导航。
- 实战流程（2026-10-25）：从章节/附录/模板自动生成 69 个可执行流程；章节页可直接开始相关流程，运行记录支持步骤勾选、备注、状态、导出 Markdown；登录用户服务端保存，demo 本地保存。
- 术语：AlertEvent（对齐云监控告警格式）、排查闭环、故障注入（`fault inject/clear/list`）、根因命中率 / 平均步数 / token 成本（评测指标）。
- 非目标（当前）：真实 CRM/ITSM/HR 系统接入、真实 K8s 集群 / K8sGPT 二进制接入、真实修复执行（restart/rollback 仍为模拟）、组织级硬租户隔离、分布式多实例/HA、公开基准数字、多人在线协同编辑作战室。
- 评测：`eval --fake` 是链路回归，不代表模型质量；真实模型评测需要 `DASHSCOPE_API_KEY`，尚无公开商业数字，不得编造。

## Brand Commitments

- 名称：open-tam（小写，产品名保留英文）。
- 视觉承诺：企业级白底蓝色 IBM 风格工作台——`#f4f4f4` 底 / 白色面板 / IBM Blue 60 `#0f62fe`、0 圆角、1px 细线、8px 紧凑网格、自托管 IBM Plex Sans/Mono；不使用暗色 Ops Console 或装饰性渐变。

## Evidence on Hand

- README.md 快速开始（uv sync / pytest / 无 Key 演示 / DashScope 真实模型）。
- docs/architecture.md 架构一页纸（mermaid 图、mock→实盘替换路径表、演进路线）。
- docs/superpowers/specs/2026-08-28-sre-agent-design.md 设计文档（已确认）。
- M1 真实模型验收通过（DashScope qwen-plus 排查闭环）；M2–M10 已实现，测试与 CI 质量门见 README；真实云端 / 真实 K8s / 真实修复执行仍是当前限制。
- demo_app/：被诊断对象 FastAPI 应用（/health /metrics /faults）。
- 无真实客户、无基准测试数字、无现成截图资产——页面演示数据可由仓库事实合成并标注为演示；不得虚构商业主张。

## Product Principles

1. 排查即语料：排查过程本身是资产（trace → 语料库 → Skill）。
2. 大脑与手脚分离：编排层只推理，数据获取全走 MCP。
3. 护栏前置：白名单 + dry-run + 人工确认 + 审计，先于自主性。
4. mock 先行、实盘可换：固定签名让 mock 与真实后端互换零改动。

## Accessibility & Inclusion

- 未确认特殊需求；按 WCAG AA 常规执行（对比度、键盘可达、语义化标签）。

## Open decisions

- CTA 目标链接（GitHub 仓库 URL / 演示入口）未确认：页面上用占位，交付时列入替换清单。
- 域名/部署目标未确认（静态托管即可）。
