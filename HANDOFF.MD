# HANDOFF

执行新任务前先读本文件；踩过的坑在「记录」末尾追加，不要覆盖历史条目。

## 记录

### 2026-10-23 macOS 系统代理导致 real-uvicorn 测试 502
- 现象：`test_web_confirm.py` 的 ASGI 真实端口用例返回 502，但 uvicorn 日志里没有收到请求。
- 触发条件：macOS 配置了系统代理（本机 127.0.0.1:7897）。
- 原因：httpx 读取系统代理，连 loopback 请求也被转发，代理返回 502；并非应用代码错误。
- 处理方式：`tests/conftest.py` 设置 `NO_PROXY=127.0.0.1,localhost`；该用例 AsyncClient 加 `trust_env=False`。
- 如何避免：本地直连测试必须绕过代理；手动写 httpx 脚本时同样处理。

### 2026-10-23 Aliyun 后端“配置了但没生效”
- 现象：设置 `OPEN_TAM_METRICS_BACKEND=aliyun` 后仍查 mock；真实 CMS/SLS 也静默返回空数据。
- 触发条件：走 CLI/Web/巡检主链路，或只设置 `OPEN_TAM_ALIYUN_*`。
- 原因：`McpStdioBackend()` 构造时未传 Settings；MCP 子进程只读 `ALIYUN_*`；云 SDK 不在依赖里；缺配置时 fail-open。
- 处理方式：Settings 显式注入 backend/env overrides；`Settings.aliyun_env()` 统一变量；pyproject 增加 `aliyun` extras；缺 SDK/凭证抛错。
- 如何避免：新增配置项必须同时接主链路、子进程环境与测试；禁止用零值/空数组掩盖配置错误。

### 2026-10-23 K8s MCP 不是真正的 MCP
- 现象：`McpStdioBackend` 调用 K8s 工具在 initialize 阶段失败（InitializeResult 字段缺失）。
- 触发条件：`--transport mcp` 且工具路由到 `k8s_server`。
- 原因：旧实现手写 JSON-RPC 循环，只处理 tools/list 与 tools/call，不符合 MCP 协议；inline 后端也未实现 K8s 工具。
- 处理方式：K8s server 改为 FastMCP；InlineBackend 增加 4 个 K8s 工具；新增协议级 roundtrip 测试。
- 如何避免：新增 MCP server 必须用 FastMCP，并测试 `initialize → tools/list → tools/call` 全链路。

### 2026-10-23 两套排查管线导致评测失真
- 现象：eval 显示 100% 命中，但测的是旧版 `open_tam/investigation.py`，与 CLI/Web 生产管线不同。
- 触发条件：运行 `open-tam eval`。
- 原因：历史上保留了旧管线；fake 故事硬编码为 CPU；EvidenceJudge 从未被 eval 调用。
- 处理方式：删除旧管线，eval 直接调用 `orchestrator/investigate.py`；fake 按故障模式回放；Judge 接入并产生非零证据分；CI 加入 fake 质量门。
- 如何避免：评测必须走生产入口；fake 只能验证链路，不能对外宣称模型效果。

### 2026-10-23 外部 ID 直接拼文件名导致路径穿越
- 现象：`alert_id="../escape"` 可在目标目录外写 trace/report；`skill delete ../victim` 可删除目录外文件。
- 触发条件：Webhook/Web 告警或 Skill 删除接口接收外部 ID。
- 原因：`TraceRecorder`、`save_report`、`SkillLoader.delete` 直接拼接路径。
- 处理方式：新增 `open_tam/paths.py`，统一 `safe_alert_id` / `valid_skill_id` / `resolve_within`；补安全回归测试。
- 如何避免：任何外部字符串进入文件路径前必须校验或哈希。

### 2026-10-23 Headless Chrome 最小宽度导致移动端“白屏/裁切”误判
- 现象：`--window-size=390,844` 截图右侧被裁，误以为 CSS 横向溢出。
- 触发条件：Chrome headless 的新 headless 模式有约 500px 的最小窗口宽度，`innerWidth` 实际为 500。
- 原因：截图宽度与真实 viewport 不一致，不是布局问题。
- 处理方式：用 CDP `Emulation.setDeviceMetricsOverride` 设置 390×844，再断言 `scrollWidth === innerWidth` 并截图。
- 如何避免：移动端验收必须用设备模拟，不要只信 `--window-size`。

### 2026-10-25 实战流程由书稿自动生成
- 目标：书里的概念不能只“读”，要能开始流程、勾步骤、写备注、保存和导出。
- 实现：`workflows/loader.py` 把每个章节/附录的 `##` 标题和每个模板的 `##` 小节转成步骤；69 个流程分为 8 个阶段；章节页展示关联流程，流程页可回原文/章节/排查工作台。
- 数据：DB v4 `workflow_runs`；登录用户在服务端保存，demo 模式写 localStorage；demo 本地流程不会自动合并到登录后的服务端。
- 如何避免：书稿标题变化会改变流程步骤，修改书稿后重启服务并检查 `/api/workflows`；不要在前端单独维护流程步骤，否则会和书稿漂移。

