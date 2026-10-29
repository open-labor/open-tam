# 附录 F　2026 年主要云厂商通告汇编

> 本附录收录 2026 年内主要云厂商发布或生效的产品通告（退市、下线、版本生命周期、重大价格与计费调整），供 TAM 做版本生命周期管理（第 5 章）与变更治理（P12）时对照。
>
> **时效性声明：本附录数据采集时点为 2026 年 10 月 23 日，状态栏以该时点为准。** 云厂商通告随时新增与修订，正式决策前必须回到来源链接复核原文；本附录随版本迭代刷新，欢迎按附录 E 的共建方式提交增补。**发布闸门：本书每次正式发布前，本附录必须刷新数据时点；若未刷新，须在本声明处加注"数据时点未刷新，以最新通告为准"。**
>
> 通告状态分级：**已生效**（截止日已过）／**过渡中**（已公告，部分节点已过）／**未到期**（仅公告，节点在未来）。

## F.1 国际厂商

### AWS

| 通告 | 关键日期 | 状态 | 来源 |
| --- | --- | --- | --- |
| AWS Proton 停服（EOL）：控制台、API、CLI 全部关闭，已部署的 CloudFormation 栈继续运行但失去管理面 | 2026-10-07 停服 | 已生效 | [AWS 服务生命周期页](https://docs.aws.amazon.com/general/latest/gr/service-lifecycle.html)、[迁移指南](https://www.bunnyshell.com/blog/aws-proton-end-of-life/) |
| AWS CLI v1 进入维护模式：仅关键修复与安全更新，不再加新功能 | 2026-07-15 起维护模式；2027-07-15 停止支持 | 过渡中 | [AWS 开发者博客](https://aws.amazon.com/blogs/developer/cli-v1-maintenance-mode-announcement/) |
| Lambda 等运行时 Node.js 20 弃用（Node.js 20 上游 EOL） | Node.js 20 于 2026-04-30 上游 EOL，各云运行时陆续跟进弃用 | 过渡中 | [HeroDevs 分析](https://www.herodevs.com/blog-posts/running-node-js-20-on-aws-what-deprecation-actually-means-and-what-your-options-are) |

### Microsoft Azure

| 通告 | 关键日期 | 状态 | 来源 |
| --- | --- | --- | --- |
| Azure Communication Services（ACS）独立产品退役：公告日 2026-09-23，退役日 2028-09-30；2026-10-23 起限制新客户接入退役服务 | 2028-09-30 全面退役 | 过渡中 | [Microsoft Learn 退役指南](https://learn.microsoft.com/en-us/azure/communication-services/acs-retirement-and-breaking-changes-guide) |
| 2026 年 9 月 30 日集中退役：Functions v3（Linux Consumption 停止运行）、Service Bus SBMP 协议停用、Azure Virtual Desktop (classic)、Azure API for FHIR、Application Insights URL ping 测试、Container insights 的 ContainerLog 表 | 2026-09-30 | 已生效 | [Technspire 盘点](https://technspire.com/en/blog/azure-30-september-retirements-what-stops-working)、[Microsoft 生命周期页](https://learn.microsoft.com/en-us/lifecycle/end-of-support/end-of-support-2026) |
| AI 服务退役：Anomaly Detector、Metrics Advisor、Personalizer | 2026-10-01 | 已生效 | 同上 |
| Azure Functions 进程内模型（In-process）停止支持 | 2026-11-10 | 未到期 | [Microsoft 生命周期页](https://learn.microsoft.com/en-us/lifecycle/end-of-support/end-of-support-2026) |
| VM 规格退役：NVv3/NVv4 系列 2026-09-30 退役；NP 系列公告 2026-04-02、2027-05-31 退役；Dv3/Dsv3/Ev3/Esv3 系列 2029-11-15 退役 | 分批 | 部分已生效 | [Azure VM 生命周期页](https://learn.microsoft.com/en-us/azure/virtual-machines/sizes/lifecycle/retirements-and-capacity-restrictions) |
| Azure VMware Solution AV36P/AV52 节点退役 | 2029-06-30（RI 购买窗口 2026/2028 分批关闭） | 未到期 | [Francesco Molfese 汇总](https://francescomolfese.it/en/2026/03/azure-iaas-and-azure-local-announcements-and-updates-2026-weeks-11-12/) |
| Azure WAF 托管规则集支持策略调整：DRS 2.2 GA 后仅支持最近三个版本，旧规则集进入最后一年支持期 | 旧规则集支持期至 2027-02-26 | 过渡中 | 同上 |

### Google Cloud

| 通告 | 关键日期 | 状态 | 来源 |
| --- | --- | --- | --- |
| Data Catalog 停用（分阶段关闭，AI 功能先行终止） | AI 功能 2026-09-30 终止；服务 2026-06-01 起分阶段停用 | 过渡中 | [Atlan 整理](https://atlan.com/know/ai-agent/gcp/google-knowledge-catalog/) |
| Google Checks（隐私合规平台）关停：停止新注册，数据到期自动删除 | 2026 年 9 月底全面关停 | 已生效 | [DEV Community](https://dev.to/jamilxt/google-checks-is-shutting-down-what-the-privacy-compliance-platform-deprecation-means-for-4h7k) |
| Gemini CLI / Code Assist IDE 扩展对个人用户（AI Pro/Ultra、免费层）停止服务，转向 Antigravity CLI；企业版（Google Cloud 通道）不受影响 | 2026-06-18 | 已生效 | [Google 开发者博客](https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/) |
| Google SecOps：v1 连接器数据馈送自动迁移至 v2（2026-04-10 起分批）；Ingestion API 弃用 | Ingestion API 2027-07-20 停用 | 过渡中 | [Google SecOps 文档](https://docs.cloud.google.com/chronicle/docs/deprecations)、[SecOps 更新日志](https://security.googlecloudcommunity.com/what-s-new-in-secops-91/what-s-new-in-google-secops-2026-10-19-8455) |

## F.2 国内厂商

### 阿里云

| 通告 | 关键日期 | 状态 | 来源 |
| --- | --- | --- | --- |
| 虚拟数字人产品退市（公告 2026-10-16） | 2026-11-30 停新购；2027-05-31 停续订与版本更新；2027-11-30 全面停服（控制台、工单、退款同步终止） | 过渡中 | [阿里云公告](https://www.aliyun.com/notice/118726) |
| 数字人形象定制、直播产品、会员订阅退市 | 2026-10-11 停新购；2027-04-11 停续订；2027-10-11 全面停服 | 过渡中 | [阿里云公告](https://www.aliyun.com/notice/118683) |
| 百炼"全妙"商品退市 | 2026-10-25 停新购；2027-04-23 停续订；2027-10-20 全面停服 | 过渡中 | [阿里云公告](https://www.aliyun.com/notice/118598) |
| EMAS 云发布功能下线 | 2026-10-01 停止新应用开通；2026-12-30 正式停服（控制台关闭，移动端接口保留） | 过渡中 | [阿里云帮助中心](https://help.aliyun.com/zh/document_detail/2584335.html) |
| 移动测试国内站停止服务 | 2026-06-01 停服，控制台同步下线 | 已生效 | [CSDN 转述官方退市公告](https://blog.csdn.net/2501_92406411/article/details/162493607) |

### 腾讯云

| 通告 | 关键日期 | 状态 | 来源 |
| --- | --- | --- | --- |
| GPU 换代：H200 全地域可用区上线，H100 正式下线 | 2026-07-18 | 已生效 | [腾讯云专栏](https://cloud.tencent.com/developer/article/2712907?policyId=1003) |
| 互动白板产品退市 | 2026-09-30 停售（EOM）；2027-06-30 停止全面支持（EOSS）；2027-12-31 停服（EOMS），逾期数据无法恢复 | 过渡中 | [腾讯云公告](https://cloud.tencent.com/announce/detail/2510) |
| 大模型旧平台下线并迁移至 TokenHub；原混元平台 46 个旧版本模型下线 | 旧版本模型 2026-06-22 下线；旧平台 2026-06-30 停售、2026-09-30 全面停服 | 已生效 | [腾讯云公告](https://cloud.tencent.com/document/product/1729/131925)、[TokenHub 迁移公告](https://cloud.tencent.com/announce/detail/2287) |
| DeepSeek-V3.2 模型下线，推荐迁移 V4 系列（未迁移自动切换） | 2026-07-16 | 已生效 | [新浪财经](https://cj.sina.cn/articles/view/1826017320/6cd6d02804001ln20?froms=ggmp&vt=4) |
| TokenHub/ADP 模型轮换：GLM-5v-Turbo（09-17）、MiMo-V2.5-Pro（09-29）、DeepSeek-V4-Flash 0731（09-30）下线或自动切换；DeepSeek 峰谷计费规则调整（09-24） | 2026 年 9 月分批 | 已生效 | [腾讯云公告列表](https://intl.cloud.tencent.com/announce/zh) |
| 混元生视频旧版接口与 TokenHub 视频模型（HY-Video-1.5、YT-Video-FX、YT-Video-2.0）下线；国际站文本翻译 QPS 逐月缩减至归零 | 视频接口 2026-09-03 起分批、09-30 终止；翻译 QPS 2026-10 起逐月缩减，2027-10-01 归零 | 过渡中 | [行业盘点](https://www.gether.net/news/show-333.html) |
| WeTest 质量风控测试服务等产品退市 | 公告 2026-09-24，里程碑见原文 | 过渡中 | [腾讯云公告列表](https://intl.cloud.tencent.com/announce/zh) |
| 元器平台停止服务（智能体迁移至腾讯云 ADP） | 2026-10-29 停止新建与 API Key 分发；2026-11-09 停服；2027-01-09 用户数据依法删除 | 过渡中 | [凤凰网科技](https://feng.ifeng.com/c/8xL5lewD9tU) |
| DeepSeek-V4 系列模型降价（最高降幅 97.5%，仅价格调整） | 2026-06-03 生效 | 已生效 | [钛媒体](https://www.tmtpost.com/nictation/8012517.html) |

### 华为云

| 通告 | 关键日期 | 状态 | 来源 |
| --- | --- | --- | --- |
| 主机迁移服务（SMS）废弃 API 下线 | 2026-04-16 | 已生效 | [华为云公告](https://www.huaweicloud.com/notice/2025/20260116154138422.html) |
| ModelArts Studio Agent 开发模块下线（西南-贵阳一），迁移至智能体平台 Versatile | 2026-02-15 | 已生效 | [华为云公告](https://www.huaweicloud.com/notice/2025/20260114164756418.html) |
| MaaS 平台模型下架：Qwen3-Coder-480B-A35B-Instruct、Kimi-K2 | 2026-05-15 | 已生效 | [金十数据](https://flash.jin10.com/detail/20260424180241979800) |
| MaaS 平台 DeepSeek-V4-Pro 下线 | 中国站（贵阳一）2026-09-22 停售、2026-09-30 下线；国际站（中国-香港）2026-10-08 下线 | 已生效 | [All Agent 百科核验记录](https://www.allagent.wiki/agents/huaweicloud-maas/) |
| AI 使能服务优化与提升服务价格调整（中国站，新购续费均按新价） | 2026-11-16 生效 | 未到期 | [钛媒体数智周报](https://www.tmtpost.com/8171854.html) |

## F.3 TAM 落地要求：通告不是新闻，是工单原料

1. **跟踪机制**：客户涉及的每家云厂商，通告入口（公告列表、生命周期页、邮件订阅）登记进客户技术档案（B.3.3）；每周风险扫描（P9）时过一遍新通告。
2. **三问过滤**：每条通告问三句——客户在用的服务/版本/Region 是否命中？关键日期距离现在还有多久？替代方案是否验证过？三问有一问答不上来，登记进风险登记册。
3. **节点进日历**：EOM/EOSS/EOMS 三个节点全部进变更与重保日历（P12/P5），停服节点前 90 天自动触发迁移立项评估；**TAM 的职责是让客户永远不需要在截止日前一周才知道 deadline**。
4. **2026 年的两个结构性信号**：一是大模型版本轮换周期缩到以月计（各厂均在 6–9 月集中下线旧模型），模型选型必须预留迁移通道；二是 C 端/轻量 AI 产品批量退市（数字人、智能体平台），向客户推荐产品选型时把"厂商战略存续性"列为正式评估项。

---

> 增补规则：新增通告按"厂商 → 表格行"追加，必须附官方来源链接与采集日期；上一年度汇编随版本归档，不删除、只封存。
