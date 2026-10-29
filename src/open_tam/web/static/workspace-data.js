/* Open TAM workspace data: information architecture + demo operational records.
   The records live in localStorage so the portal can be exercised without a CRM backend. */
(function () {
  const WS_VERSION = 3;
  const WS_KEY = 'open-tam-workspace-v3';

  function iso(offsetDays, hour) {
    const d = new Date();
    d.setHours(hour === undefined ? 18 : hour, 0, 0, 0);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString();
  }
  function dateOnly(offsetDays) {
    return iso(offsetDays, 12).slice(0, 10);
  }

  const NAV = [
    {
      id: 'home', label: '今日工作台', code: '台',
      items: [
        { id: 'home-overview', label: '今日工作台', route: 'home' },
        { id: 'home-tasks', label: '我的待办', route: 'home/tasks' },
        { id: 'home-signals', label: '风险与信号', route: 'home/signals' },
        { id: 'home-schedule', label: '今日日程与值班', route: 'home/schedule' },
        { id: 'home-customers', label: '最近处理的客户', route: 'home/customers' },
      ],
    },
    {
      id: 'tasks', label: '任务中心', code: '任',
      items: [
        { id: 'tasks-all', label: '全部任务', route: 'tasks' },
        { id: 'tasks-mine', label: '我负责的', route: 'tasks/mine' },
        { id: 'tasks-created', label: '我发起的', route: 'tasks/created' },
        { id: 'tasks-internal', label: '等待内部协作', route: 'tasks/internal' },
        { id: 'tasks-customer', label: '等待客户', route: 'tasks/customer' },
        { id: 'tasks-due', label: '即将到期', route: 'tasks/due' },
        { id: 'tasks-overdue', label: '已逾期', route: 'tasks/overdue' },
      ],
    },
    {
      id: 'customers', label: '客户工作', code: '客',
      items: [
        { id: 'customers-list', label: '客户列表', route: 'customers' },
        { id: 'customer-360', label: '客户 360°', route: 'customer-360' },
        {
          id: 'customer-lifecycle', label: '客户生命周期', route: 'lifecycle',
          children: [
            { id: 'lifecycle-presales', label: '售前移交', route: 'lifecycle/presales' },
            { id: 'lifecycle-import', label: '项目导入', route: 'lifecycle/import' },
            { id: 'lifecycle-onboarding', label: 'Onboarding', route: 'lifecycle/onboarding' },
            { id: 'lifecycle-adoption', label: '采纳深化', route: 'lifecycle/adoption' },
            { id: 'lifecycle-steady', label: '稳态运营', route: 'lifecycle/steady' },
            { id: 'lifecycle-renewal', label: '续约与扩容', route: 'lifecycle/renewal' },
            { id: 'lifecycle-handover', label: '移交与退出', route: 'lifecycle/handover' },
          ],
        },
        { id: 'portfolio-scope', label: '服务范围与权益', route: 'portfolio/service-scope' },
        { id: 'portfolio-plan', label: '服务计划', route: 'portfolio/service-plan' },
        { id: 'portfolio-tech', label: '技术资产与配置', route: 'portfolio/tech-assets' },
        { id: 'portfolio-adoption', label: '采纳、用量与成本', route: 'portfolio/adoption' },
        { id: 'portfolio-health', label: '客户健康度', route: 'portfolio/health' },
        { id: 'portfolio-relations', label: '关键人与关系', route: 'portfolio/relations' },
        { id: 'portfolio-value', label: '价值账本', route: 'portfolio/value' },
        { id: 'portfolio-archive', label: '客户档案与离任交接', route: 'portfolio/archive' },
      ],
    },
    {
      id: 'service', label: '服务执行', code: '服',
      items: [
        { id: 'service-architecture-review', label: '架构评审', route: 'service/architecture-review' },
        { id: 'service-product-onboarding', label: '产品导入与技术转移', route: 'service/product-onboarding' },
        { id: 'service-go-live-gate', label: '上线闸门', route: 'service/go-live-gate' },
        { id: 'service-risk-register', label: '风险登记册', route: 'service/risk-register' },
        { id: 'service-change-management', label: '变更管理', route: 'service/change-management' },
        { id: 'service-major-assurance', label: '重大保障', route: 'service/major-assurance' },
        { id: 'service-capacity-availability', label: '容量与可用性', route: 'service/capacity-availability' },
        { id: 'service-regulatory-calendar', label: '业务与监管日历', route: 'service/regulatory-calendar' },
        { id: 'service-notice-lifecycle', label: '通告与版本生命周期', route: 'service/notice-lifecycle' },
        { id: 'service-duty-oncall', label: '值班与值守', route: 'service/duty-oncall' },
        { id: 'service-quality', label: '服务质量', route: 'service/quality' },
      ],
    },
    {
      id: 'incidents', label: '事件与问题', code: '事',
      items: [
        { id: 'incidents-tickets', label: '工单管理', route: 'incidents' },
        { id: 'incidents-major', label: '重大事件', route: 'incidents/major' },
        { id: 'incidents-escalation', label: '升级与沟通', route: 'incidents/escalation' },
        { id: 'incidents-rca', label: 'RCA', route: 'incidents/rca' },
        { id: 'incidents-review', label: '问题复盘', route: 'incidents/review' },
        { id: 'incidents-improvement', label: '改进项闭环', route: 'incidents/improvement' },
      ],
    },
    {
      id: 'collab', label: '协同与经营', code: '协',
      items: [
        { id: 'collab-iron-triangle', label: '铁三角协同', route: 'collab/iron-triangle' },
        { id: 'collab-presales-handover', label: '售前承诺与项目移交', route: 'collab/presales-handover' },
        { id: 'collab-product-feedback', label: '产品需求与反馈', route: 'collab/product-feedback' },
        { id: 'collab-partner', label: '伙伴协同', route: 'collab/partner' },
        { id: 'collab-meeting-decisions', label: '例会与决策记录', route: 'collab/meeting-decisions' },
        { id: 'collab-qbr-ebr', label: 'QBR／EBR', route: 'collab/qbr-ebr' },
        { id: 'collab-vbr-value', label: 'VBR／价值报告', route: 'collab/vbr-value' },
        { id: 'collab-renewal-signals', label: '续约、增购与流失信号', route: 'collab/renewal-signals' },
      ],
    },
    {
      id: 'growth', label: '我的成长', code: '成',
      items: [
        { id: 'growth-overview', label: '成长总览', route: 'growth' },
        { id: 'growth-career', label: '职业路径', route: 'growth/career' },
        { id: 'growth-goals', label: '发展目标与 IDP', route: 'growth/goals' },
        { id: 'growth-capability', label: '能力图谱', route: 'growth/capability' },
        { id: 'growth-learning', label: '学习与训练', route: 'growth/learning' },
        { id: 'growth-certs', label: '认证管理', route: 'growth/certs' },
        { id: 'growth-reviews', label: '定期回顾与 1:1', route: 'growth/reviews' },
        { id: 'growth-performance', label: '绩效评估', route: 'growth/performance' },
        { id: 'growth-evidence', label: '工作证据与成就档案', route: 'growth/evidence' },
        { id: 'growth-promotion', label: '晋升申请与答辩', route: 'growth/promotion' },
        { id: 'growth-mentoring', label: '带教与组织贡献', route: 'growth/mentoring' },
        { id: 'growth-time', label: '我的工时、加班与调休', route: 'growth/time' },
        { id: 'growth-transition', label: '职业转换与经验传承', route: 'growth/transition' },
      ],
    },
    {
      id: 'team', label: '团队管理', code: '队', managerOnly: true,
      items: [
        { id: 'team-overview', label: '团队总览', route: 'team' },
        { id: 'team-allocation', label: '人员与客户分配', route: 'team/allocation' },
        { id: 'team-capability', label: '能力、备份与人才梯队', route: 'team/capability' },
        { id: 'team-workload', label: '工作量、值班与疲劳', route: 'team/workload' },
        { id: 'team-quality', label: '服务质量与工作评估', route: 'team/quality' },
        { id: 'team-calibration', label: '绩效校准与反馈', route: 'team/calibration' },
        { id: 'team-hiring', label: '招聘与新人培养', route: 'team/hiring' },
        { id: 'team-certification', label: '认证与晋升评审', route: 'team/certification' },
        { id: 'team-knowledge', label: '团队知识资产', route: 'team/knowledge' },
      ],
    },
    {
      id: 'knowledge', label: '知识与工具', code: '知',
      items: [
        { id: 'knowledge-home', label: '我的知识库与收藏', route: 'knowledge' },
        { id: 'knowledge-playbooks', label: '方法与 Playbook', route: 'workflows' },
        { id: 'knowledge-templates', label: '模板与 Checklist', route: 'knowledge/templates' },
        { id: 'knowledge-cases', label: '案例库', route: 'cases' },
        { id: 'knowledge-standards', label: '标准与规范', route: 'book' },
        { id: 'knowledge-notices', label: '产品通告与行业监管资料', route: 'book/appx-f-cloud-vendor-notices-2026' },
        { id: 'knowledge-contribution', label: '内容贡献与评审', route: 'book/appx-e-contribution-guide' },
        { id: 'knowledge-glossary', label: '术语表', route: 'book/appx-a-glossary' },
      ],
    },
    {
      id: 'settings', label: '系统设置', code: '设',
      items: [
        { id: 'settings-home', label: '个人偏好', route: 'settings' },
        { id: 'settings-roles', label: '角色与权限', route: 'settings/roles' },
        { id: 'settings-integrations', label: '数据源与系统集成', route: 'settings/integrations' },
        { id: 'settings-metrics', label: '指标与评分规则', route: 'settings/metrics' },
        { id: 'settings-notifications', label: '通知与升级规则', route: 'settings/notifications' },
        { id: 'settings-ai', label: '数据与 AI 权限', route: 'settings/ai' },
        { id: 'settings-sharing', label: '对外分享与脱敏规则', route: 'settings/sharing' },
        { id: 'settings-retention', label: '数据保留与归档', route: 'settings/retention' },
        { id: 'settings-audit', label: '审计日志', route: 'settings/audit' },
      ],
    },
  ];

  const PAGE_TITLES = {
    home: ['今日工作台', '今天要处理什么、哪里可能出问题、客户最近怎么样'],
    'home/tasks': ['我的待办', '按优先级处理的个人任务'],
    'home/signals': ['风险与信号', '需要今天判断的客户风险、事件与商业信号'],
    'home/schedule': ['今日日程与值班', '会议、值守与关键节点'],
    'home/customers': ['最近处理的客户', '最近有互动的客户与当前状态'],
    tasks: ['任务中心', '统一查看负责、发起、等待与到期任务'],
    'tasks/mine': ['我负责的', '当前由我推进的任务'],
    'tasks/created': ['我发起的', '我创建并需要跟踪闭环的任务'],
    'tasks/internal': ['等待内部协作', '卡在内部团队的任务'],
    'tasks/customer': ['等待客户', '等待客户确认、材料或窗口的任务'],
    'tasks/due': ['即将到期', '未来 7 天内到期的任务'],
    'tasks/overdue': ['已逾期', '已超过截止时间、需要立即处理的任务'],
    customers: ['客户列表', '按分层、生命周期、健康度与负责人查看客户组合'],
    'customer-360': ['客户 360°', '以一个客户为中心汇聚服务、风险、价值与关系'],
    lifecycle: ['客户生命周期', '从售前移交到退出的七个阶段与阶段闸门'],
    'portfolio/service-scope': ['服务范围与权益', '全部客户的服务范围、SLA/XLA 与权益边界'],
    'portfolio/service-plan': ['服务计划', '年度与季度服务计划、节奏与责任人'],
    'portfolio/tech-assets': ['技术资产与配置', '架构、组件、版本生命周期与关键配置'],
    'portfolio/adoption': ['采纳、用量与成本', '采纳指标、用量趋势与成本/价值对照'],
    'portfolio/health': ['客户健康度', '健康分、影响因素与风险客户'],
    'portfolio/relations': ['关键人与关系', '关键人图谱、立场与关系风险'],
    'portfolio/value': ['价值账本', '可证明的客户价值与业务结果'],
    'portfolio/archive': ['客户档案与离任交接', '档案完整性、交接清单与责任边界'],
    incidents: ['工单管理', '从告警受理到根因报告的工单队列'],
    'incidents/major': ['重大事件', 'P1/P2 事件、指挥角色与进行中的作战室'],
    'incidents/escalation': ['升级与沟通', '升级矩阵、沟通节奏与客户通报记录'],
    'incidents/rca': ['RCA', '根因分析报告与证据链'],
    'incidents/review': ['问题复盘', '复盘结论、行动项与责任分配'],
    'incidents/improvement': ['改进项闭环', '从复盘到验证关闭的改进项台账'],
    growth: ['成长总览', '能力进度、目标、认证与下一步行动'],
    'growth/career': ['职业路径', 'TAM 能力阶梯、角色边界与成长路线'],
    'growth/goals': ['发展目标与 IDP', '个人发展计划、目标进度与复盘节奏'],
    'growth/capability': ['能力图谱', '技能覆盖、证据与能力缺口'],
    'growth/learning': ['学习与训练', '入门路径、案例、流程与训练任务'],
    'growth/certs': ['认证管理', '认证状态、申请条件与评审记录'],
    'growth/reviews': ['定期回顾与 1:1', '回顾记录、反馈与行动项'],
    'growth/performance': ['绩效评估', '自评、证据与评分维度'],
    'growth/evidence': ['工作证据与成就档案', '案例、流程、事件与可证明的成果'],
    'growth/promotion': ['晋升申请与答辩', '晋升就绪度、材料与答辩记录'],
    'growth/mentoring': ['带教与组织贡献', '带教关系、评审贡献与知识沉淀'],
    'growth/time': ['我的工时、加班与调休', '工时台账、加班与调休余额'],
    'growth/transition': ['职业转换与经验传承', '交接清单、经验沉淀与转型准备'],
    team: ['团队总览', '团队负载、客户分配、能力与质量'],
    'team/allocation': ['人员与客户分配', '主备负责人、负载与覆盖缺口'],
    'team/capability': ['能力、备份与人才梯队', '技能覆盖、备份关系与梯队风险'],
    'team/workload': ['工作量、值班与疲劳', '任务负载、值班强度与疲劳信号'],
    'team/quality': ['服务质量与工作评估', '评测、复盘质量与工作评价'],
    'team/calibration': ['绩效校准与反馈', '成员评价、校准记录与反馈'],
    'team/hiring': ['招聘与新人培养', '招聘管道、画像与 90 天培养'],
    'team/certification': ['认证与晋升评审', '认证申请、晋升材料与评审队列'],
    'team/knowledge': ['团队知识资产', 'Skill、流程、模板与贡献'],
    knowledge: ['我的知识库与收藏', '收藏、最近使用与推荐内容'],
    'knowledge/templates': ['模板与 Checklist', '手册中的 19 个模板，可直接转成执行流程'],
    'settings': ['个人偏好', '默认客户、起始页与工作区数据'],
    'settings/roles': ['角色与权限', '角色能力边界与服务端权限点'],
    'settings/integrations': ['数据源与系统集成', '指标、日志、模型、区域与 Webhook'],
    'settings/metrics': ['指标与评分规则', '评测口径、质量门与案例评分'],
    'settings/notifications': ['通知与升级规则', '通知通道、触发条件与升级矩阵'],
    'settings/ai': ['数据与 AI 权限', '模型、调用边界与护栏'],
    'settings/sharing': ['对外分享与脱敏规则', '客户材料外出前的检查与授权'],
    'settings/retention': ['数据保留与归档', '报告、Trace、审计与档案的保留策略'],
    'settings/audit': ['审计日志', '敏感动作、批准与执行记录'],
  };

  const LIFECYCLE = [
    { key: 'presales', label: '售前移交' },
    { key: 'import', label: '项目导入' },
    { key: 'onboarding', label: 'Onboarding' },
    { key: 'adoption', label: '采纳深化' },
    { key: 'steady', label: '稳态运营' },
    { key: 'renewal', label: '续约与扩容' },
    { key: 'handover', label: '移交与退出' },
  ];

  function customer(base) {
    return Object.assign({
      region: '华东', tier: '重点', stageKey: 'steady', health: 70,
      healthLabel: '关注', owner: '我', team: ['我'], service: '云平台服务',
      next: '月度服务回顾', nextDate: dateOnly(7), renewal: dateOnly(180),
      arr: '¥3.0M', brief: '', topRisk: '', factors: [], services: {},
      tech: { architecture: '', assets: [], eol: [], config: [] },
      risks: [], events: [], adoption: { metrics: [], ledger: [], qbr: {} },
      relations: [], signals: [], timeline: [], archive: {},
    }, base);
  }

  function customers() {
    return [
      customer({
        id: 'h-bank', name: 'H 银行', short: 'H 银行', industry: '金融 · 国有大行',
        tier: '战略', stage: '稳态运营', stageKey: 'steady', health: 72, healthLabel: '关注',
        owner: '我', team: ['我', '李衡', '周岚'], service: 'core-banking 核心下移',
        region: '华东 · 上海', next: 'Q3 容灾演练', nextDate: dateOnly(11),
        renewal: dateOnly(157), arr: '¥12.8M',
        brief: '核心下移试点已过首批灰度，当前重点是批处理性能与容灾演练。',
        topRisk: '批处理窗口在新平台仍有 18% 余量缺口',
        factors: [
          { label: '技术健康', score: 74, note: '批处理耗时高于基线 18%' },
          { label: '关系健康', score: 82, note: '科技条线信任稳定' },
          { label: '商业健康', score: 66, note: '二期扩容预算待批' },
          { label: '服务健康', score: 70, note: 'P2 工单 2 单待关闭' },
        ],
        services: {
          plan: '金融级核心护航', sla: '99.95%', xla: '批处理窗口 ≤ 4h',
          hours: '7×24 驻场 + 远程', renewal: dateOnly(157),
          scope: ['核心下移护航', '重大保障', '季度架构评审', '容灾演练'],
          entitlements: ['P1 30 分钟响应', '专属 TAM', '每月服务回顾'],
        },
        tech: {
          architecture: '单元化分布式核心 + 同城双活',
          assets: [
            { name: 'core-batch', type: '批处理集群', version: 'v3.8.2', status: '观察' },
            { name: 'txn-gateway', type: '交易网关', version: 'v2.14.0', status: '正常' },
            { name: 'dr-site', type: '容灾站点', version: '双活', status: '待演练' },
          ],
          eol: [{ name: 'legacy-mq', eol: dateOnly(98), risk: '中' }],
          config: ['灰度批次 2 个网点', '批处理并行度 8', '容灾切换 RTO 15m'],
        },
        risks: [
          { id: 'r-hb-1', title: '批处理窗口余量不足', level: '高', owner: '李衡', status: '处理中', due: dateOnly(9), desc: '峰值数据量下窗口余量仅 18%，需并行参数与数据分布优化。' },
          { id: 'r-hb-2', title: '容灾切换未实战演练', level: '中', owner: '我', status: '待排期', due: dateOnly(11), desc: '计划在 Q3 完成一次真实切换演练。' },
        ],
        events: [
          { id: 'e-hb-1', title: '联调环境批处理耗时翻倍', sev: 'P2', status: '已恢复', date: iso(-12), detail: '数据分布失真导致，已补充生产等比压测。' },
        ],
        adoption: {
          metrics: [
            { label: '核心交易上云率', value: '62%', target: '100%' },
            { label: '自动化巡检覆盖', value: '78%', target: '90%' },
            { label: '月度活跃应用', value: '46', target: '60' },
          ],
          ledger: [
            { item: '批处理性能优化，窗口缩短 22%', value: '¥1.2M/年', date: iso(-45) },
            { item: '灰度机制避免一次全量回滚', value: '风险损失规避', date: iso(-12) },
          ],
          qbr: { date: dateOnly(20), status: '待准备' },
        },
        relations: [
          { name: '张建国', role: '科技部总经理', stance: '支持', note: '关注业务连续性与监管口径' },
          { name: '刘敏', role: '核心系统负责人', stance: '中性', note: '对批处理性能仍有顾虑' },
          { name: '陈涛', role: '运维负责人', stance: '支持', note: '愿意配合演练窗口' },
        ],
        signals: [
          { type: '扩容', title: '二期核心扩容预算进入评审', confidence: '中', date: iso(7), status: '跟进' },
          { type: '续约', title: '框架协议 2027-03 到期', confidence: '高', date: iso(150), status: '健康' },
        ],
        timeline: [
          { date: iso(-12), type: '事件', title: '批处理耗时异常', detail: 'P2，已恢复' },
          { date: iso(-5), type: '变更', title: '并行参数调整', detail: '灰度批次观察中' },
          { date: iso(3), type: '会议', title: '月度服务回顾', detail: '与刘敏确认压测计划' },
        ],
        archive: { status: '未启动', owner: '我', docs: ['服务计划 v2', '架构基线', '灾备预案'], note: '关键人变动时启动交接' },
      }),
      customer({
        id: 'd-sec', name: 'D 证券', short: 'D 证券', industry: '金融 · 头部券商',
        tier: '战略', stage: '采纳深化', stageKey: 'adoption', health: 81, healthLabel: '健康',
        owner: '陈默', team: ['陈默', '我', '赵启'], service: 'low-latency-trading 极速交易',
        region: '华南 · 深圳', next: '极速交易容量评审', nextDate: dateOnly(5),
        renewal: dateOnly(248), arr: '¥8.4M',
        brief: '极端行情日延迟劣化暴露容量模型缺口，正在推进 XLA 入合同。',
        topRisk: '容量模型只看日历，未覆盖极端行情模式',
        factors: [
          { label: '技术健康', score: 79, note: '延迟指标已恢复，容量模型待改造' },
          { label: '关系健康', score: 88, note: 'CIO 与投资总监沟通顺畅' },
          { label: '商业健康', score: 84, note: '二期扩容意向明确' },
          { label: '服务健康', score: 74, note: 'XLA 条款仍在法务' },
        ],
        services: {
          plan: '极速交易护航', sla: '99.99%', xla: '订单延迟 P99 ≤ 300μs',
          hours: '交易时段驻场 + 重大行情值守', renewal: dateOnly(248),
          scope: ['交易链路护航', '重大行情保障', '容量模型评审', 'XLA 度量'],
          entitlements: ['行情日专家待命', '季度容量评审', '延迟专项报告'],
        },
        tech: {
          architecture: '极速撮合 + 多活行情网关',
          assets: [
            { name: 'matching-engine', type: '撮合引擎', version: 'v5.2.1', status: '正常' },
            { name: 'market-gateway', type: '行情网关', version: 'v4.0.7', status: '观察' },
            { name: 'risk-proxy', type: '风控代理', version: 'v1.8.0', status: '正常' },
          ],
          eol: [{ name: 'colocation-switch', eol: dateOnly(210), risk: '低' }],
          config: ['行情峰值阈值 20×', '备用撮合链路 1 条', '延迟采样 10s'],
        },
        risks: [
          { id: 'r-ds-1', title: '极端行情容量模型缺口', level: '高', owner: '我', status: '处理中', due: dateOnly(5), desc: '容量输入需纳入波动率 × 订单密度。' },
          { id: 'r-ds-2', title: 'XLA 条款未入合同附件', level: '中', owner: '陈默', status: '待审批', due: dateOnly(14), desc: '法务正在评估延迟指标的违约口径。' },
        ],
        events: [
          { id: 'e-ds-1', title: '极端行情订单延迟劣化', sev: 'P1', status: '已恢复', date: iso(-21), detail: '17 分钟内切换备用链路，盘后 24h 出根因。' },
        ],
        adoption: {
          metrics: [
            { label: '极速链路覆盖率', value: '86%', target: '95%' },
            { label: '行情日值守到位率', value: '100%', target: '100%' },
            { label: '延迟告警闭环', value: '92%', target: '95%' },
          ],
          ledger: [
            { item: '延迟劣化 17 分钟避免违约', value: '监管与客户损失规避', date: iso(-21) },
            { item: '备用链路切换演练', value: 'RTO 缩短 4 分钟', date: iso(-60) },
          ],
          qbr: { date: dateOnly(12), status: '已排期' },
        },
        relations: [
          { name: '周启明', role: 'CIO', stance: '支持', note: '要求重大行情日双线通报' },
          { name: '许岚', role: '投资总监', stance: '关注', note: '对延迟指标极敏感' },
          { name: '高远', role: '交易平台负责人', stance: '支持', note: '配合容量模型改造' },
        ],
        signals: [
          { type: '扩容', title: '二期极速链路扩容意向', confidence: '高', date: iso(30), status: '推进' },
          { type: '续约', title: '合同 2027-06 到期', confidence: '高', date: iso(240), status: '健康' },
        ],
        timeline: [
          { date: iso(-21), type: '事件', title: '行情延迟劣化', detail: 'P1，切备用链路' },
          { date: iso(-18), type: 'RCA', title: '容量模型缺口', detail: '24h 内提交报告' },
          { date: iso(-2), type: '会议', title: 'XLA 条款沟通', detail: '与法务、客户三方对齐' },
        ],
        archive: { status: '未启动', owner: '陈默', docs: ['XLA 草案', '容量模型 v2', '行情日值守手册'], note: '' },
      }),
      customer({
        id: 'l-ins', name: 'L 保险', short: 'L 保险', industry: '金融 · 寿险',
        tier: '重点', stage: '项目导入', stageKey: 'import', health: 58, healthLabel: '风险',
        owner: '我', team: ['我', '王珂', '林晓'], service: 'life-core 核心替换',
        region: '华北 · 北京', next: '90 天导入验收', nextDate: dateOnly(24),
        renewal: dateOnly(82), arr: '¥6.2M',
        brief: '二手项目导入第 46 天，责任边界与历史遗留风险仍在收敛。',
        topRisk: '第三方组件授权合规风险未关闭',
        factors: [
          { label: '技术健康', score: 55, note: '历史故障记录缺失' },
          { label: '关系健康', score: 62, note: '期望值已重建但仍脆弱' },
          { label: '商业健康', score: 60, note: '二期扩容取决于导入验收' },
          { label: '服务健康', score: 56, note: '合规组件替换未完成' },
        ],
        services: {
          plan: '二手项目导入与稳态过渡', sla: '99.9%', xla: '导入期问题 4h 响应',
          hours: '5×8 驻场 + P1 7×24', renewal: dateOnly(82),
          scope: ['项目导入', '风险登记', '监控补强', '知识转移'],
          entitlements: ['导入期专属 TAM', '每周风险评审', '90 天验收报告'],
        },
        tech: {
          architecture: '寿险核心替换 + 双轨并行',
          assets: [
            { name: 'policy-core', type: '保单核心', version: 'v1.0.0-rc3', status: '导入中' },
            { name: 'legacy-batch', type: '遗留批处理', version: 'EOL', status: '风险' },
            { name: 'partner-connector', type: '第三方连接器', version: 'v0.9.4', status: '合规风险' },
          ],
          eol: [{ name: 'legacy-batch', eol: dateOnly(30), risk: '高' }],
          config: ['双轨并行 90 天', '监控补强 12 项', '责任边界书面化'],
        },
        risks: [
          { id: 'r-li-1', title: '第三方组件授权合规风险', level: '高', owner: '王珂', status: '待验证', due: dateOnly(4), desc: '需替换或取得授权，否则影响上线闸门。' },
          { id: 'r-li-2', title: '历史故障记录缺失', level: '中', owner: '我', status: '处理中', due: dateOnly(10), desc: '以前 90 天观察期 + 监控补强对冲。' },
          { id: 'r-li-3', title: '前任临时方案未公开', level: '中', owner: '林晓', status: '待排期', due: dateOnly(16), desc: '两处 workaround 需逐项核验。' },
        ],
        events: [
          { id: 'e-li-1', title: '导入期监控盲区', sev: 'P2', status: '已恢复', date: iso(-7), detail: '补强 12 项监控后关闭。' },
        ],
        adoption: {
          metrics: [
            { label: '导入里程碑完成', value: '3/7', target: '7/7' },
            { label: '监控覆盖', value: '64%', target: '90%' },
            { label: '历史工单补齐', value: '0%', target: '观察期替代' },
          ],
          ledger: [
            { item: '期望值重建工作坊', value: '避免范围蔓延', date: iso(-30) },
            { item: '监控盲区补强', value: 'P2 发现提前 12 分钟', date: iso(-7) },
          ],
          qbr: { date: dateOnly(24), status: '与验收合并' },
        },
        relations: [
          { name: '马骏', role: '科技总监', stance: '谨慎', note: '要求如实披露历史风险' },
          { name: '宋洁', role: '项目办主任', stance: '支持', note: '关注 90 天验收节点' },
          { name: '何伟', role: '运维经理', stance: '中性', note: '担心监控补强工作量' },
        ],
        signals: [
          { type: '流失', title: '导入验收延期将触发合同复审', confidence: '中', date: iso(24), status: '预警' },
          { type: '扩容', title: '二期扩容取决于验收结果', confidence: '中', date: iso(60), status: '观望' },
        ],
        timeline: [
          { date: iso(-46), type: '导入', title: '二手项目入场', detail: '责任边界书面化' },
          { date: iso(-30), type: '会议', title: '期望值重建工作坊', detail: '共签 90 天清单' },
          { date: iso(-7), type: '事件', title: '监控盲区', detail: 'P2，已补强' },
        ],
        archive: { status: '准备中', owner: '我', docs: ['导入计划', '风险登记册', '责任边界备忘录'], note: '验收后启动知识转移' },
      }),
      customer({
        id: 'p-pay', name: 'P 支付', short: 'P 支付', industry: '金融 · 支付清算',
        tier: '战略', stage: '续约与扩容', stageKey: 'renewal', health: 88, healthLabel: '健康',
        owner: '赵启', team: ['赵启', '我', '陈默'], service: 'clearing 清算平台',
        region: '华东 · 杭州', next: '大促重保立项', nextDate: dateOnly(8),
        renewal: dateOnly(67), arr: '¥9.6M',
        brief: '年度大促重保与续约并行推进，扩容组件已进入变更窗口。',
        topRisk: '清算组件峰值水位 78%，需在冻结前完成扩容',
        factors: [
          { label: '技术健康', score: 84, note: '扩容变更已排期' },
          { label: '关系健康', score: 90, note: '业务与运维协同顺畅' },
          { label: '商业健康', score: 92, note: '续约与增购意向明确' },
          { label: '服务健康', score: 86, note: '重保立项材料待提交' },
        ],
        services: {
          plan: '清算峰值重保 + 年度护航', sla: '99.99%', xla: '清算窗口 ≤ 30m',
          hours: '7×24 + 大促现场值守', renewal: dateOnly(67),
          scope: ['年度重保', '容量扩容', '降级演练', '监管报告'],
          entitlements: ['大促专家现场待命', '峰值容量评审', '监管口径报告'],
        },
        tech: {
          architecture: '清算集群 + 多活数据库',
          assets: [
            { name: 'clearing-core', type: '清算核心', version: 'v6.1.0', status: '观察' },
            { name: 'settlement-db', type: '结算数据库', version: 'v4.3.2', status: '正常' },
            { name: 'degrade-switch', type: '降级开关', version: 'v1.2.0', status: '已演练' },
          ],
          eol: [{ name: 'report-agent', eol: dateOnly(150), risk: '低' }],
          config: ['峰值系数 1.3', '冻结窗口 T-21', '降级开关 8 个'],
        },
        risks: [
          { id: 'r-pp-1', title: '清算组件峰值水位 78%', level: '高', owner: '赵启', status: '已排期', due: dateOnly(6), desc: '按 50× 峰值模型将击穿，扩容需在冻结前完成。' },
          { id: 'r-pp-2', title: '降级预案仅桌面推演', level: '中', owner: '我', status: '处理中', due: dateOnly(6), desc: '需在演练中真实拉一次降级开关。' },
        ],
        events: [
          { id: 'e-pp-1', title: '大促前容量体检发现水位风险', sev: 'P2', status: '处理中', date: iso(-3), detail: '扩容立项已通过，变更窗口 T-21。' },
        ],
        adoption: {
          metrics: [
            { label: '清算自动化率', value: '94%', target: '96%' },
            { label: '峰值容量余量', value: '22%', target: '35%' },
            { label: '重保演练完成', value: '2/3', target: '3/3' },
          ],
          ledger: [
            { item: '峰值模型避免大促击穿', value: '业务连续性保障', date: iso(-3) },
            { item: '降级开关实战化', value: 'RTO 缩短 6 分钟', date: iso(-15) },
          ],
          qbr: { date: dateOnly(18), status: '待准备' },
        },
        relations: [
          { name: '吴敏', role: 'CTO', stance: '支持', note: '关注大促零 P1' },
          { name: '郑凯', role: '清算负责人', stance: '支持', note: '配合扩容与演练' },
          { name: '孙悦', role: '合规负责人', stance: '关注', note: '要求监管口径报告' },
        ],
        signals: [
          { type: '续约', title: '年度框架协议续约', confidence: '高', date: iso(67), status: '推进' },
          { type: '扩容', title: '清算集群扩容增购', confidence: '高', date: iso(40), status: '推进' },
        ],
        timeline: [
          { date: iso(-15), type: '演练', title: '降级开关演练', detail: '真实拉闸一次' },
          { date: iso(-3), type: '风险', title: '峰值水位 78%', detail: '扩容立项通过' },
          { date: iso(3), type: '会议', title: '重保启动会', detail: '确认五阶段计划' },
        ],
        archive: { status: '未启动', owner: '赵启', docs: ['重保计划', '容量模型', '监管报告模板'], note: '' },
      }),
      customer({
        id: 's-cloud', name: 'S 云', short: 'S 云', industry: '互联网 · 云服务',
        tier: '成长', stage: '售前移交', stageKey: 'presales', health: 64, healthLabel: '关注',
        owner: '李衡', team: ['李衡', '我'], service: 'platform 云平台',
        region: '华南 · 广州', next: '售前承诺移交包', nextDate: dateOnly(3),
        renewal: dateOnly(330), arr: '¥3.1M',
        brief: '售前阶段承诺较多，需在项目导入前完成承诺盘点与边界确认。',
        topRisk: '售前承诺中 3 项超出标准服务范围',
        factors: [
          { label: '技术健康', score: 70, note: '架构方案待评审' },
          { label: '关系健康', score: 68, note: '新客户，信任建立中' },
          { label: '商业健康', score: 72, note: '首年合同已签' },
          { label: '服务健康', score: 52, note: '承诺移交未完成' },
        ],
        services: {
          plan: '云平台导入护航', sla: '99.9%', xla: '待定义',
          hours: '5×8 远程', renewal: dateOnly(330),
          scope: ['售前承诺移交', '架构评审', '导入计划', '知识转移'],
          entitlements: ['导入期 TAM', '架构评审 1 次', '月度回顾'],
        },
        tech: {
          architecture: '云原生平台 + 多租户',
          assets: [
            { name: 'platform-api', type: '平台 API', version: 'v2.0.0', status: '待评审' },
            { name: 'tenant-gateway', type: '租户网关', version: 'v1.4.0', status: '正常' },
          ],
          eol: [],
          config: ['多租户隔离', '配额策略待确认'],
        },
        risks: [
          { id: 'r-sc-1', title: '售前承诺超出标准范围', level: '高', owner: '李衡', status: '处理中', due: dateOnly(3), desc: '3 项承诺需产品与交付确认成本。' },
          { id: 'r-sc-2', title: 'XLA 尚未定义', level: '中', owner: '我', status: '待确认', due: dateOnly(10), desc: '导入前需与客户对齐关键体验指标。' },
        ],
        events: [],
        adoption: {
          metrics: [
            { label: '导入准备完成', value: '2/6', target: '6/6' },
            { label: '承诺盘点', value: '60%', target: '100%' },
            { label: '架构评审', value: '待排期', target: '完成' },
          ],
          ledger: [
            { item: '售前承诺盘点', value: '避免交付范围蔓延', date: iso(-2) },
          ],
          qbr: { date: dateOnly(45), status: '未排期' },
        },
        relations: [
          { name: '罗成', role: '平台负责人', stance: '支持', note: '关注上线时间' },
          { name: '叶琳', role: '采购负责人', stance: '中性', note: '关注合同边界' },
        ],
        signals: [
          { type: '扩容', title: '首年扩容意向', confidence: '低', date: iso(120), status: '观察' },
        ],
        timeline: [
          { date: iso(-10), type: '售前', title: '合同签署', detail: '首年平台服务' },
          { date: iso(-2), type: '会议', title: '承诺盘点', detail: '识别 3 项超范围承诺' },
        ],
        archive: { status: '准备中', owner: '李衡', docs: ['售前承诺清单', '合同', '架构方案'], note: '导入前完成移交' },
      }),
    ];
  }

  function task(id, title, customerId, owner, status, offset, priority, waitingOn, summary, dueHour) {
    return {
      id, title, customerId, owner, createdBy: '我', status,
      waitingOn: waitingOn || '', priority: priority || 'P2',
      due: offset === null ? null : iso(offset, dueHour === undefined ? 18 : dueHour),
      summary: summary || '', sourceType: 'task',
      acceptance: '客户/负责人确认结果，关键证据归档',
      timeline: [
        { date: iso(-2), text: '任务创建' },
        { date: iso(-1), text: status === 'open' ? '等待排期' : '已开始处理' },
      ],
      createdAt: iso(-2), updatedAt: iso(-1),
    };
  }

  function tasks() {
    return [
      task('t-001', '完成核心下移生产等比压测报告', 'h-bank', '我', 'in_progress', 2, 'P1', '', '压测覆盖峰值数据分布，形成闸门准入结论。'),
      task('t-002', '确认 Q3 容灾演练窗口', 'h-bank', '我', 'waiting', 5, 'P1', '客户', '与运维确认演练窗口和回退方案。'),
      task('t-003', '行情峰值容量模型评审', 'd-sec', '我', 'open', 1, 'P1', '', '把波动率 × 订单密度纳入容量输入。'),
      task('t-004', '补充 XLA 条款附件', 'd-sec', '陈默', 'waiting', 7, 'P2', '内部协作', '法务评估延迟指标的违约口径。'),
      task('t-005', '核验前任 workaround 清单', 'l-ins', '我', 'in_progress', -1, 'P1', '', '两处临时方案需逐项确认风险与处置。'),
      task('t-006', '第三方组件合规替换方案', 'l-ins', '王珂', 'waiting', 4, 'P2', '内部协作', '替换或取得授权，闭环前不得过上线闸门。'),
      task('t-007', '提交大促重保立项材料', 'p-pay', '我', 'submitted', 2, 'P1', '', '五阶段计划、值守排班与扩容窗口。'),
      task('t-008', '确认扩容变更窗口', 'p-pay', '赵启', 'waiting', 8, 'P2', '客户', '冻结窗口 T-21 前完成扩容并观察。'),
      task('t-009', '完成售前承诺移交包', 's-cloud', '李衡', 'waiting', 3, 'P2', '内部协作', '3 项超范围承诺需产品与交付确认。'),
      task('t-010', '准备 H 银行 QBR 材料', 'h-bank', '我', 'open', 20, 'P3', '', '服务回顾、价值账本与下季度计划。'),
      task('t-011', '补齐导入期监控盲区', 'l-ins', '林晓', 'open', -3, 'P2', '', '12 项监控补强，当前完成 7 项。'),
      task('t-012', '启动容量模型改造', 'd-sec', '我', 'open', 14, 'P2', '', '与交易平台团队共建峰值预测。'),
      task('t-013', '真实拉闸一次降级演练', 'p-pay', '我', 'open', 6, 'P1', '', '演练后更新降级预案与值守脚本。'),
      task('t-014', '建立 S 云客户 360 基线', 's-cloud', '我', 'done', -5, 'P3', '', '关键人、服务范围与风险基线已建立。'),
      task('t-015', '更新 H 银行服务计划', 'h-bank', '我', 'done', -8, 'P3', '', '纳入容灾演练与批处理优化。'),
      task('t-016', '安排新人影子值班', 'h-bank', '陈默', 'waiting', 3, 'P3', '内部协作', '林晓影子值班 2 次后独立值守。'),
      task('t-017', '确认 L 保险 90 天验收清单', 'l-ins', '我', 'open', 12, 'P1', '', '七项锚点逐项取证。'),
      task('t-018', '整理 P 支付监管口径报告', 'p-pay', '赵启', 'open', 9, 'P2', '', '按监管检查口径准备重保报告。'),
    ];
  }

  function serviceRecord(id, type, title, customerId, owner, status, offset, stage, summary, evidence, approval) {
    return {
      id, type, title, customerId, owner, status,
      due: iso(offset, 17), stage: stage || '处理中',
      summary: summary || '', evidence: evidence || '', approval: approval || '',
      timeline: [
        { date: iso(-3), text: '记录创建' },
        { date: iso(-1), text: `进入「${stage || '处理中'}」` },
      ],
      createdAt: iso(-3), updatedAt: iso(-1),
    };
  }

  function serviceRecords() {
    return [
      serviceRecord('s-001', 'architecture-review', '核心下移渠道层架构评审', 'h-bank', '我', '进行中', 2, '评审中', '渠道层灰度与同城双活方案评审。', '架构基线、压测报告', '待客户架构组确认'),
      serviceRecord('s-002', 'architecture-review', '清算链路容灾架构评审', 'p-pay', '赵启', '待审批', 4, '待审批', '清算链路多活与降级开关设计。', '容灾演练记录', '待 CTO 审批'),
      serviceRecord('s-003', 'product-onboarding', '寿险核心替换导入计划', 'l-ins', '我', '进行中', 10, '执行中', '二手项目导入 90 天计划与责任边界。', '导入计划、风险登记册', '客户项目办已签'),
      serviceRecord('s-004', 'product-onboarding', '售前承诺技术转移', 's-cloud', '李衡', '待启动', 8, '待启动', '3 项超范围承诺的技术边界确认。', '售前承诺清单', '待产品确认'),
      serviceRecord('s-005', 'go-live-gate', '极速交易新版本上线闸门', 'd-sec', '陈默', '待审批', 1, '待审批', '延迟指标与回退方案作为准入条件。', '压测报告、回退演练', '待客户技术负责人'),
      serviceRecord('s-006', 'go-live-gate', '批处理并行参数变更闸门', 'h-bank', '李衡', '进行中', 3, '评审中', '生产等比压测达标后放行。', '压测报告', '待 TAM 签署'),
      serviceRecord('s-007', 'risk-register', '批处理窗口余量风险', 'h-bank', '李衡', '高风险', 9, '处理中', '峰值余量仅 18%，需并行优化。', '容量评估报告', '需周会复审'),
      serviceRecord('s-008', 'risk-register', '第三方组件授权风险', 'l-ins', '王珂', '待验证', 4, '待验证', '替换或授权二选一。', '合规评估意见', '待法务确认'),
      serviceRecord('s-009', 'change-management', '大促扩容变更', 'p-pay', '赵启', '已排期', 6, '已排期', '冻结窗口前完成扩容与观察。', '变更单、扩容方案', '已审批'),
      serviceRecord('s-010', 'change-management', '行情网关配置变更', 'd-sec', '我', '待验证', 2, '待验证', '阈值与采样参数调整。', '变更单、监控截图', '待验证'),
      serviceRecord('s-011', 'major-assurance', '年度大促重保', 'p-pay', '赵启', '进行中', 8, '预案演练', '五阶段重保，L3 级保障。', '重保计划、演练记录', '待立项会签'),
      serviceRecord('s-012', 'major-assurance', 'Q3 容灾演练重保', 'h-bank', '我', '待启动', 11, '立项', '真实切换演练，L2 级保障。', '演练方案', '待客户确认窗口'),
      serviceRecord('s-013', 'capacity-availability', '行情峰值容量评估', 'd-sec', '我', '进行中', 5, '评估中', '波动率 × 订单密度模型。', '容量模型 v1', '待评审'),
      serviceRecord('s-014', 'capacity-availability', '核心系统容量水位复核', 'h-bank', '李衡', '待验证', 7, '待验证', '批处理与交易链路水位复核。', '容量报告', '待架构组确认'),
      serviceRecord('s-015', 'regulatory-calendar', '支付监管报送日历', 'p-pay', '赵启', '已发布', 12, '已发布', '年度监管检查与报送节点。', '监管日历', '合规已确认'),
      serviceRecord('s-016', 'regulatory-calendar', '寿险监管检查窗口', 'l-ins', '我', '待确认', 15, '待确认', '导入期需对齐监管检查窗口。', '监管通知', '待客户确认'),
      serviceRecord('s-017', 'notice-lifecycle', 'legacy-mq EOL 通告', 'h-bank', '李衡', '已发布', 30, '已发布', 'EOL 2027-01-31，需制定迁移计划。', '厂商通告', '已通知客户'),
      serviceRecord('s-018', 'notice-lifecycle', '行情网关版本生命周期', 'd-sec', '陈默', '进行中', 20, '跟踪中', 'v4.0 系列支持窗口与升级路径。', '版本矩阵', '待客户排期'),
      serviceRecord('s-019', 'duty-oncall', '大促值班排班', 'p-pay', '赵启', '已确认', 8, '已确认', 'M3 作战室值守，专家现场待命。', '排班表', '已确认'),
      serviceRecord('s-020', 'duty-oncall', 'H 银行 7×24 驻场值守', 'h-bank', '我', '进行中', 30, '执行中', '驻场 + 远程双通道。', '值守日志', '月度回顾'),
      serviceRecord('s-021', 'quality', 'H 银行月度服务质量复盘', 'h-bank', '我', '已完成', -4, '已关闭', '工单、SLA 与客户反馈复盘。', '服务报告', '客户已确认'),
      serviceRecord('s-022', 'quality', 'L 保险导入期质量评估', 'l-ins', '我', '进行中', 6, '评估中', '导入期响应与风险闭环评估。', '工单抽样', '待内部评审'),
    ];
  }

  function collabRecord(id, type, title, customerId, owner, status, offset, participants, decision, actions, related) {
    return {
      id, type, title, customerId, owner, status,
      date: iso(offset, 10), participants: participants || [], decision: decision || '',
      actions: actions || [], related: related || '', timeline: [{ date: iso(offset, 10), text: '记录创建' }],
      createdAt: iso(offset, 10), updatedAt: iso(offset, 10),
    };
  }

  function collabRecords() {
    return [
      collabRecord('c-001', 'iron-triangle', '核心护航铁三角例会', 'h-bank', '我', '进行中', 1, ['我', '李衡', '销售-周宁', '交付-王珂'], '批处理优化与容灾演练并行推进', ['压测报告 T+2', '演练窗口 T+5'], 'H 银行 Q3 容灾演练'),
      collabRecord('c-002', 'iron-triangle', '导入期铁三角周会', 'l-ins', '我', '进行中', 3, ['我', '王珂', '销售-周宁', '交付-林晓'], '合规组件优先，监控补强并行', ['合规方案 T+4', '监控补齐 T+10'], 'L 保险 90 天验收'),
      collabRecord('c-003', 'presales-handover', '售前承诺移交包', 's-cloud', '李衡', '待会签', 3, ['李衡', '销售-叶琳', '产品-罗成'], '3 项超范围承诺需产品确认', ['产品评估 T+2', '移交会 T+3'], ''),
      collabRecord('c-004', 'presales-handover', '极速交易二期移交', 'd-sec', '陈默', '已完成', -6, ['陈默', '销售-周宁', '交付-高远'], '二期扩容移交完成', ['容量模型交接', 'XLA 草案'], ''),
      collabRecord('c-005', 'product-feedback', '批处理并行参数需求', 'h-bank', '李衡', '已提交', -2, ['李衡', '产品-架构组'], '建议开放并行度动态调整', ['进入产品评审'], ''),
      collabRecord('c-006', 'product-feedback', 'XLA 延迟监控需求', 'd-sec', '陈默', '评审中', 2, ['陈默', '产品-可观测'], '需要微秒级延迟分位监控', ['补充指标口径'], ''),
      collabRecord('c-007', 'partner', '第三方组件合规评估', 'l-ins', '王珂', '进行中', 4, ['王珂', '伙伴-合规顾问', '法务'], '替换与授权双线评估', ['法务意见 T+2'], ''),
      collabRecord('c-008', 'partner', '清算组件伙伴协同', 'p-pay', '赵启', '进行中', 6, ['赵启', '伙伴-清算厂商'], '扩容窗口与版本兼容确认', ['伙伴现场支持'], ''),
      collabRecord('c-009', 'meeting-decisions', 'H 银行月度服务回顾', 'h-bank', '我', '已完成', -5, ['我', '刘敏', '陈涛'], '压测计划与演练窗口确认', ['压测 T+2', '演练 T+5'], ''),
      collabRecord('c-010', 'meeting-decisions', 'L 保险期望值重建工作坊', 'l-ins', '我', '已完成', -30, ['我', '马骏', '宋洁'], '共签 90 天可交付清单', ['责任边界书面化'], ''),
      collabRecord('c-011', 'qbr-ebr', 'H 银行 Q3 QBR', 'h-bank', '我', '待准备', 20, ['我', '张建国', '刘敏'], '服务回顾与扩容规划', ['准备价值账本'], ''),
      collabRecord('c-012', 'qbr-ebr', 'P 支付年度 EBR', 'p-pay', '赵启', '待准备', 18, ['赵启', '吴敏', '孙悦'], '重保与续约联合回顾', ['准备监管口径报告'], ''),
      collabRecord('c-013', 'vbr-value', 'H 银行批处理价值报告', 'h-bank', '我', '草稿', 14, ['我', '刘敏'], '窗口缩短 22% 的价值证明', ['补充成本口径'], ''),
      collabRecord('c-014', 'vbr-value', 'D 证券延迟优化价值账本', 'd-sec', '陈默', '已完成', -12, ['陈默', '许岚'], '避免 17 分钟延迟违约', ['纳入 QBR'], ''),
      collabRecord('c-015', 'renewal-signals', 'P 支付续约倒计时', 'p-pay', '赵启', '推进', 67, ['赵启', '销售-周宁'], '续约与扩容打包', ['合同 T+30'], ''),
      collabRecord('c-016', 'renewal-signals', 'L 保险流失预警', 'l-ins', '我', '预警', 24, ['我', '销售-周宁'], '验收延期将触发合同复审', ['验收清单 T+12'], ''),
    ];
  }

  function growthSeed() {
    return {
      goals: [
        { id: 'g-001', title: '完成 TAM 入门认证', target: '6 个模块 + 8 个案例', current: '4 个模块 / 6 个案例', due: dateOnly(30), status: '进行中', category: '能力', note: '优先完成日志与护栏模块。' },
        { id: 'g-002', title: '主导一次金融级重保', target: '独立担任重保值班长', current: '参与 2 次，主导 0 次', due: dateOnly(90), status: '进行中', category: '实践', note: '从 P 支付大促重保开始。' },
        { id: 'g-003', title: '沉淀 2 个团队 Skill', target: '从 trace 提取并评审通过', current: '1 个草稿', due: dateOnly(60), status: '未开始', category: '贡献', note: '优先批处理与容量模型。' },
      ],
      reviews: [
        { id: 'rv-001', date: iso(-14), reviewer: '陈默', type: '1:1', summary: '从“做事”转向“定义问题”，在客户会上多问一句业务影响。', actions: ['每次客户会输出 3 条决策记录', '下一次 QBR 由我主讲'] },
        { id: 'rv-002', date: iso(-45), reviewer: '陈默', type: '季度回顾', summary: '技术判断稳定，需加强商业语言与价值证明。', actions: ['完成价值账本模板', '跟练一次 EBR'] },
        { id: 'rv-003', date: iso(-90), reviewer: '李衡', type: '影子值班', summary: '事件响应流程熟悉，升级判断需更果断。', actions: ['复盘 3 个 P1 升级案例'] },
      ],
      time: [
        { id: 'tm-001', date: dateOnly(-3), type: '客户现场', hours: 8, note: 'H 银行压测评审', comp: 0 },
        { id: 'tm-002', date: dateOnly(-2), type: '重大保障', hours: 4, note: 'P 支付重保启动会', comp: 0 },
        { id: 'tm-003', date: dateOnly(-1), type: '加班', hours: 2.5, note: 'L 保险合规方案', comp: 2.5 },
        { id: 'tm-004', date: dateOnly(0), type: '学习', hours: 1.5, note: '容量模型案例', comp: 0 },
        { id: 'tm-005', date: dateOnly(-7), type: '值班', hours: 8, note: '周末值守', comp: 8 },
        { id: 'tm-006', date: dateOnly(-6), type: '客户现场', hours: 6, note: 'D 证券容量评审', comp: 0 },
      ],
      achievements: [
        { id: 'a-001', title: '批处理窗口缩短 22%', date: dateOnly(-45), type: '客户价值', evidence: 'H 银行性能报告', link: 'customer/h-bank' },
        { id: 'a-002', title: '极端行情 17 分钟恢复', date: dateOnly(-21), type: '事件处理', evidence: 'D 证券 RCA', link: 'incidents/rca' },
        { id: 'a-003', title: '导入期期望值重建', date: dateOnly(-30), type: '客户关系', evidence: 'L 保险工作坊纪要', link: 'customer/l-ins' },
        { id: 'a-004', title: '案例评审 3 次通过', date: dateOnly(-8), type: '团队贡献', evidence: '评审记录', link: 'growth/mentoring' },
      ],
      performance: {
        self: { '技术判断': 4, '客户影响': 4, '商业结果': 3, '团队贡献': 4, '执行质量': 4 },
        note: '本周期重点是把技术结果翻译成客户可感知的价值。',
      },
    };
  }

  function teamSeed() {
    return {
      members: [
        { id: 'm-001', name: '我', role: 'TAM', level: 'TAM II', customers: ['h-bank', 'l-ins'], modules: 4, cases: 6, skills: 5, load: 82, oncall: true },
        { id: 'm-002', name: '陈默', role: 'Mentor', level: 'TAM III', customers: ['d-sec'], modules: 6, cases: 10, skills: 8, load: 68, oncall: false },
        { id: 'm-003', name: '赵启', role: 'TAM', level: 'TAM II', customers: ['p-pay'], modules: 5, cases: 7, skills: 6, load: 76, oncall: true },
        { id: 'm-004', name: '李衡', role: 'TAM', level: 'TAM II', customers: ['s-cloud'], modules: 4, cases: 5, skills: 5, load: 61, oncall: false },
        { id: 'm-005', name: '林晓', role: 'TAM', level: 'TAM I', customers: [], modules: 2, cases: 2, skills: 2, load: 38, oncall: false },
      ],
      duty: [
        { day: '周一', primary: '我', backup: '陈默', window: '09:00–21:00' },
        { day: '周二', primary: '赵启', backup: '我', window: '09:00–21:00' },
        { day: '周三', primary: '李衡', backup: '赵启', window: '09:00–21:00' },
        { day: '周四', primary: '我', backup: '李衡', window: '09:00–21:00' },
        { day: '周五', primary: '陈默', backup: '林晓', window: '09:00–21:00' },
        { day: '周末', primary: '轮值', backup: '陈默', window: '7×24 待命' },
      ],
      feedback: [
        { id: 'f-001', member: '我', date: dateOnly(-14), type: '优势', note: '技术判断与客户信任建立稳定。' },
        { id: 'f-002', member: '我', date: dateOnly(-14), type: '改进', note: '商业语言与价值量化需要加强。' },
        { id: 'f-003', member: '林晓', date: dateOnly(-7), type: '培养', note: '安排 2 次影子值班后独立值守。' },
      ],
      pipeline: [
        { id: 'h-001', name: '候选人 A', stage: '二面', profile: '云原生 + 金融客户经验', next: '安排案例面试' },
        { id: 'h-002', name: '候选人 B', stage: '简历', profile: '可观测性 + 运维背景', next: '初筛' },
      ],
      certApplications: [
        { id: 'cert-001', member: '我', type: 'TAM 入门认证', status: '评审中', submitted: dateOnly(-5) },
        { id: 'cert-002', member: '赵启', type: 'TAM 实战认证', status: '待提交', submitted: null },
      ],
    };
  }

  function settingsSeed() {
    return {
      prefs: { defaultCustomer: 'all', startPage: 'home', density: 'compact', showDemo: true },
      sharing: { redaction: true, externalApproval: true, watermark: false },
      retention: { reportsDays: 365, tracesDays: 180, auditDays: 730 },
    };
  }

  const SIGNALS = [
    { id: 'sig-001', customerId: 'h-bank', level: '高', title: '批处理窗口余量不足', type: '风险', date: iso(0), owner: '李衡' },
    { id: 'sig-002', customerId: 'l-ins', level: '高', title: '第三方组件授权合规风险', type: '风险', date: iso(0), owner: '王珂' },
    { id: 'sig-003', customerId: 'd-sec', level: '中', title: '极端行情容量模型缺口', type: '风险', date: iso(-1), owner: '我' },
    { id: 'sig-004', customerId: 'p-pay', level: '中', title: '清算组件峰值水位 78%', type: '容量', date: iso(-3), owner: '赵启' },
    { id: 'sig-005', customerId: 'p-pay', level: '低', title: '年度续约与扩容推进', type: '商业', date: iso(3), owner: '赵启' },
    { id: 'sig-006', customerId: 'l-ins', level: '中', title: '导入验收延期将触发合同复审', type: '流失', date: iso(24), owner: '我' },
    { id: 'sig-007', customerId: 's-cloud', level: '中', title: '售前承诺超出标准范围', type: '承诺', date: iso(-2), owner: '李衡' },
    { id: 'sig-008', customerId: 'h-bank', level: '低', title: '二期扩容预算进入评审', type: '扩容', date: iso(7), owner: '我' },
  ];

  const SERVICE_PAGES = {
    'architecture-review': { title: '架构评审', template: '03-architecture-review-checklist', workflow: 'tool-03-architecture-review-checklist', book: 'ch10-project-change', note: '评审架构风险、容量、可用性与回退方案。' },
    'product-onboarding': { title: '产品导入与技术转移', template: '01-service-plan', workflow: 'tool-01-service-plan', book: 'ch11-customer-lifecycle', note: '把售前承诺转成可执行的服务计划与知识转移。' },
    'go-live-gate': { title: '上线闸门', template: '04-go-nogo-gate-checklist', workflow: 'tool-04-go-nogo-gate-checklist', book: 'ch17-financial-availability', note: '准入条件事前约定，证据驱动 Go/No-Go。' },
    'risk-register': { title: '风险登记册', template: '09-risk-register', workflow: 'tool-09-risk-register', book: 'ch09-risk-compliance', note: '登记风险、责任、期限与复审节奏。' },
    'change-management': { title: '变更管理', template: '18-change-request-record', workflow: 'tool-18-change-request-record', book: 'ch10-project-change', note: '变更三板斧、冻结纪律与回退验证。' },
    'major-assurance': { title: '重大保障', template: '05-major-assurance-checklist', workflow: 'tool-05-major-assurance-checklist', book: 'ch18-major-assurance', note: '立项、体检、预案演练、值守、复盘五阶段。' },
    'capacity-availability': { title: '容量与可用性', template: '10-customer-health-scorecard', workflow: 'practice-ch17-financial-availability', book: 'ch17-financial-availability', note: '用峰值标尺评估容量，按业务模式校准。' },
    'regulatory-calendar': { title: '业务与监管日历', template: '06-major-incident-communication-matrix', workflow: 'practice-ch16-financial-industry', book: 'ch16-financial-industry', note: '把监管窗口、业务峰值与冻结期放进同一张日历。' },
    'notice-lifecycle': { title: '通告与版本生命周期', template: '18-change-request-record', workflow: 'practice-ch10-project-change', book: 'appx-f-cloud-vendor-notices-2026', note: '跟踪厂商通告、EOL 与版本升级路径。' },
    'duty-oncall': { title: '值班与值守', template: '05-major-assurance-checklist', workflow: 'practice-ch18-major-assurance', book: 'ch18-major-assurance', note: '值守排班、升级路径与作战室运转。' },
    quality: { title: '服务质量', template: '15-tam-service-quality-scorecard', workflow: 'tool-15-tam-service-quality-scorecard', book: 'ch26-measurement-system', note: 'SLA、XLA、工单质量与客户反馈的综合评估。' },
  };

  const COLLAB_PAGES = {
    'iron-triangle': { title: '铁三角协同', template: '01-service-plan', workflow: 'practice-ch02-role-boundary-map', book: 'ch02-role-boundary-map', note: 'TAM、销售、交付的边界与接缝机制。' },
    'presales-handover': { title: '售前承诺与项目移交', template: '19-commitment-handover-kit', workflow: 'tool-19-commitment-handover-kit', book: 'ch13-internal-collaboration', note: '承诺盘点、责任边界与移交会签。' },
    'product-feedback': { title: '产品需求与反馈', template: '19-commitment-handover-kit', workflow: 'practice-ch13-internal-collaboration', book: 'ch13-internal-collaboration', note: '把客户问题转成可评审的产品输入。' },
    partner: { title: '伙伴协同', template: '01-service-plan', workflow: 'practice-ch14-partner-ecosystem', book: 'ch14-partner-ecosystem', note: '伙伴责任、升级路径与联合交付。' },
    'meeting-decisions': { title: '例会与决策记录', template: '06-major-incident-communication-matrix', workflow: 'practice-ch13-internal-collaboration', book: 'ch13-internal-collaboration', note: '会议结论、决策人与行动项。' },
    'qbr-ebr': { title: 'QBR／EBR', template: '08-qbr-ebr-template', workflow: 'tool-08-qbr-ebr-template', book: 'ch15-commercial-synergy', note: '季度/年度业务回顾与下阶段计划。' },
    'vbr-value': { title: 'VBR／价值报告', template: '10-customer-health-scorecard', workflow: 'practice-ch26-measurement-system', book: 'ch26-measurement-system', note: '用客户语言证明价值。' },
    'renewal-signals': { title: '续约、增购与流失信号', template: '19-commitment-handover-kit', workflow: 'practice-ch11-customer-lifecycle', book: 'ch11-customer-lifecycle', note: '到期前 180 天启动，经营信号进入统一台账。' },
  };

  const MAJOR_INCIDENTS = [
    { id: 'inc-001', title: 'H 银行批处理窗口逼近上限', customerId: 'h-bank', sev: 'P2', status: '处理中', commander: '我', started: iso(-1, 9), nextComm: '今日 18:00 客户通报', summary: '峰值数据量下窗口余量 18%，压测与并行参数调整并行。' },
    { id: 'inc-002', title: 'L 保险导入期监控盲区', customerId: 'l-ins', sev: 'P2', status: '监控中', commander: '王珂', started: iso(-2, 14), nextComm: '明日 10:00 内部复盘', summary: '12 项监控补强完成 7 项，观察期内保持升级通道。' },
  ];

  const IMPROVEMENTS = [
    { id: 'imp-001', incident: 'D 证券延迟劣化', title: '把行情模式纳入容量模型', customerId: 'd-sec', owner: '我', status: '进行中', due: dateOnly(14), evidence: '容量模型 v2 评审记录' },
    { id: 'imp-002', incident: 'L 保险导入期盲区', title: '导入期监控基线 12 项', customerId: 'l-ins', owner: '林晓', status: '待验证', due: dateOnly(10), evidence: '监控覆盖截图' },
    { id: 'imp-003', incident: 'H 银行批处理异常', title: '生产等比压测纳入闸门', customerId: 'h-bank', owner: '李衡', status: '已关闭', due: dateOnly(-2), evidence: '压测报告' },
    { id: 'imp-004', incident: 'P 支付峰值水位', title: '降级开关真实演练', customerId: 'p-pay', owner: '赵启', status: '进行中', due: dateOnly(6), evidence: '演练记录' },
  ];

  window.WSDATA = {
    WS_VERSION, WS_KEY, NAV, PAGE_TITLES, LIFECYCLE, SERVICE_PAGES, COLLAB_PAGES,
    MAJOR_INCIDENTS, IMPROVEMENTS, SIGNALS,
    seed: {
      customers: customers(),
      tasks: tasks(),
      service: serviceRecords(),
      collab: collabRecords(),
      growth: growthSeed(),
      team: teamSeed(),
      settings: settingsSeed(),
      investigationLinks: {},
      favorites: [],
      activeCustomer: 'all',
    },
    iso, dateOnly,
  };
})();