### 2026-10-25 the-tam-book 的完整书稿不在 GitHub 仓库
- 现象：`gh api repos/allengaller/the-tam-book/...` 只有 README；完整书稿在本地 `/Users/allengaller/Documents/GitHub/allengaller/the-tam-book/the-tam-book/manuscript`。
- 触发条件：需要把全部章节接入 UI 专题页。
- 处理方式：从本地 manuscript/templates 复制到 `content/tam-book/`；新增 `content/tam-book/README.md` 同步说明。
- 如何避免：不要以 GitHub 仓库内容判断书稿是否完整；同步后重启 `open-tam serve`，`/api/book` 会自动重建目录与专题页。

### 2026-10-25 TAM 手册专题页与 Markdown 渲染
- 现象：需要 28 章 + 22 附录 + 19 模板全部有独立页面，且不能引入前端 Markdown 依赖。
- 处理方式：服务端 `markdown-it-py` 渲染，`html=False` 转义原文 HTML；`content/tam-book` 为唯一内容源；`GET /api/book` 返回目录，`/api/book/{slug}` 返回正文、TOC 与上下篇；认证开启时书籍 API 需要登录（viewer 可读），demo 模式公开。
- 细节：首个导读 blockquote 从正文剥离，避免与页头摘要重复；TOC 使用 `sec-N` 锚点 + 前端 `scrollIntoView`，不破坏 hash 路由。
- 如何避免：书籍内容更新后重启服务；新增章节文件名必须匹配 `chNN-*`、`appx-x-*`、`NN-*` 约定。

### 2026-10-25 Web UI 视觉重构为 IBM 企业工作台
- 现象：暗色 Ops Console 与“企业级工作台”定位不符，长时阅读和团队管理场景不够清晰。
- 处理方式：改为白底 `#f4f4f4` / 白色面板 / IBM Blue 60 `#0f62fe`；方形组件、1px 细边框、3px 蓝色顶栏与导航激活条；自托管 IBM Plex Sans/Mono（Latin 子集，中文回退 PingFang），通过 `/static/fonts` 提供。
- 坑：catalog API 的 `practice_label` 与前端 `practiceLabel` 不一致，模块练习入口曾空白；已做兼容 `practice_label || practiceLabel`。
- 如何避免：新增 API 字段时对照前端读取字段；视觉重构保留功能验收（案例、工作台、团队、登录）后再收口。

### 2026-10-23 `loadProgress` 同名导致页面空渲染
- 现象：目录 API 返回正常，但模块/案例不渲染，控制台报 `Object.keys` 接收 undefined。
- 触发条件：前端同时存在本地进度加载器与新增的服务端 `loadProgress`。
- 原因：函数声明同名，后者覆盖前者，`state.progress` 初始化变成 Promise，`state.progress.modules` 为 undefined。
- 处理方式：本地加载器改名 `loadLocalProgress`，服务端同步保留 `loadProgress`。
- 如何避免：同名函数/变量在单文件 UI 中尤其危险；新增异步同步函数先查重名。

### 2026-10-23 团队 Skill 覆盖口径不一致
- 现象：完成 CPU 案例后，“日志证据检索”仍显示 0% 覆盖。
- 触发条件：案例 `cases.yaml` 的 `skill_ids` 与 Skill 的 `case_ids` 列表不完全对称。
- 原因：团队覆盖按 `skill.case_ids` 计算，而案例实际教学范围由 `case.skill_ids` 声明。
- 处理方式：统一以案例声明的 `skill_ids` 计算 Skill 覆盖；Skill 的 `case_ids` 仅作为练习入口示例。
- 如何避免：内容关系要么保持双向一致，要么明确唯一事实源并写进校验/测试。

### 2026-10-23 Sticky 输入区遮住最新排查事件
- 现象：排查完成后根因报告被底部 sticky composer 覆盖，截图里看不到。
- 触发条件：工作台时间线较长，composer 使用 `position: sticky; bottom: 0`。
- 原因：时间线底部没有为 composer 预留空间，`scrollIntoView(block: nearest)` 把最新事件停在 composer 后面。
- 处理方式：`#timeline` 增加 `padding-bottom`，事件增加 `scroll-margin-bottom`，自动滚动改为 `block: center`。
- 如何避免：任何 sticky footer 都要给滚动内容预留等高空间，并用真实交互验证最后一条事件可见。

### 2026-10-25 工作台重构为 10 模块 IA
- 目录：今日工作台 / 任务中心 / 客户工作 / 服务执行 / 事件与问题 / 协同与经营 / 我的成长 / 团队管理 / 知识与工具 / 系统设置。新页面由 `workspace.js` 渲染，原有 book/cases/workflows/workbench/history/skills/evals 页面保留，路由映射到新导航。
- 数据边界：客户、任务、服务、协同、成长目标/绩效/工时是 `open-tam-workspace-v3` localStorage 演示工作区；学习进度、案例尝试、流程运行、排查历史、团队与评测走服务端。设置页提供重置。
- 新 API：`GET /api/audit`（Admin；demo 开放）与 `GET /api/history/{id}/report`（只允许 reports 目录内文件）。`/api/config` 增加角色权限、通知/集成状态，不暴露密钥。
- 如何避免：新增业务对象先复用统一详情骨架（基本信息→结论→执行→协作→关联→时间线→关闭标准），不要让客户视图复制权威台账。

### 2026-10-25 showPage 参数个数导致 builder is not a function
- 现象：`#tasks`、`#lifecycle` 显示“页面渲染失败 builder is not a function”。
- 原因：`showPage(navId, title, sub, builder)` 只有 4 个参数；写成 `showPage(navId, ...meta3, () => render())` 共 5 个，builder 实际收到 sub 字符串。
- 处理方式：统一 `showPage(...meta3, () => render())`（meta3 必须包含 navId），或显式传 4 个参数。
- 如何避免：单文件 UI 中 `showPage`/`showAsyncPage` 的 spread 调用必须先数参数；新增页面后跑 `#tasks`、`#lifecycle` 这类带 3 元标题的路径。

### 2026-10-25 table cell 传 `{node}` 显示 `[object Object]`
- 现象：工单、角色、服务队列的状态列显示 `[object Object]`。
- 原因：表格单元格支持 Node、字符串和 `{node}` 包装；旧实现只在 `cell.text !== undefined` 时处理对象，`{node: status(...)}` 落到 `String(cell)`。
- 处理方式：对象单元格先看 `cell.node`，再看 `cell.text`，否则显示 `—`。
- 如何避免：所有表格状态/徽章统一用 `{node: ...}`；新增列后检查实际 DOM 文本。

### 2026-10-25 手册模板的 kind 是 tool 不是 template
- 现象：`#knowledge/templates` 显示“没有匹配的模板”，但 `/api/book` 明明有 19 个模板。
- 原因：书籍索引中模板文档的 `kind` 是 `tool`（counts 里叫 templates）。
- 处理方式：模板页过滤 `doc.kind === 'tool'`；流程 id 仍是 `tool-<slug>`。
- 如何避免：不要用 counts 字段名推断文档 kind；先看 `/api/book` 的 parts/documents 实际值。

### 2026-10-25 静态 JS/CSS 更新后浏览器仍跑旧代码
- 现象：修了 `showPage`，浏览器仍报旧错误；curl 拿到的文件已是新版本。
- 原因：`/static` 没有 no-store，浏览器按 URL 缓存 workspace.js/css；只改内容不改 URL 不会重新拉取。
- 处理方式：index.html 的 `/static/workspace*.js|css` 带版本查询串（如 `?v=20261025c`）；发版时同步更新三个引用。
- 如何避免：改动 workspace 静态文件后 bump 版本；测试时用 CDP `Network.setCacheDisabled`，页面导航带唯一查询参数强制整页重载。

### 2026-10-25 团队菜单在未登录/operator 下可见
- 现象：认证开启且未登录时左侧仍显示“团队管理”；operator 也可能看到。
- 原因：`canManageTeam()` 在 config 未加载时默认放行，且 demo 模式允许展示演示团队。
- 处理方式：`canManageTeam()` 仅在无认证的 demo 模式或 admin/mentor 时返回 true；boot 在 config/me 加载后调用 `WS.syncUser()` 重绘导航；`ensureTeam()` 对认证开启但未登录/非管理者返回 denied。
- 如何避免：菜单隐藏只做展示，服务端 `/api/team/progress` 仍要校验角色；新增角色页面同时测未登录、operator、mentor、admin。

### 2026-10-25 活跃客户上下文与新排查关联
- 机制：顶部客户切换器把 `activeCustomer` 存入演示工作区；发起排查成功后 `WS.linkInvestigation(inv.id)` 记录 investigation→customer；事件与客户 360° 的时间线据此回放。
- 注意：旧排查记录没有关联客户；不要在前端按 service 名猜测客户。排查结束后刷新 history 与导航徽章，避免进行中事件数量滞留。
- 如何避免：新增“从客户发起”的动作必须调用 linkInvestigation；客户上下文只影响新对象，不回写历史。

### 2026-10-25 工作台页面加载串行导致慢
- 现象：成长总览在 headless 3 秒截图中仍是上一页；串行等待 history→workflow runs→attempts→evals→team。
- 处理方式：`Promise.all` 并行加载；每个 loader 有 loading 标记，失败显示空态而不是阻塞整页。
- 如何避免：页面首屏的多个独立数据源必须并行；验收时等待目标页标题出现，不能只固定 sleep。
