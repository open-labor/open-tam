/* Open TAM enterprise workspace shell + core workbench pages. */
(function () {
  'use strict';
  const D = window.WSDATA;
  const ws = {
    data: null,
    route: 'home',
    param: '',
    activeNav: 'home',
    openGroups: new Set(['home']),
    teamData: null,
    teamLoaded: false,
    attempts: null,
    searchData: null,
    searchLoading: false,
    historyLoading: false,
    evalsLoading: false,
    lastSearch: '',
  };

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));
  const E = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };
  const clear = node => { if (node) node.replaceChildren(); };
  const clone = value => JSON.parse(JSON.stringify(value));
  const isMe = name => name === '我' || (state.me && name === state.me.username);
  const meName = () => (state.me && state.me.username) || '我';
  const nowIso = () => new Date().toISOString();
  const fmtDate = value => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  const fmtDay = value => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const daysUntil = value => {
    if (!value) return null;
    const due = new Date(value);
    if (Number.isNaN(due.getTime())) return null;
    const now = new Date();
    due.setHours(23, 59, 59, 999);
    return Math.ceil((due - now) / 86400000);
  };
  const priorityRank = p => ({ P1: 0, P2: 1, P3: 2 }[p] === undefined ? 3 : { P1: 0, P2: 1, P3: 2 }[p]);

  function id(prefix) {
    return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  }

  /* ---------- store ---------- */
  function seedData() {
    const data = clone(D.seed);
    data._version = D.WS_VERSION;
    return data;
  }
  function loadData() {
    try {
      const raw = localStorage.getItem(D.WS_KEY);
      if (!raw) return seedData();
      const parsed = JSON.parse(raw);
      if (!parsed || parsed._version !== D.WS_VERSION || !parsed.customers) return seedData();
      return parsed;
    } catch (error) {
      return seedData();
    }
  }
  function save() {
    try {
      ws.data._version = D.WS_VERSION;
      localStorage.setItem(D.WS_KEY, JSON.stringify(ws.data));
    } catch (error) {
      toast('本地工作区保存失败', 'error');
    }
    refreshBadges();
  }
  function resetWorkspace() {
    localStorage.removeItem(D.WS_KEY);
    ws.data = seedData();
    ensureCollections();
    save();
    renderNav();
    updateCustomerButton();
    toast('演示工作区已重置', 'ok');
    rerender();
  }
  function ensureCollections() {
    const d = ws.data;
    if (!Array.isArray(d.improvements)) d.improvements = clone(D.IMPROVEMENTS);
    if (!Array.isArray(d.majorIncidents)) d.majorIncidents = clone(D.MAJOR_INCIDENTS);
    if (!Array.isArray(d.promotions)) d.promotions = [];
    if (!Array.isArray(d.retros)) {
      d.retros = [
        { id: 'retro-001', title: 'D 证券延迟劣化复盘', customerId: 'd-sec', incident: '极端行情订单延迟劣化', owner: '陈默', date: D.iso(-18), status: '已完成', conclusions: ['SLA 全绿不等于服务达标', '容量模型需纳入行情模式'], actions: ['改造容量模型', 'XLA 写入合同附件'] },
        { id: 'retro-002', title: 'L 保险导入期监控盲区复盘', customerId: 'l-ins', incident: '导入期监控盲区', owner: '我', date: D.iso(-7), status: '进行中', conclusions: ['二手项目先补可观测性'], actions: ['监控补强 12 项', '观察期延长 30 天'] },
      ];
    }
    if (!Array.isArray(d.escalations)) {
      d.escalations = [
        { id: 'esc-001', title: 'H 银行批处理窗口风险升级', customerId: 'h-bank', level: 'P2', owner: '我', channel: '客户技术群 + 电话', date: D.iso(-1), status: '已通报', next: '今日 18:00 客户通报' },
        { id: 'esc-002', title: 'L 保险合规组件风险升级', customerId: 'l-ins', level: 'P1', owner: '王珂', channel: '内部升级 + 客户项目办', date: D.iso(-2), status: '处理中', next: '明日 10:00 法务意见' },
      ];
    }
    if (!Array.isArray(d.navFavorites)) d.navFavorites = [];
    if (!d.allocations || Array.isArray(d.allocations)) d.allocations = {};
    if (!d.growth.certApps) {
      d.growth.certApps = [
        { id: 'ga-001', type: 'TAM 入门认证', status: '评审中', submitted: D.dateOnly(-5) },
      ];
    }
    if (!d.growth.performanceNote) d.growth.performanceNote = d.growth.performance.note;
    if (!Array.isArray(d.contribution)) d.contribution = [];
  }

  /* ---------- lookups ---------- */
  const customerById = cid => ws.data.customers.find(item => item.id === cid);
  const customerName = cid => (customerById(cid) || {}).name || '—';
  const taskById = tid => ws.data.tasks.find(item => item.id === tid);
  const recordById = rid => ws.data.service.find(item => item.id === rid) || ws.data.collab.find(item => item.id === rid);
  const serviceType = key => D.SERVICE_PAGES[key];
  const collabType = key => D.COLLAB_PAGES[key];
  const activeCustomerId = () => ws.data.activeCustomer || 'all';
  const activeCustomer = () => (activeCustomerId() === 'all' ? null : customerById(activeCustomerId()));
  const defaultCustomerId = () => (activeCustomerId() === 'all' ? '' : activeCustomerId());
  const openLocalTasks = () => ws.data.tasks.filter(task => !['done', 'closed'].includes(task.status));
  const isOverdue = task => task.due && daysUntil(task.due) < 0 && !['done', 'closed'].includes(task.status);
  const dueSoon = (task, days) => task.due && daysUntil(task.due) >= 0 && daysUntil(task.due) <= days && !['done', 'closed'].includes(task.status);
  const statusLabel = status => ({
    open: '待处理', in_progress: '进行中', waiting: '等待中', submitted: '待验收',
    done: '已完成', closed: '已关闭', started: '进行中', completed: '已完成', reviewed: '已评审',
    '进行中': '进行中', '待审批': '待审批', '待验证': '待验证', '已关闭': '已关闭',
    '已完成': '已完成', '已排期': '已排期', '待启动': '待启动', '高风险': '高风险',
    '待会签': '待会签', '已提交': '已提交', '评审中': '评审中', '草稿': '草稿',
    '推进': '推进中', '预警': '预警', '监控中': '监控中', '处理中': '处理中',
    '待确认': '待确认', '已发布': '已发布', '已确认': '已确认', '跟踪中': '跟踪中',
  }[status] || status || '—');
  const statusKind = status => {
    if (['done', 'closed', 'completed', 'reviewed', '已完成', '已关闭', '已发布', '已确认', '健康'].includes(status)) return 'ok';
    if (['error', '高风险', '预警', '已逾期'].includes(status)) return 'crit';
    if (['running', 'in_progress', '进行中', '处理中', '待验证', '待审批', '待会签', '评审中', '监控中', '推进', '跟踪中', '待确认', '已排期', '评估中', '执行中', '待启动'].includes(status)) return 'warn';
    if (['submitted', '待验收', '待提交', '草稿', '未开始', '待处理'].includes(status)) return 'info';
    return 'muted';
  };

  /* ---------- components ---------- */
  function btn(text, onclick, cls) {
    const b = E('button', `btn ${cls || 'ghost'}`, text);
    b.type = 'button';
    if (onclick) b.addEventListener('click', onclick);
    return b;
  }
  function link(text, href, cls) {
    const a = E('a', cls || null, text);
    a.href = href;
    return a;
  }
  function badge(text, kind) {
    return E('span', `ws-status ${kind || ''}`.trim(), text);
  }
  function status(status) {
    return badge(statusLabel(status), statusKind(status));
  }
  function kpis(items) {
    const box = E('div', 'ws-kpis');
    items.forEach(item => {
      const cell = E('div', `ws-kpi ${item.kind || ''}`.trim());
      cell.appendChild(E('div', 'label', item.label));
      const value = E('div', 'value');
      value.appendChild(document.createTextNode(String(item.value)));
      if (item.unit) value.appendChild(E('small', null, ` ${item.unit}`));
      cell.appendChild(value);
      if (item.sub) cell.appendChild(E('div', 'sub', item.sub));
      box.appendChild(cell);
    });
    return box;
  }
  function panel(title, meta, body, opts) {
    const box = E('section', `ws-panel ${(opts && opts.cls) || ''}`.trim());
    if (title) {
      const head = E('div', 'ws-panel-head');
      head.appendChild(E('h3', null, title));
      if (meta) head.appendChild(typeof meta === 'string' ? E('span', 'meta', meta) : meta);
      box.appendChild(head);
    }
    if (opts && opts.sub) box.appendChild(E('div', 'ws-panel-sub', opts.sub));
    if (body) box.appendChild(body);
    return box;
  }
  function empty(title, hint, action) {
    const box = E('div', 'empty-state');
    box.appendChild(E('div', 'empty-title', title));
    if (hint) box.appendChild(E('div', 'hint', hint));
    if (action) {
      const wrap = E('div');
      wrap.style.marginTop = '10px';
      wrap.appendChild(action);
      box.appendChild(wrap);
    }
    return box;
  }
  function meter(value, kind) {
    const wrap = E('div', `ws-meter ${kind || ''}`.trim());
    const fill = E('div');
    fill.style.width = `${Math.max(0, Math.min(100, Number(value) || 0))}%`;
    wrap.appendChild(fill);
    return wrap;
  }
  function meterRow(label, value, kind) {
    const row = E('div', 'ws-meter-row');
    row.appendChild(E('span', 'label', label));
    row.appendChild(meter(value, kind));
    row.appendChild(E('span', 'val', `${Math.round(Number(value) || 0)}`));
    return row;
  }
  function table(headers, rows, onRow) {
    const wrap = E('div', 'ws-table');
    const t = E('table');
    const thead = E('thead');
    const tr = E('tr');
    headers.forEach(h => tr.appendChild(E('th', null, h)));
    thead.appendChild(tr);
    t.appendChild(thead);
    const tbody = E('tbody');
    rows.forEach(row => {
      const r = E('tr');
      if (row.__cls) r.className = row.__cls;
      if (row.__href) r.dataset.href = row.__href;
      (row.cells || row).forEach(cell => {
        const td = E('td');
        if (cell && cell.nodeType) td.appendChild(cell);
        else if (cell && typeof cell === 'object') {
          if (cell.cls) td.className = cell.cls;
          if (cell.node) td.appendChild(cell.node);
          else if (cell.text !== undefined) td.textContent = String(cell.text);
          else td.textContent = '—';
        } else {
          td.textContent = cell === undefined || cell === null ? '—' : String(cell);
        }
        r.appendChild(td);
      });
      if (row.__onclick) {
        r.addEventListener('click', row.__onclick);
        r.tabIndex = 0;
        r.setAttribute('role', 'link');
        r.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); row.__onclick(); }
        });
      } else if (onRow && !row.__href) {
        r.addEventListener('click', () => onRow(row));
      }
      if (row.__href) {
        r.addEventListener('click', () => { location.hash = row.__href; });
        r.tabIndex = 0;
        r.setAttribute('role', 'link');
        r.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); location.hash = row.__href; }
        });
      }
      tbody.appendChild(r);
    });
    t.appendChild(tbody);
    wrap.appendChild(t);
    return wrap;
  }
  function timeline(items) {
    const box = E('div', 'ws-timeline');
    if (!items.length) box.appendChild(E('div', 'hint', '暂无记录'));
    items.forEach(item => {
      const row = E('div', 'ws-tl-item');
      row.appendChild(E('div', 'tl-date', fmtDate(item.date || item.created_at)));
      const title = E('div', 'tl-title');
      if (item.type) title.appendChild(E('span', 'tl-type', item.type));
      title.appendChild(document.createTextNode(item.title || item.text || '记录'));
      row.appendChild(title);
      if (item.detail) row.appendChild(E('div', 'tl-detail', item.detail));
      box.appendChild(row);
    });
    return box;
  }
  function row(opts) {
    const r = E('div', 'ws-row');
    if (opts.grid) r.style.gridTemplateColumns = opts.grid;
    if (opts.onclick) {
      r.style.cursor = 'pointer';
      r.addEventListener('click', opts.onclick);
      r.tabIndex = 0;
      r.setAttribute('role', 'link');
      r.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); opts.onclick(); }
      });
    }
    const main = E('div', 'ws-row-main');
    const title = E('span', 'ws-row-title');
    if (opts.href) {
      const a = E('a', null, opts.title);
      a.href = opts.href;
      title.appendChild(a);
    } else {
      title.textContent = opts.title;
    }
    main.appendChild(title);
    if (opts.sub) main.appendChild(E('span', 'ws-row-sub', opts.sub));
    r.appendChild(main);
    if (opts.leading) r.insertBefore(opts.leading, main);
    if (opts.meta) r.appendChild(E('span', 'ws-row-meta', opts.meta));
    if (opts.action) {
      const wrap = E('div', 'ws-row-action');
      if (opts.action.nodeType) wrap.appendChild(opts.action);
      else wrap.appendChild(opts.action);
      r.appendChild(wrap);
    }
    return r;
  }
  function pageHead(title, sub, actions) {
    const head = E('div', 'ws-page-head');
    const left = E('div');
    left.appendChild(E('h2', null, title));
    if (sub) left.appendChild(E('p', null, sub));
    head.appendChild(left);
    const right = E('div', 'ws-head-actions');
    (actions || []).forEach(action => right.appendChild(action));
    right.appendChild(favoriteButton());
    head.appendChild(right);
    return head;
  }
  function favoriteButton() {
    const key = ws.activeNav;
    if (!key) {
      const b = btn('总览', null, 'ghost small');
      b.disabled = true;
      return b;
    }
    const found = navIndex()[key];
    const on = ws.data.navFavorites.includes(key);
    const b = btn(on ? '已收藏' : '收藏', () => toggleNavFavorite(key), 'ghost small');
    b.title = found ? `收藏：${found.label}` : '收藏当前页面';
    return b;
  }
  function toggleNavFavorite(key) {
    const list = ws.data.navFavorites;
    const index = list.indexOf(key);
    if (index >= 0) list.splice(index, 1);
    else list.push(key);
    save();
    renderNav();
    rerender();
  }

  /* ---------- nav ---------- */
  function navIndex() {
    const map = {};
    D.NAV.forEach(group => {
      group.items.forEach(item => {
        map[item.id] = Object.assign({ group: group.id, groupLabel: group.label }, item);
        (item.children || []).forEach(child => {
          map[child.id] = Object.assign({ group: group.id, groupLabel: group.label, parent: item.id }, child);
        });
      });
    });
    return map;
  }
  function canManageTeam() {
    if (state.me) return ['admin', 'mentor'].includes(state.me.role);
    return !state.config?.auth_enabled;
  }
  function renderNav() {
    const root = $('#nav-root');
    if (!root) return;
    clear(root);
    const idx = navIndex();
    const favorites = ws.data.navFavorites.map(key => idx[key]).filter(Boolean);
    if (favorites.length) {
      const fav = E('div', 'ws-fav');
      fav.appendChild(E('div', 'ws-fav-head', '收藏'));
      favorites.forEach(item => {
        const b = E('button', 'nav-item', item.label);
        b.type = 'button';
        b.dataset.nav = item.id;
        b.addEventListener('click', () => navigate(item.route));
        fav.appendChild(b);
      });
      root.appendChild(fav);
    }
    const active = activeIncidents();
    if (active.length) {
      const pinned = E('div', 'ws-fav ws-pinned');
      pinned.appendChild(E('div', 'ws-fav-head', '进行中'));
      const b = E('button', 'nav-item', active.length === 1 ? `作战室 · ${active[0].title}` : `作战室 · ${active.length} 个进行中事件`);
      b.type = 'button';
      b.dataset.nav = 'war-room';
      b.dataset.route = 'war-room';
      b.appendChild(E('span', 'ws-nav-badge warn', String(active.length)));
      b.addEventListener('click', () => navigate('war-room'));
      pinned.appendChild(b);
      root.appendChild(pinned);
    }
    D.NAV.forEach(group => {
      const box = E('div', `ws-group${ws.openGroups.has(group.id) ? ' open' : ''}`);
      box.dataset.group = group.id;
      if (group.managerOnly && !canManageTeam()) box.classList.add('ws-team-hidden');
      const head = E('button', 'ws-group-head');
      head.type = 'button';
      head.setAttribute('aria-expanded', ws.openGroups.has(group.id) ? 'true' : 'false');
      head.appendChild(E('span', 'code', group.code));
      head.appendChild(E('span', 'label', group.label));
      head.appendChild(E('span', 'chev'));
      head.addEventListener('click', () => {
        if (ws.openGroups.has(group.id)) ws.openGroups.delete(group.id);
        else ws.openGroups.add(group.id);
        box.classList.toggle('open', ws.openGroups.has(group.id));
        head.setAttribute('aria-expanded', ws.openGroups.has(group.id) ? 'true' : 'false');
      });
      box.appendChild(head);
      const items = E('div', 'ws-group-items');
      group.items.forEach(item => {
        const b = E('button', 'nav-item', item.label);
        b.type = 'button';
        b.dataset.nav = item.id;
        b.dataset.route = item.route;
        b.appendChild(badgeSlot(item.id));
        b.addEventListener('click', () => navigate(item.route));
        items.appendChild(b);
        if (item.children) {
          const sub = E('div', 'ws-subitems');
          item.children.forEach(child => {
            const c = E('button', 'nav-item', child.label);
            c.type = 'button';
            c.dataset.nav = child.id;
            c.dataset.route = child.route;
            c.addEventListener('click', () => navigate(child.route));
            sub.appendChild(c);
          });
          items.appendChild(sub);
        }
      });
      box.appendChild(items);
      root.appendChild(box);
    });
    refreshBadges();
    if (ws.activeNav) highlightNav(ws.activeNav, false);
  }
  function badgeSlot(key) {
    const span = E('span', 'ws-nav-badge hidden');
    span.dataset.badge = key;
    return span;
  }
  function highlightNav(navId, scroll) {
    $$('#nav-root .nav-item').forEach(item => {
      if (item.dataset.nav === navId) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
    const idx = navIndex();
    const item = idx[navId];
    if (item) {
      const group = item.group;
      if (!ws.openGroups.has(group)) {
        ws.openGroups.add(group);
        const box = $(`#nav-root .ws-group[data-group="${group}"]`);
        if (box) {
          box.classList.add('open');
          const head = $('.ws-group-head', box);
          if (head) head.setAttribute('aria-expanded', 'true');
        }
      }
    } else if (navId === 'war-room') {
      ws.openGroups.add('incidents');
      const box = $('#nav-root .ws-group[data-group="incidents"]');
      if (box) {
        box.classList.add('open');
        const head = $('.ws-group-head', box);
        if (head) head.setAttribute('aria-expanded', 'true');
      }
    }
    ws.activeNav = navId;
    if (scroll) {
      const node = $(`#nav-root .nav-item[data-nav="${navId}"]`);
      if (node) node.scrollIntoView({ block: 'nearest' });
    }
  }
  function navForExisting(route, param) {
    if (route === 'book') {
      const slug = param || '';
      if (slug.startsWith('appx-a')) return 'knowledge-glossary';
      if (slug.startsWith('appx-e')) return 'knowledge-contribution';
      if (slug.startsWith('appx-f')) return 'knowledge-notices';
      if (/^\d{2}-/.test(slug)) return 'knowledge-templates';
      return 'knowledge-standards';
    }
    return ({
      path: 'growth-learning', cases: 'knowledge-cases', case: 'knowledge-cases',
      workflows: 'knowledge-playbooks', 'workflow-run': 'knowledge-playbooks',
      workbench: 'incidents-major', 'war-room': 'incidents-major',
      history: 'incidents-tickets', team: 'team-overview', skills: 'growth-capability',
      evals: 'settings-metrics',
    })[route] || null;
  }
  function setActiveNav(key) {
    const idx = navIndex();
    if (idx[key]) { highlightNav(key, false); return true; }
    const param = location.hash.replace(/^#/, '').split('/').slice(1).join('/');
    const mapped = navForExisting(key, param);
    if (mapped && idx[mapped]) { highlightNav(mapped, false); return true; }
    return false;
  }
  function clearNavHighlight() {
    $$('#nav-root .nav-item').forEach(item => item.removeAttribute('aria-current'));
    ws.activeNav = '';
  }
  function refreshBadges() {
    if (!ws.data) return;
    const activeCount = activeIncidents().length;
    if (ws._activeCount !== undefined && ws._activeCount !== activeCount) {
      setTimeout(() => renderNav(), 0);
    }
    ws._activeCount = activeCount;
    const counts = {
      'tasks-overdue': openLocalTasks().filter(isOverdue).length,
      'incidents-major': activeCount,
      'team-overview': pendingReviews().length,
    };
    $$('#nav-root [data-badge]').forEach(node => {
      const value = counts[node.dataset.badge] || 0;
      node.textContent = value > 99 ? '99+' : String(value);
      node.classList.toggle('hidden', !value);
      node.classList.toggle('warn', node.dataset.badge === 'tasks-overdue');
    });
    const notif = $('#ws-notif-count');
    if (notif) {
      const total = notificationItems().length;
      notif.textContent = total > 99 ? '99+' : String(total);
      notif.classList.toggle('hidden', !total);
    }
  }

  /* ---------- global overlays ---------- */
  function ensureOverlays() {
    if ($('#ws-backdrop')) return;
    const backdrop = E('div', 'ws-backdrop');
    backdrop.id = 'ws-backdrop';
    document.body.appendChild(backdrop);
    const palette = E('div', 'ws-palette');
    palette.id = 'ws-palette';
    palette.setAttribute('role', 'dialog');
    palette.setAttribute('aria-modal', 'true');
    palette.setAttribute('aria-label', '全局搜索');
    palette.innerHTML = '<input class="ws-palette-input" id="ws-palette-input" type="search" placeholder="搜索客户、任务、章节、流程、案例或页面" aria-label="全局搜索"><div class="ws-palette-results" id="ws-palette-results"></div><div class="ws-palette-foot"><span>Enter 打开首个结果</span><span>Esc 关闭</span></div>';
    document.body.appendChild(palette);
    const modal = E('div', 'ws-modal');
    modal.id = 'ws-modal';
    document.body.appendChild(modal);
    const drawer = E('div', 'ws-drawer');
    drawer.id = 'ws-drawer';
    document.body.appendChild(drawer);
    const menu = E('div', 'ws-menu');
    menu.id = 'ws-menu';
    document.body.appendChild(menu);
  }
  function closeOverlays() {
    $('#ws-backdrop')?.classList.remove('show');
    $('#ws-palette')?.classList.remove('show');
    $('#ws-modal')?.classList.remove('show');
    $('#ws-drawer')?.classList.remove('show');
    $('#ws-menu')?.classList.remove('show');
    $$('#ws-menu button').forEach(b => b.remove());
  }
  function showBackdrop() { $('#ws-backdrop')?.classList.add('show'); }
  function openModal(title, body, actions, width) {
    closeOverlays();
    showBackdrop();
    const modal = $('#ws-modal');
    if (!modal) return;
    if (width) modal.style.width = width;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', title);
    clear(modal);
    const head = E('div', 'ws-modal-head');
    head.appendChild(E('h2', null, title));
    const close = E('button', 'ws-icon-btn', '✕');
    close.type = 'button';
    close.addEventListener('click', closeOverlays);
    head.appendChild(close);
    modal.appendChild(head);
    const bodyBox = E('div', 'ws-modal-body');
    if (body && body.nodeType) bodyBox.appendChild(body);
    else if (typeof body === 'string') bodyBox.innerHTML = body;
    modal.appendChild(bodyBox);
    const foot = E('div', 'ws-modal-foot');
    (actions || []).forEach(action => foot.appendChild(action));
    modal.appendChild(foot);
    modal.classList.add('show');
    return modal;
  }
  function openDrawer(title, body, foot) {
    closeOverlays();
    showBackdrop();
    const drawer = $('#ws-drawer');
    if (!drawer) return;
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-label', title);
    clear(drawer);
    const head = E('div', 'ws-drawer-head');
    head.appendChild(E('h2', null, title));
    const close = E('button', 'ws-icon-btn', '✕');
    close.type = 'button';
    close.addEventListener('click', closeOverlays);
    head.appendChild(close);
    drawer.appendChild(head);
    const bodyBox = E('div', 'ws-drawer-body');
    if (body && body.nodeType) bodyBox.appendChild(body);
    else bodyBox.innerHTML = body || '';
    drawer.appendChild(bodyBox);
    if (foot) {
      const footBox = E('div', 'ws-drawer-foot');
      (foot || []).forEach(action => footBox.appendChild(action));
      drawer.appendChild(footBox);
    }
    drawer.classList.add('show');
    return drawer;
  }
  function openMenu(anchor, items) {
    closeOverlays();
    showBackdrop();
    const menu = $('#ws-menu');
    if (!menu) return;
    items.forEach(item => {
      const b = E('button');
      b.type = 'button';
      b.appendChild(E('span', null, item.label));
      if (item.key) b.appendChild(E('span', 'k', item.key));
      b.addEventListener('click', () => { closeOverlays(); item.onclick(); });
      menu.appendChild(b);
    });
    const rect = anchor.getBoundingClientRect();
    menu.style.top = `${Math.round(rect.bottom + 4)}px`;
    menu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 240))}px`;
    menu.classList.add('show');
  }

  /* ---------- customer switcher ---------- */
  function updateCustomerButton() {
    const button = $('#ws-customer-btn');
    if (!button) return;
    const active = activeCustomer();
    const name = button.querySelector('.ws-customer-name');
    if (name) name.textContent = active ? active.name : '全部客户';
    const chip = $('#ws-context-customer');
    if (chip) chip.textContent = active ? active.name : '全部客户';
  }
  function openCustomerMenu(anchor) {
    const items = [{
      label: '全部客户', key: `${ws.data.customers.length}`,
      onclick: () => selectCustomer('all'),
    }].concat(ws.data.customers.map(c => ({
      label: `${c.name} · ${c.stage}`, key: c.health,
      onclick: () => selectCustomer(c.id),
    })));
    items.push({ label: '客户列表', key: '→', onclick: () => navigate('customers') });
    openMenu(anchor, items);
  }
  function selectCustomer(cid) {
    ws.data.activeCustomer = cid;
    save();
    updateCustomerButton();
    toast(cid === 'all' ? '客户上下文：全部客户' : `客户上下文：${customerName(cid)}`, 'ok');
    rerender();
  }

  /* ---------- search ---------- */
  async function ensureSearchData() {
    if (ws.searchData || ws.searchLoading) return;
    ws.searchLoading = true;
    try {
      await loadCatalog();
      await Promise.all([
        (async () => { try { await loadBook(); } catch (e) { /* auth */ } })(),
        (async () => { try { await loadWorkflowCatalog(); } catch (e) { /* auth */ } })(),
        (async () => { try { await loadHistory(); } catch (e) { /* auth */ } })(),
        (async () => { try { await loadSkills(); } catch (e) { /* auth */ } })(),
      ]);
      ws.searchData = {
        book: state.book, workflows: state.workflowCatalog,
        cases: CASE_CATALOG, modules: MODULES, skills: SKILL_CATALOG,
      };
    } finally {
      ws.searchLoading = false;
    }
  }
  function searchResults(query) {
    const q = query.trim().toLowerCase();
    const out = [];
    const add = (group, title, sub, href, tag) => {
      if (q && !(`${title} ${sub || ''} ${tag || ''}`.toLowerCase().includes(q))) return;
      out.push({ group, title, sub, href, tag });
    };
    const idx = navIndex();
    Object.values(idx).forEach(item => add('页面', item.label, item.groupLabel, `#${item.route}`, 'GO'));
    ws.data.customers.forEach(c => add('客户', c.name, `${c.industry} · ${c.stage} · 健康 ${c.health}`, `#customer/${c.id}`, c.tier));
    ws.data.tasks.forEach(t => add('任务', t.title, `${customerName(t.customerId)} · ${t.owner} · ${statusLabel(t.status)}`, `#task/${t.id}`, t.priority));
    (state.history || []).forEach(h => add('事件', h.root_cause || h.alert_id || h.id, `${h.status} · ${fmtDate(h.created_at)}`, `#event/${h.id}`, 'CASE'));
    if (ws.searchData) {
      (ws.searchData.book?.parts || []).forEach(part => (part.documents || []).forEach(doc => add('手册', doc.title, `${doc.number} · ${part.title}`, `#book/${doc.slug}`, doc.kind)));
      (ws.searchData.workflows?.stages || []).forEach(stage => (stage.workflows || []).forEach(wf => add('流程', wf.title, `${stage.title} · ${wf.step_count} 步`, `#workflows/${wf.id}`, wf.kind_label)));
      (ws.searchData.cases || []).forEach(c => add('案例', c.title, `${c.category} · ${c.level}`, `#case/${c.name}`, c.kind));
      (ws.searchData.modules || []).forEach(m => add('模块', m.title, m.goal, '#path', m.level));
      (ws.searchData.skills || []).forEach(s => add('Skill', s.name, s.description, '#skills', s.category));
    }
    return out.slice(0, 40);
  }
  function openPalette() {
    closeOverlays();
    ensureOverlays();
    showBackdrop();
    const palette = $('#ws-palette');
    palette.classList.add('show');
    const input = $('#ws-palette-input');
    input.value = '';
    input.focus();
    renderPalette('');
    ensureSearchData().then(() => renderPalette(input.value));
  }
  function renderPalette(query) {
    const box = $('#ws-palette-results');
    if (!box) return;
    clear(box);
    const results = searchResults(query);
    let lastGroup = '';
    results.forEach(item => {
      if (item.group !== lastGroup) {
        box.appendChild(E('div', 'ws-palette-group', item.group));
        lastGroup = item.group;
      }
      const b = E('button', 'ws-palette-row');
      b.type = 'button';
      b.appendChild(E('span', 'tag', item.tag || '·'));
      const main = E('span', 'main');
      main.appendChild(E('span', 'title', item.title));
      if (item.sub) main.appendChild(E('span', 'sub', item.sub));
      b.appendChild(main);
      b.appendChild(E('span', 'go', '↵'));
      b.addEventListener('click', () => {
        closeOverlays();
        location.hash = item.href.replace(/^#/, '');
      });
      box.appendChild(b);
    });
    if (!results.length) {
      box.appendChild(E('div', 'ws-palette-group', ws.searchLoading ? '加载索引…' : '没有匹配结果'));
    }
  }

  /* ---------- notifications / assistant ---------- */
  function notificationItems() {
    const items = [];
    openLocalTasks().filter(isOverdue).forEach(t => items.push({
      title: t.title, sub: `已逾期 · ${customerName(t.customerId)}`, href: `task/${t.id}`, kind: 'crit', tag: '逾期',
      meta: `D+${Math.abs(daysUntil(t.due))}`,
    }));
    openLocalTasks().filter(t => dueSoon(t, 3)).forEach(t => items.push({
      title: t.title, sub: `${daysUntil(t.due)} 天内到期 · ${customerName(t.customerId)}`, href: `task/${t.id}`, kind: 'warn', tag: '到期',
      meta: `D-${daysUntil(t.due)}`,
    }));
    pendingReviews().forEach(a => items.push({
      title: `案例待评审 · ${a.case_id}`, sub: `评分 ${a.score === null || a.score === undefined ? '—' : Number(a.score).toFixed(2)}`, href: 'team/quality', kind: 'info', tag: '评审',
      meta: 'REVIEW',
    }));
    activeIncidents().forEach(i => items.push({
      title: i.title, sub: `${i.sev} · ${i.status}`, href: `event/${i.id}`, kind: 'crit', tag: '事件',
      meta: i.sev,
    }));
    D.SIGNALS.filter(s => s.level === '高').forEach(s => items.push({
      title: s.title, sub: `${customerName(s.customerId)} · ${s.type}`, href: `customer/${s.customerId}/signals`, kind: 'warn', tag: '信号',
      meta: 'HIGH',
    }));
    return items.slice(0, 20);
  }
  function openNotifications() {
    const body = E('div');
    const items = notificationItems();
    if (!items.length) body.appendChild(empty('没有新的通知', '任务、事件与风险信号会在这里汇总。'));
    items.forEach(item => {
      const r = row({
        title: item.title, sub: item.sub, meta: item.meta || item.tag,
        action: status(item.tag === '逾期' ? '已逾期' : item.tag === '事件' ? '处理中' : '待处理', item.kind),
        onclick: () => { closeOverlays(); navigate(item.href); },
      });
      body.appendChild(r);
    });
    openDrawer('通知中心', body, [btn('查看任务中心', () => { closeOverlays(); navigate('tasks'); }, 'ghost small')]);
  }

  function assistantContext() {
    const c = activeCustomer();
    const incident = activeIncidents()[0];
    const tasks = openLocalTasks().filter(t => !c || t.customerId === c.id);
    return { customer: c, incident, tasks };
  }
  function assistantReply(prompt) {
    const text = (prompt || '').trim();
    const ctx = assistantContext();
    const c = ctx.customer;
    if (!text) {
      return c
        ? `${c.name}｜${c.stage}｜健康 ${c.health}\n${c.brief}\n最高风险：${c.topRisk}\n下一节点：${c.next}（${fmtDay(c.nextDate)}）`
        : `当前有 ${openLocalTasks().length} 个未关闭任务，${activeIncidents().length} 个进行中事件。选择客户切换器后，我可以按客户汇总风险与下一步。`;
    }
    if (/告警|排查|事件/.test(text)) {
      return `已准备进入排查工作台。你可以粘贴告警 JSON 或选择案例；当前${c ? `客户上下文为 ${c.name}` : '未选择客户'}。`;
    }
    if (/简报|QBR|价值/.test(text)) {
      return c
        ? `${c.name} 简报骨架：现状（${c.stage}）、健康（${c.health}）、最高风险（${c.topRisk}）、下一节点（${c.next}）、价值账本（${c.adoption.ledger[0]?.item || '待补充'}）。`
        : '先在顶部选择客户，再生成简报或 QBR 材料。';
    }
    if (/总结|客户|风险/.test(text)) {
      return c
        ? `${c.name}｜${c.stage}｜健康 ${c.health}\n${c.brief}\n最高风险：${c.topRisk}\n下一节点：${c.next}（${fmtDay(c.nextDate)}）`
        : `当前有 ${ws.data.customers.length} 个客户，${ws.data.customers.filter(x => x.health < 70).length} 个健康分低于 70。先在顶部选择客户，我可以给出单客户摘要。`;
    }
    if (/下一步|做什么|优先/.test(text)) {
      const next = ctx.tasks.slice().sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority))[0];
      return next
        ? `建议先处理：${next.title}（${next.priority}，${customerName(next.customerId)}）。原因：${next.summary || '影响当前客户节点'}。`
        : '当前没有未关闭任务。建议检查风险与信号，或推进一个学习案例。';
    }
    return '我可以基于当前工作区汇总客户、任务、事件与成长进度，并把动作带到对应页面。试试“总结当前客户”“下一步做什么”“准备简报”。';
  }
  function openAssistant() {
    const body = E('div');
    const ctx = assistantContext();
    const summary = E('div', 'ws-assist-block');
    summary.appendChild(E('div', 'label', '当前上下文'));
    const p = E('p');
    p.textContent = ctx.customer
      ? `${ctx.customer.name} · ${ctx.customer.stage} · 健康 ${ctx.customer.health} · ${ctx.customer.next}`
      : `${openLocalTasks().length} 个待办 · ${activeIncidents().length} 个进行中事件 · ${ws.data.customers.length} 个客户`;
    summary.appendChild(p);
    body.appendChild(summary);
    const actions = E('div', 'ws-assist-actions');
    [
      ['总结当前客户', () => reply(assistantReply('总结当前客户'))],
      ['给出下一步动作', () => reply(assistantReply('下一步做什么'))],
      ['准备客户简报', () => { closeOverlays(); if (ctx.customer) customerBrief(ctx.customer); else toast('请先选择客户', 'error'); }],
      ['进入作战室', () => { closeOverlays(); navigate('war-room'); }],
      ['浏览能力路径', () => { closeOverlays(); navigate('growth/learning'); }],
    ].forEach(([label, fn]) => {
      const b = E('button');
      b.type = 'button';
      b.textContent = label;
      b.addEventListener('click', fn);
      actions.appendChild(b);
    });
    body.appendChild(actions);
    const replyBox = E('div', 'ws-assist-reply');
    replyBox.style.display = 'none';
    body.appendChild(replyBox);
    function reply(text) {
      replyBox.textContent = text;
      replyBox.style.display = 'block';
    }
    const input = E('textarea', 'ws-assist-input');
    input.placeholder = '问：当前客户最大的风险是什么？下一步先做什么？';
    body.appendChild(E('div', 'ws-panel-sub', '本地上下文助手'));
    body.appendChild(input);
    const foot = [
      btn('发送', () => reply(assistantReply(input.value)), 'primary small'),
      btn('清空', () => { input.value = ''; replyBox.style.display = 'none'; }, 'ghost small'),
    ];
    openDrawer('AI 助手', body, foot);
  }

  /* ---------- task creation ---------- */
  function formField(label, node, full) {
    const field = E('div', `ws-field${full ? ' full' : ''}`);
    field.appendChild(E('label', null, label));
    field.appendChild(node);
    return field;
  }
  function input(type, value) {
    const node = E('input');
    node.type = type || 'text';
    if (value !== undefined) node.value = value;
    return node;
  }
  function select(options, value) {
    const node = E('select');
    options.forEach(opt => {
      const o = E('option');
      if (typeof opt === 'string') { o.value = opt; o.textContent = opt; }
      else { o.value = opt.value; o.textContent = opt.label; }
      node.appendChild(o);
    });
    if (value !== undefined) node.value = value;
    return node;
  }
  function textarea(value, placeholder) {
    const node = E('textarea');
    node.value = value || '';
    if (placeholder) node.placeholder = placeholder;
    return node;
  }
  function customerOptions() {
    return [{ value: '', label: '不关联客户' }].concat(ws.data.customers.map(c => ({ value: c.id, label: c.name })));
  }
  function createTaskModal(defaults) {
    const d = defaults || {};
    const title = input('text', d.title || '');
    const customer = select(customerOptions(), d.customerId || defaultCustomerId());
    const owner = select([meName(), '陈默', '赵启', '李衡', '王珂', '林晓'], d.owner || meName());
    const priority = select(['P1', 'P2', 'P3'], d.priority || 'P2');
    const due = input('date', d.due ? String(d.due).slice(0, 10) : D.dateOnly(3));
    const waiting = select([{ value: '', label: '无' }, '客户', '内部协作'], d.waitingOn || '');
    const summary = textarea(d.summary || '', '任务目标、下一步与验收口径');
    const form = E('div', 'ws-form');
    form.appendChild(formField('任务标题', title, true));
    form.appendChild(formField('客户', customer));
    form.appendChild(formField('负责人', owner));
    form.appendChild(formField('优先级', priority));
    form.appendChild(formField('截止日期', due));
    form.appendChild(formField('等待方', waiting));
    form.appendChild(formField('说明', summary, true));
    openModal('新建任务', form, [
      btn('取消', closeOverlays),
      btn('创建任务', () => {
        if (!title.value.trim()) { toast('请填写任务标题', 'error'); return; }
        const task = {
          id: id('t'), title: title.value.trim(),
          customerId: customer.value || '', owner: owner.value,
          createdBy: meName(), status: waiting.value ? 'waiting' : 'open',
          waitingOn: waiting.value, priority: priority.value,
          due: due.value ? new Date(`${due.value}T18:00:00`).toISOString() : null,
          summary: summary.value.trim(), sourceType: 'task',
          acceptance: '负责人/客户确认结果，关键证据归档',
          timeline: [{ date: nowIso(), text: '任务创建' }],
          createdAt: nowIso(), updatedAt: nowIso(),
        };
        ws.data.tasks.unshift(task);
        save();
        closeOverlays();
        toast('任务已创建', 'ok');
        navigate(`task/${task.id}`);
      }, 'primary'),
    ]);
  }

  /* ---------- routes ---------- */
  async function handleRoute(route, param) {
    ws.route = route;
    ws.param = param || '';
    try {
      if (route === 'war-room') { openWarRoom(); return true; }
      if (route === 'home') { showPage('home-overview', '今日工作台', D.PAGE_TITLES.home[1], () => renderHome(param)); return true; }
      if (route === 'tasks') { showPage(...taskPageTitle(param), () => renderTasks(param)); return true; }
      if (route === 'task') { await openTaskDetail(param); return true; }
      if (route === 'customers') { showPage('customers-list', '客户列表', D.PAGE_TITLES.customers[1], () => renderCustomers(param)); return true; }
      if (route === 'customer-360') { showPage('customer-360', '客户 360°', D.PAGE_TITLES['customer-360'][1], renderCustomer360Landing); return true; }
      if (route === 'customer') { await openCustomerRoute(param); return true; }
      if (route === 'lifecycle') { showPage(...lifecycleTitle(param), () => renderLifecycle(param)); return true; }
      if (route === 'portfolio') { const meta = portfolioMeta(param); showPage(meta.nav, meta.title, meta.sub, () => renderPortfolio(param)); return true; }
      if (route === 'service') { await openServiceRoute(param); return true; }
      if (route === 'record') { await openRecordDetail(param); return true; }
      if (route === 'incidents') { await openIncidents(param); return true; }
      if (route === 'event') { await openEventDetail(param); return true; }
      if (route === 'collab') { await openCollabRoute(param); return true; }
      if (route === 'growth') { await openGrowth(param); return true; }
      if (route === 'team') { await openTeam(param); return true; }
      if (route === 'knowledge') { await openKnowledge(param); return true; }
      if (route === 'settings') { await openSettings(param); return true; }
    } catch (error) {
      showError(error);
      return true;
    }
    setActiveNav(route);
    if (route === 'workbench') $('#ws-war-banner')?.remove();
    return false;
  }

  function showPage(navId, title, sub, builder) {
    $$('.view').forEach(view => view.classList.toggle('active', view.id === 'view-ws'));
    const view = $('#view-ws');
    if (!view) return;
    clear(view);
    setTopbar(title, sub);
    if (navId) highlightNav(navId, false);
    else clearNavHighlight();
    const page = E('div', 'ws-page');
    view.appendChild(page);
    try {
      const content = builder();
      if (content && content.nodeType) page.appendChild(content);
    } catch (error) {
      page.appendChild(empty('页面渲染失败', error.message));
    }
    window.scrollTo(0, 0);
  }
  async function showAsyncPage(navId, title, sub, builder) {
    $$('.view').forEach(view => view.classList.toggle('active', view.id === 'view-ws'));
    const view = $('#view-ws');
    if (!view) return;
    clear(view);
    setTopbar(title, sub);
    if (navId) highlightNav(navId, false);
    else clearNavHighlight();
    const page = E('div', 'ws-page');
    view.appendChild(page);
    const loading = E('div', 'empty-state');
    loading.appendChild(E('div', 'empty-title', '加载中…'));
    page.appendChild(loading);
    try {
      const content = await builder();
      clear(page);
      if (content && content.nodeType) page.appendChild(content);
    } catch (error) {
      clear(page);
      page.appendChild(empty('页面加载失败', error.message, btn('重试', rerender)));
    }
    window.scrollTo(0, 0);
  }
  function showError(error) {
    $$('.view').forEach(view => view.classList.toggle('active', view.id === 'view-ws'));
    const view = $('#view-ws');
    if (!view) return;
    clear(view);
    const page = E('div', 'ws-page');
    page.appendChild(empty('页面加载失败', error.message));
    view.appendChild(page);
  }
  function rerender() {
    handleRoute(ws.route, ws.param);
  }
  function taskPageTitle(param) {
    const map = {
      mine: ['tasks-mine', '我负责的'], created: ['tasks-created', '我发起的'],
      internal: ['tasks-internal', '等待内部协作'], customer: ['tasks-customer', '等待客户'],
      due: ['tasks-due', '即将到期'], overdue: ['tasks-overdue', '已逾期'],
    };
    if (param && map[param]) return [map[param][0], map[param][1], D.PAGE_TITLES[`tasks/${param}`][1]];
    return ['tasks-all', '全部任务', D.PAGE_TITLES.tasks[1]];
  }
  function lifecycleTitle(stage) {
    const found = D.LIFECYCLE.find(s => s.key === stage);
    return found
      ? [`lifecycle-${stage}`, found.label, `客户生命周期 · ${found.label} 的阶段目标、闸门与客户`]
      : ['customer-lifecycle', '客户生命周期', D.PAGE_TITLES.lifecycle[1]];
  }
  function portfolioMeta(param) {
    const map = {
      'service-scope': ['portfolio-scope', '服务范围与权益', '全部客户的服务范围、SLA/XLA 与权益边界'],
      'service-plan': ['portfolio-plan', '服务计划', '年度与季度服务计划、节奏与责任人'],
      'tech-assets': ['portfolio-tech', '技术资产与配置', '架构、组件、版本生命周期与关键配置'],
      adoption: ['portfolio-adoption', '采纳、用量与成本', '采纳指标、用量趋势与成本/价值对照'],
      health: ['portfolio-health', '客户健康度', '健康分、影响因素与风险客户'],
      relations: ['portfolio-relations', '关键人与关系', '关键人图谱、立场与关系风险'],
      value: ['portfolio-value', '价值账本', '可证明的客户价值与业务结果'],
      archive: ['portfolio-archive', '客户档案与离任交接', '档案完整性、交接清单与责任边界'],
    };
    return map[param] ? { nav: map[param][0], title: map[param][1], sub: map[param][2] } : { nav: 'customers-list', title: '客户工作', sub: '' };
  }

  /* ---------- data views ---------- */
  function computedTasks() {
    const local = ws.data.tasks.map(t => Object.assign({}, t, {
      sourceLabel: '任务', _local: true,
    }));
    const runs = (state.workflowRuns || []).map(run => ({
      id: `wf-${run.id}`, title: run.workflow_title || run.workflow_id,
      customerId: '', owner: meName(), createdBy: meName(),
      status: run.status === 'completed' ? 'done' : 'in_progress',
      waitingOn: '', priority: 'P3', due: null, summary: run.stage || '',
      sourceType: 'workflow', sourceId: run.id, sourceLabel: '流程',
      progress: run.progress, steps: run.steps, notes: run.notes,
      createdAt: run.created_at, updatedAt: run.updated_at,
    }));
    return { local, runs, all: local.concat(runs) };
  }
  function activeIncidents() {
    const local = (ws.data.majorIncidents || D.MAJOR_INCIDENTS).filter(i => !['已关闭', 'closed'].includes(i.status));
    const running = (state.history || []).filter(h => h.status === 'running').map(h => ({
      id: h.id, title: h.alert_id || h.id, customerId: '', sev: 'P2', status: '处理中',
      commander: meName(), started: h.created_at, nextComm: '', summary: h.root_cause || '排查进行中',
    }));
    return local.concat(running);
  }
  function pendingReviews() {
    return (ws.teamData?.pending_reviews) || [];
  }
  async function ensureHistory(force) {
    if (!force && state.history && state.history.length) return;
    if (ws.historyLoading) return;
    ws.historyLoading = true;
    try { await loadHistory(); } catch (error) { /* view shows empty */ }
    ws.historyLoading = false;
  }
  async function ensureWorkflowRuns() {
    if (state.workflowRuns && state.workflowRuns.length) return;
    try { await loadWorkflowRuns(); } catch (error) { /* demo fallback already loads local */ }
  }
  async function ensureEvals() {
    if (state.evals && state.evals.length) return;
    if (ws.evalsLoading) return;
    ws.evalsLoading = true;
    try { await loadEvals(); } catch (error) { /* empty state */ }
    ws.evalsLoading = false;
  }
  async function ensureAttempts() {
    if (ws.attempts !== null) return;
    if (!state.me) { ws.attempts = []; return; }
    try {
      const response = await fetch('/api/attempts?limit=50', { headers: authHeaders() });
      ws.attempts = response.ok ? (await response.json()).attempts || [] : [];
    } catch (error) { ws.attempts = []; }
  }
  async function ensureTeam() {
    if (ws.teamLoaded) return;
    ws.teamLoaded = true;
    if (state.config?.auth_enabled && !state.me) {
      ws.teamData = { denied: true, members: [], skills: [], pending_reviews: [] };
      return;
    }
    if (!state.me) {
      ws.teamData = { demo: true, members: ws.data.team.members, skills: [], pending_reviews: [] };
      return;
    }
    if (!['admin', 'mentor'].includes(state.me.role)) {
      ws.teamData = { denied: true, members: [], skills: [], pending_reviews: [] };
      return;
    }
    try {
      const response = await fetch('/api/team/progress', { headers: authHeaders() });
      if (!response.ok) {
        ws.teamData = { empty: true, members: [], skills: [], pending_reviews: [] };
        return;
      }
      const data = await response.json();
      if (!data.team_id) ws.teamData = { empty: true, members: [], skills: [], pending_reviews: [] };
      else ws.teamData = data;
    } catch (error) {
      ws.teamData = { empty: true, members: [], skills: [], pending_reviews: [] };
    }
  }
  function teamMembers() {
    if (ws.teamData?.demo) return ws.teamData.members;
    return (ws.teamData?.members || []).map(m => ({
      id: m.id, name: m.username, role: m.role, level: m.role,
      modules: m.modules_completed, cases: m.cases_completed,
      skills: 0, load: Math.min(100, (m.cases_completed + m.modules_completed) * 8),
      oncall: false, customers: [],
    }));
  }

  /* ---------- home ---------- */
  function scheduleToday() {
    const out = [];
    const today = D.dateOnly(0);
    openLocalTasks().forEach(t => {
      if (t.due && String(t.due).slice(0, 10) === today) out.push({ date: t.due, type: '任务', title: t.title, detail: `${customerName(t.customerId)} · ${t.owner}` });
    });
    ws.data.collab.forEach(c => {
      if (String(c.date).slice(0, 10) === today) out.push({ date: c.date, type: '会议', title: c.title, detail: c.participants.join('、') });
    });
    ws.data.customers.forEach(c => {
      if (String(c.nextDate).slice(0, 10) === today) out.push({ date: c.nextDate, type: '节点', title: `${c.name} · ${c.next}`, detail: c.owner });
    });
    return out;
  }
  function dutyToday() {
    const index = new Date().getDay();
    const name = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][index];
    return ws.data.team.duty.find(d => d.day === name) || ws.data.team.duty[5];
  }
  function renderHome(param) {
    const page = E('div');
    if (param && param !== 'overview') {
      if (param === 'tasks') return renderHomeTasks();
      if (param === 'signals') return renderHomeSignals();
      if (param === 'schedule') return renderHomeSchedule();
      if (param === 'customers') return renderHomeCustomers();
    }
    const tasks = computedTasks().local;
    const open = tasks.filter(t => !['done', 'closed'].includes(t.status));
    const overdue = open.filter(isOverdue);
    const due = open.filter(t => dueSoon(t, 3));
    const risks = D.SIGNALS.slice().sort((a, b) => ({ 高: 0, 中: 1, 低: 2 }[a.level] - { 高: 0, 中: 1, 低: 2 }[b.level]));
    const incidents = activeIncidents();
    const riskCustomers = ws.data.customers.filter(c => c.health < 70);
    const today = scheduleToday();
    const duty = dutyToday();

    page.appendChild(pageHead('今日工作台', `${fmtDay(nowIso())} · 值班 ${duty.primary} / 备 ${duty.backup} · ${duty.window}`, [
      btn('新建任务', () => createTaskModal(), 'primary small'),
      btn('发起排查', () => navigate('workbench'), 'ghost small'),
    ]));
    page.appendChild(kpis([
      { label: '我的待办', value: open.length, sub: `${overdue.length} 个已逾期`, kind: overdue.length ? 'crit' : '' },
      { label: '近 3 日节点', value: today.length + due.length, sub: `${today.length} 今日 · ${due.length} 个任务到期` },
      { label: '进行中事件', value: incidents.length, sub: incidents.length ? `${incidents[0].sev} · ${incidents[0].title}` : '无进行中事件', kind: incidents.length ? 'warn' : 'ok' },
      { label: '风险客户', value: riskCustomers.length, sub: riskCustomers.map(c => c.name).join(' · ') || '全部健康', kind: riskCustomers.length ? 'warn' : 'ok' },
    ]));

    const grid = E('div', 'ws-grid');
    const todoPanel = panel('我的待办', `${open.length} OPEN`, (() => {
      const box = E('div', 'ws-list');
      open.slice().sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || (daysUntil(a.due) ?? 99) - (daysUntil(b.due) ?? 99)).slice(0, 6).forEach(t => {
        box.appendChild(row({
          leading: status(t.priority === 'P1' ? '高风险' : t.priority),
          title: t.title,
          sub: `${customerName(t.customerId)} · ${statusLabel(t.status)}${t.waitingOn ? ` · 等${t.waitingOn}` : ''}`,
          meta: t.due ? `${daysUntil(t.due) < 0 ? '逾期 ' + Math.abs(daysUntil(t.due)) + ' 天' : 'D-' + daysUntil(t.due)}` : '—',
          action: btn('打开', () => navigate(`task/${t.id}`), 'ghost small'),
          grid: 'auto minmax(0,1fr) auto auto',
        }));
      });
      if (!open.length) box.appendChild(empty('今天没有未关闭任务', '可以从任务中心创建，或从客户 360° 发起交接。'));
      return box;
    })(), { });
    todoPanel.appendChild(link('查看全部任务 →', '#tasks'));
    const todoCol = E('div', 'ws-col-7');
    todoCol.appendChild(todoPanel);

    const incidentPanel = panel('进行中的作战室', incidents.length ? `${incidents.length} ACTIVE` : 'STANDBY', (() => {
      const box = E('div', 'ws-list');
      incidents.slice(0, 3).forEach(i => {
        box.appendChild(row({
          leading: status(i.sev === 'P1' ? '高风险' : i.status),
          title: i.title,
          sub: `${customerName(i.customerId) || '未关联客户'} · 指挥 ${i.commander}`,
          meta: fmtDate(i.started),
          action: btn('进入', () => navigate('war-room'), 'ghost small'),
          grid: 'auto minmax(0,1fr) auto auto',
        }));
      });
      if (!incidents.length) box.appendChild(empty('当前无进行中事件', '告警接入后会在这里置顶作战室。', btn('发起排查', () => navigate('workbench'), 'ghost small')));
      return box;
    })());
    const incidentCol = E('div', 'ws-col-5');
    incidentCol.appendChild(incidentPanel);

    const signalPanel = panel('风险与信号', 'TOP SIGNALS', (() => {
      const box = E('div', 'ws-list');
      risks.slice(0, 5).forEach(s => {
        box.appendChild(row({
          leading: status(s.level === '高' ? '高风险' : s.type),
          title: s.title,
          sub: `${customerName(s.customerId)} · ${s.type} · ${s.owner}`,
          meta: fmtDay(s.date).slice(5),
          action: btn('查看', () => navigate(`customer/${s.customerId}/risks`), 'ghost small'),
          grid: 'auto minmax(0,1fr) auto auto',
        }));
      });
      return box;
    })());
    signalPanel.appendChild(link('全部风险与信号 →', '#home/signals'));
    const signalCol = E('div', 'ws-col-6');
    signalCol.appendChild(signalPanel);

    const schedulePanel = panel('今日日程与值班', `${today.length} 项`, (() => {
      const box = E('div');
      const dutyRow = E('div', 'ws-assist-block');
      dutyRow.appendChild(E('div', 'label', '今日值班'));
      dutyRow.appendChild(E('p', null, `${duty.primary} 主值 · ${duty.backup} 备份 · ${duty.window}`));
      box.appendChild(dutyRow);
      if (today.length) box.appendChild(timeline(today));
      else box.appendChild(E('div', 'hint', '今天没有会议或到期节点。'));
      return box;
    })());
    schedulePanel.appendChild(link('查看日程 →', '#home/schedule'));
    const scheduleCol = E('div', 'ws-col-6');
    scheduleCol.appendChild(schedulePanel);

    const customerPanel = panel('最近处理的客户', 'RECENT', (() => {
      const box = E('div', 'ws-list');
      ws.data.customers.slice().sort((a, b) => {
        const last = c => c.timeline.reduce((max, item) => Math.max(max, new Date(item.date || 0).getTime()), 0);
        return last(b) - last(a);
      }).slice(0, 4).forEach(c => {
        box.appendChild(row({
          leading: status(c.health < 70 ? '预警' : c.health < 80 ? '关注' : '健康'),
          title: c.name,
          sub: `${c.stage} · ${c.owner} · ${c.next}`,
          meta: `${c.health}`,
          action: btn('360°', () => navigate(`customer/${c.id}`), 'ghost small'),
          grid: 'auto minmax(0,1fr) auto auto',
        }));
      });
      return box;
    })());
    const customerCol = E('div', 'ws-col-12');
    customerCol.appendChild(customerPanel);

    grid.appendChild(todoCol);
    grid.appendChild(incidentCol);
    grid.appendChild(signalCol);
    grid.appendChild(scheduleCol);
    grid.appendChild(customerCol);
    page.appendChild(grid);
    return page;
  }
  function renderHomeTasks() {
    const page = E('div');
    page.appendChild(pageHead('我的待办', '按优先级与截止时间排序；点击任务打开统一详情。', [btn('任务中心', () => navigate('tasks'), 'ghost small'), btn('新建任务', () => createTaskModal(), 'primary small')]));
    const tasks = computedTasks().local.filter(t => isMe(t.owner) && !['done', 'closed'].includes(t.status));
    page.appendChild(taskTable(tasks));
    return page;
  }
  function renderHomeSignals() {
    const page = E('div');
    page.appendChild(pageHead('风险与信号', '来自客户风险、服务执行与商业信号；权威数据仍在对应模块。', []));
    const rows = D.SIGNALS.map(s => ({
      cells: [
        { node: status(s.level === '高' ? '高风险' : s.type) },
        { node: (() => { const d = E('div'); d.appendChild(E('div', 'title', s.title)); d.appendChild(E('div', 'sub', `${s.type} · ${s.owner}`)); return d; })() },
        customerName(s.customerId), fmtDay(s.date), s.level,
      ],
      __onclick: () => navigate(`customer/${s.customerId}/signals`),
    }));
    page.appendChild(table(['级别', '信号', '客户', '日期', '等级'], rows));
    return page;
  }
  function renderHomeSchedule() {
    const page = E('div');
    page.appendChild(pageHead('今日日程与值班', '会议、客户节点、任务到期与本周值班。', []));
    const duty = dutyToday();
    page.appendChild(kpis([
      { label: '今日主值', value: duty.primary, sub: duty.window },
      { label: '今日备份', value: duty.backup, sub: '升级第一联系人' },
      { label: '今日节点', value: scheduleToday().length, sub: '会议 / 到期 / 客户节点' },
      { label: '本周值班', value: ws.data.team.duty.length, sub: '含周末待命' },
    ]));
    const grid = E('div', 'ws-grid');
    const todayCol = E('div', 'ws-col-6');
    todayCol.appendChild(panel('今日', 'TODAY', scheduleToday().length ? timeline(scheduleToday()) : empty('今天没有节点', '可以提前准备明天的客户会议。')));
    const weekCol = E('div', 'ws-col-6');
    const rows = ws.data.team.duty.map(d => ({ cells: [d.day, d.primary, d.backup, d.window] }));
    weekCol.appendChild(panel('本周值班', 'ROSTER', table(['日期', '主值', '备份', '窗口'], rows)));
    grid.appendChild(todayCol);
    grid.appendChild(weekCol);
    page.appendChild(grid);
    return page;
  }
  function renderHomeCustomers() {
    const page = E('div');
    page.appendChild(pageHead('最近处理的客户', '按最近互动排序；点击进入客户 360°。', [btn('客户列表', () => navigate('customers'), 'ghost small')]));
    const box = E('div', 'ws-list');
    ws.data.customers.slice().sort((a, b) => {
      const last = c => c.timeline.reduce((max, item) => Math.max(max, new Date(item.date || 0).getTime()), 0);
      return last(b) - last(a);
    }).forEach(c => {
      box.appendChild(row({
        leading: status(c.health < 70 ? '预警' : c.health < 80 ? '关注' : '健康'),
        title: c.name,
        sub: `${c.industry} · ${c.stage} · ${c.owner} · ${c.next}`,
        meta: `${c.health}`,
        action: btn('打开 360°', () => navigate(`customer/${c.id}`), 'ghost small'),
        grid: 'auto minmax(0,1fr) auto auto',
      }));
    });
    page.appendChild(box);
    return page;
  }

  /* ---------- tasks ---------- */
  function taskTable(tasks) {
    const rows = tasks.slice().sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || ((daysUntil(a.due) ?? 999) - (daysUntil(b.due) ?? 999))).map(t => ({
      cells: [
        { node: (() => { const s = E('span', `ws-pri ${t.priority}`, t.priority); return s; })() },
        { node: (() => {
          const d = E('div');
          d.appendChild(E('div', 'title', t.title));
          d.appendChild(E('div', 'sub', `${t.sourceLabel || '任务'} · ${customerName(t.customerId)}${t.waitingOn ? ` · 等${t.waitingOn}` : ''}`));
          return d;
        })() },
        t.owner,
        { node: status(t.status) },
        { node: (() => {
          const d = E('div');
          if (!t.due) { d.textContent = '—'; return d; }
          const left = daysUntil(t.due);
          d.appendChild(E('div', 'num', fmtDay(t.due)));
          d.appendChild(E('div', 'sub', left < 0 ? `逾期 ${Math.abs(left)} 天` : left === 0 ? '今天到期' : `${left} 天后`));
          return d;
        })() },
        { node: status(t.priority === 'P1' ? '高优先级' : '常规') },
      ],
      __onclick: () => navigate(t.id.startsWith('wf-') ? `workflow-run/${t.sourceId}` : `task/${t.id}`),
    }));
    return table(['优先级', '任务', '负责人', '状态', '截止', '来源'], rows);
  }
  function renderTasks(param) {
    const page = E('div');
    const all = computedTasks().all;
    let tasks = all.slice();
    if (param === 'mine') tasks = tasks.filter(t => isMe(t.owner) && !['done', 'closed'].includes(t.status));
    else if (param === 'created') tasks = tasks.filter(t => isMe(t.createdBy));
    else if (param === 'internal') tasks = tasks.filter(t => t.waitingOn === '内部协作' && !['done', 'closed'].includes(t.status));
    else if (param === 'customer') tasks = tasks.filter(t => t.waitingOn === '客户' && !['done', 'closed'].includes(t.status));
    else if (param === 'due') tasks = tasks.filter(t => dueSoon(t, 7));
    else if (param === 'overdue') tasks = tasks.filter(isOverdue);
    const open = all.filter(t => !['done', 'closed'].includes(t.status));
    page.appendChild(pageHead(taskPageTitle(param)[1], taskPageTitle(param)[2], [
      btn('新建任务', () => createTaskModal(), 'primary small'),
      btn('流程中心', () => navigate('workflows'), 'ghost small'),
    ]));
    page.appendChild(kpis([
      { label: '全部任务', value: all.length, sub: `${open.length} 个未关闭` },
      { label: '我负责', value: all.filter(t => isMe(t.owner) && !['done', 'closed'].includes(t.status)).length, sub: `${all.filter(t => isMe(t.owner) && isOverdue(t)).length} 个逾期`, kind: 'accent' },
      { label: '等待协作', value: all.filter(t => t.waitingOn === '内部协作' && !['done', 'closed'].includes(t.status)).length, sub: '需主动催办' },
      { label: '等待客户', value: all.filter(t => t.waitingOn === '客户' && !['done', 'closed'].includes(t.status)).length, sub: '需确认窗口' },
    ]));
    if (tasks.length) page.appendChild(taskTable(tasks));
    else page.appendChild(empty('当前筛选下没有任务', '切换筛选、创建任务，或从流程中心开始一个可执行流程。', btn('新建任务', () => createTaskModal(), 'primary small')));
    return page;
  }

  async function openTaskDetail(tid) {
    const t = taskById(tid);
    if (!t) {
      showPage('tasks-all', '任务详情', '未找到该任务', () => empty('任务不存在', '它可能已被删除或来自其他工作区。', btn('返回任务中心', () => navigate('tasks'))));
      return;
    }
    showPage('tasks-all', t.title, `${customerName(t.customerId)} · ${t.priority} · ${statusLabel(t.status)}`, () => taskDetail(t));
  }
  function taskDetail(t) {
    const page = E('div');
    page.appendChild(pageHead(t.title, `${customerName(t.customerId)} · ${t.owner} · ${t.priority}`, [
      btn('返回任务中心', () => navigate('tasks'), 'ghost small'),
    ]));
    const layout = E('div', 'ws-skeleton');
    const sections = E('div', 'ws-sections');
    const section = (n, title, body) => {
      const box = E('section', 'ws-section');
      const head = E('div', 'ws-section-head');
      head.appendChild(E('h3', null, title));
      head.appendChild(E('span', 'n', `0${n}`));
      box.appendChild(head);
      const content = E('div', 'ws-section-body');
      if (body && body.nodeType) content.appendChild(body);
      else content.textContent = body || '—';
      box.appendChild(content);
      return box;
    };
    const kv = pairs => {
      const dl = E('dl', 'ws-kv');
      pairs.forEach(([k, v]) => {
        dl.appendChild(E('dt', null, k));
        const dd = E('dd');
        if (v && v.nodeType) dd.appendChild(v);
        else dd.textContent = v || '—';
        dl.appendChild(dd);
      });
      return dl;
    };
    const conclusion = E('div');
    conclusion.appendChild(E('p', null, t.summary || '尚未填写当前结论。'));
    const next = E('div', 'hint');
    next.textContent = t.status === 'submitted' ? '下一步：验收并关闭。' : t.status === 'waiting' ? `下一步：${t.waitingOn === '客户' ? '催客户确认' : '推动内部协作'}。` : '下一步：推进到可验收状态。';
    conclusion.appendChild(next);
    sections.appendChild(section(1, '基本信息', kv([
      ['对象', t.title], ['客户', customerName(t.customerId)], ['负责人', t.owner],
      ['状态', status(t.status)], ['截止', t.due ? fmtDay(t.due) : '—'], ['来源', t.sourceLabel || '任务'],
    ])));
    sections.appendChild(section(2, '当前结论', conclusion));
    sections.appendChild(section(3, '执行内容', kv([
      ['说明', t.summary || '—'], ['验收口径', t.acceptance || '—'],
    ])));
    sections.appendChild(section(4, '协作信息', kv([
      ['发起人', t.createdBy || '—'], ['等待方', t.waitingOn || '无'],
      ['客户团队', (customerById(t.customerId)?.team || []).join('、') || '—'],
    ])));
    const related = E('div', 'ws-list');
    if (t.customerId) related.appendChild(row({ title: `${customerName(t.customerId)} · 客户 360°`, sub: '查看服务、风险、关系与价值', href: `#customer/${t.customerId}` }));
    if (t.sourceType === 'workflow') related.appendChild(row({ title: '关联流程', sub: t.title, href: `#workflow-run/${t.sourceId}` }));
    if (!related.children.length) related.appendChild(E('div', 'hint', '暂无关联对象'));
    sections.appendChild(section(5, '关联对象', related));
    sections.appendChild(section(6, '时间线', timeline((t.timeline || []).slice().reverse())));
    sections.appendChild(section(7, '关闭标准', kv([
      ['验收人', t.owner], ['验证证据', t.acceptance || '关键证据归档'],
      ['后续动作', '关闭后进入客户时间线，必要时生成改进项'],
    ])));
    const aside = E('div', 'ws-aside');
    const actions = E('div', 'ws-action-stack');
    if (!['done', 'closed'].includes(t.status)) {
      actions.appendChild(btn(t.status === 'open' ? '开始处理' : t.status === 'waiting' ? '恢复处理' : t.status === 'in_progress' ? '提交验收' : '验收并关闭', () => advanceTask(t), 'primary small'));
      actions.appendChild(btn('催办 / 记录跟进', () => addTaskNote(t), 'ghost small'));
      actions.appendChild(btn('转派', () => transferTask(t), 'ghost small'));
    } else {
      actions.appendChild(btn('重新打开', () => { t.status = 'in_progress'; t.timeline.push({ date: nowIso(), text: '重新打开' }); save(); rerender(); }, 'ghost small'));
    }
    aside.appendChild(panel('动作', 'ACTIONS', actions));
    const meta = E('div', 'ws-list');
    meta.appendChild(row({ title: '任务来源', sub: t.sourceLabel || '本地任务', meta: t.id.slice(0, 12) }));
    meta.appendChild(row({ title: '创建时间', sub: fmtDate(t.createdAt) }));
    meta.appendChild(row({ title: '最近更新', sub: fmtDate(t.updatedAt) }));
    aside.appendChild(panel('记录信息', 'META', meta));
    layout.appendChild(sections);
    layout.appendChild(aside);
    page.appendChild(layout);
    return page;
  }
  function advanceTask(t) {
    const next = t.status === 'open' ? 'in_progress'
      : t.status === 'waiting' ? 'in_progress'
        : t.status === 'in_progress' ? 'submitted'
          : 'closed';
    t.status = next;
    t.updatedAt = nowIso();
    t.timeline.push({ date: nowIso(), text: next === 'in_progress' ? '开始处理' : next === 'submitted' ? '提交验收' : '验收关闭' });
    save();
    toast(`任务状态：${statusLabel(next)}`, 'ok');
    rerender();
  }
  function addTaskNote(t) {
    const note = textarea('', '记录跟进、催办或客户反馈');
    openModal('记录跟进', formField('跟进内容', note, true), [
      btn('取消', closeOverlays),
      btn('保存', () => {
        if (!note.value.trim()) { toast('请填写内容', 'error'); return; }
        t.timeline.push({ date: nowIso(), text: note.value.trim() });
        t.updatedAt = nowIso();
        save();
        closeOverlays();
        rerender();
        toast('已记录', 'ok');
      }, 'primary'),
    ]);
  }
  function transferTask(t) {
    const owner = select([meName(), '陈默', '赵启', '李衡', '王珂', '林晓'], t.owner);
    openModal('转派任务', formField('新负责人', owner, true), [
      btn('取消', closeOverlays),
      btn('确认转派', () => {
        t.timeline.push({ date: nowIso(), text: `转派：${t.owner} → ${owner.value}` });
        t.owner = owner.value;
        t.updatedAt = nowIso();
        save();
        closeOverlays();
        rerender();
        toast(`已转派给 ${owner.value}`, 'ok');
      }, 'primary'),
    ]);
  }

  /* ---------- customers ---------- */
  const LIFECYCLE_GATES = {
    presales: ['承诺清单完成', '责任边界确认', '移交会签'],
    import: ['风险登记册建立', '监控基线补齐', '责任边界书面化'],
    onboarding: ['30/60/90 里程碑', 'S1–S4 闸门', '期望值共签'],
    adoption: ['采纳指标基线', '关键场景覆盖', '价值账本启动'],
    steady: ['服务节奏稳定', '风险定期复审', '容量与演练'],
    renewal: ['到期前 180 天启动', '价值证明', '续约/扩容方案'],
    handover: ['档案完整', '主备交接', '客户确认'],
  };
  const CUSTOMER_TABS = [
    ['overview', '总览'], ['lifecycle', '生命周期'], ['services', '服务与权益'],
    ['tech', '技术与资产'], ['risks', '风险与事件'], ['adoption', '采纳与价值'],
    ['relations', '关系与协同'], ['signals', '经营信号'], ['timeline', '时间与决策记录'],
    ['archive', '档案与交接'],
  ];
  const STAGE_BOOK = {
    presales: 'ch11-customer-lifecycle', import: 'ch11-customer-lifecycle',
    onboarding: 'ch11-customer-lifecycle', adoption: 'ch11-customer-lifecycle',
    steady: 'ch11-customer-lifecycle', renewal: 'ch11-customer-lifecycle',
    handover: 'ch28-career-team-building',
  };

  function renderCustomers() {
    const page = E('div');
    page.appendChild(pageHead('客户列表', '按分层、生命周期、健康度与负责人查看客户组合。', [
      btn('新建客户', () => createCustomerModal(), 'primary small'),
      btn('健康度视图', () => navigate('portfolio/health'), 'ghost small'),
    ]));
    const strategic = ws.data.customers.filter(c => c.tier === '战略').length;
    const atRisk = ws.data.customers.filter(c => c.health < 70).length;
    const renew = ws.data.customers.filter(c => {
      const d = daysUntil(c.renewal);
      return d !== null && d >= 0 && d <= 120;
    }).length;
    page.appendChild(kpis([
      { label: '客户总数', value: ws.data.customers.length, sub: `${strategic} 个战略客户` },
      { label: '风险客户', value: atRisk, sub: '健康分 < 70', kind: atRisk ? 'crit' : 'ok' },
      { label: '120 天内续约', value: renew, sub: '需提前启动经营动作', kind: renew ? 'warn' : '' },
      { label: '在管 ARR', value: ws.data.customers.length ? '¥' + ws.data.customers.reduce((sum, c) => sum + (parseFloat(String(c.arr).replace(/[^\d.]/g, '')) || 0), 0).toFixed(1) + 'M' : '—', sub: '演示口径' },
    ]));
    const filters = E('div', 'filter-row');
    const stateFilter = ws.customerFilter || 'all';
    [['all', '全部'], ['战略', '战略'], ['重点', '重点'], ['成长', '成长'], ['risk', '风险客户']].forEach(([key, label]) => {
      const chip = E('button', `chip`, label);
      chip.type = 'button';
      chip.setAttribute('aria-pressed', stateFilter === key ? 'true' : 'false');
      chip.addEventListener('click', () => { ws.customerFilter = key; rerender(); });
      filters.appendChild(chip);
    });
    page.appendChild(filters);
    let customers = ws.data.customers.slice();
    if (stateFilter === 'risk') customers = customers.filter(c => c.health < 70);
    else if (stateFilter !== 'all') customers = customers.filter(c => c.tier === stateFilter);
    const rows = customers.map(c => ({
      cells: [
        { node: (() => {
          const d = E('div');
          d.appendChild(E('div', 'title', c.name));
          d.appendChild(E('div', 'sub', `${c.industry} · ${c.region}`));
          return d;
        })() },
        c.stage,
        { node: (() => {
          const d = E('div');
          d.appendChild(status(c.health < 70 ? '预警' : c.health < 80 ? '关注' : '健康'));
          const sub = E('div', 'sub', `${c.health} · ${c.healthLabel}`);
          d.appendChild(sub);
          return d;
        })() },
        c.owner,
        { node: (() => { const d = E('div'); d.appendChild(E('div', 'title', c.next)); d.appendChild(E('div', 'sub', fmtDay(c.nextDate))); return d; })() },
        fmtDay(c.renewal),
        c.arr,
      ],
      __onclick: () => navigate(`customer/${c.id}`),
    }));
    page.appendChild(table(['客户', '阶段', '健康度', '负责人', '下一节点', '续约', 'ARR'], rows));
    if (!customers.length) page.appendChild(empty('该筛选下没有客户', '切换筛选或新建客户。'));
    return page;
  }
  function createCustomerModal() {
    const name = input('text', '');
    const industry = input('text', '');
    const stage = select(D.LIFECYCLE.map(s => ({ value: s.key, label: s.label })), 'presales');
    const tier = select(['战略', '重点', '成长'], '成长');
    const owner = select([meName(), '陈默', '赵启', '李衡'], meName());
    const service = input('text', '');
    const form = E('div', 'ws-form');
    form.appendChild(formField('客户名称', name, true));
    form.appendChild(formField('行业', industry));
    form.appendChild(formField('生命周期', stage));
    form.appendChild(formField('分层', tier));
    form.appendChild(formField('负责人', owner));
    form.appendChild(formField('服务', service));
    openModal('新建客户', form, [
      btn('取消', closeOverlays),
      btn('创建客户', () => {
        if (!name.value.trim()) { toast('请填写客户名称', 'error'); return; }
        const stageInfo = D.LIFECYCLE.find(s => s.key === stage.value);
        const c = blankCustomer(name.value.trim(), {
          industry: industry.value.trim() || '待补充', stageKey: stage.value,
          stage: stageInfo.label, tier: tier.value, owner: owner.value,
          service: service.value.trim() || '待定义',
        });
        ws.data.customers.push(c);
        save();
        closeOverlays();
        navigate(`customer/${c.id}`);
        toast('客户已创建', 'ok');
      }, 'primary'),
    ]);
  }
  function blankCustomer(name, overrides) {
    const o = overrides || {};
    const now = nowIso();
    return Object.assign({
      id: id('cust'), name, short: name, industry: '待补充', tier: '成长',
      stage: '售前移交', stageKey: 'presales', health: 60, healthLabel: '关注',
      owner: meName(), team: [meName()], service: '待定义', region: '—',
      next: '完成售前移交', nextDate: D.dateOnly(14), renewal: D.dateOnly(365),
      arr: '—', brief: '新建客户，待完善 360° 信息。', topRisk: '待评估',
      factors: [
        { label: '技术健康', score: 60, note: '待评估' },
        { label: '关系健康', score: 60, note: '待评估' },
        { label: '商业健康', score: 60, note: '待评估' },
        { label: '服务健康', score: 60, note: '待评估' },
      ],
      services: {
        plan: '待定义', sla: '待定义', xla: '待定义', hours: '待定义',
        renewal: D.dateOnly(365), scope: [], entitlements: [],
      },
      tech: { architecture: '待补充', assets: [], eol: [], config: [] },
      risks: [], events: [],
      adoption: { metrics: [], ledger: [], qbr: {} },
      relations: [], signals: [],
      timeline: [{ date: now, type: '创建', title: '客户创建', detail: o.owner || meName() }],
      archive: { status: '未启动', owner: o.owner || meName(), docs: [], note: '' },
    }, o);
  }

  function renderCustomer360Landing() {
    const page = E('div');
    page.appendChild(pageHead('客户 360°', '选择一个客户，以统一视图查看生命周期、服务、风险、价值与关系。', [
      btn('客户列表', () => navigate('customers'), 'ghost small'),
    ]));
    const grid = E('div', 'ws-fav-grid');
    ws.data.customers.forEach(c => {
      const card = E('div', 'ws-fav-card');
      card.appendChild(E('div', 'kind', `${c.tier} · ${c.stage}`));
      card.appendChild(E('div', 'title', c.name));
      card.appendChild(E('div', 'sub', `${c.owner} · 健康 ${c.health} · ${c.next}`));
      const actions = E('div', 'actions');
      actions.appendChild(btn('打开 360°', () => navigate(`customer/${c.id}`), 'ghost small'));
      card.appendChild(actions);
      grid.appendChild(card);
    });
    page.appendChild(grid);
    return page;
  }
  async function openCustomerRoute(param) {
    const parts = (param || '').split('/');
    const cid = decodeURIComponent(parts[0] || '');
    const tab = parts[1] || 'overview';
    const c = customerById(cid);
    if (!c) {
      showPage('customers-list', '客户不存在', '未找到该客户', () => empty('客户不存在', '它可能已被删除或来自其他工作区。', btn('返回客户列表', () => navigate('customers'))));
      return;
    }
    const tabLabel = (CUSTOMER_TABS.find(t => t[0] === tab) || CUSTOMER_TABS[0])[1];
    showPage('customer-360', `${c.name} · ${tabLabel}`, `${c.stage} · 健康 ${c.health} · ${c.owner}`, () => renderCustomerPage(c, tab));
  }
  function renderCustomerPage(c, tab) {
    const page = E('div');
    page.appendChild(customerHeader(c));
    const tabs = E('div', 'ws-tabs');
    tabs.setAttribute('role', 'tablist');
    CUSTOMER_TABS.forEach(([key, label]) => {
      const b = E('button', 'ws-tab', label);
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', tab === key ? 'true' : 'false');
      b.addEventListener('click', () => navigate(`customer/${c.id}/${key}`));
      tabs.appendChild(b);
    });
    page.appendChild(tabs);
    const renderers = {
      overview: customerOverview, lifecycle: customerLifecycle, services: customerServices,
      tech: customerTech, risks: customerRisks, adoption: customerAdoption,
      relations: customerRelations, signals: customerSignals, timeline: customerTimeline,
      archive: customerArchive,
    };
    try {
      page.appendChild((renderers[tab] || customerOverview)(c));
    } catch (error) {
      page.appendChild(empty('该视图加载失败', error.message));
    }
    return page;
  }
  function customerHeader(c) {
    const head = E('div', 'ws-cust-head');
    const top = E('div', 'ws-cust-top');
    const identity = E('div', 'ws-cust-identity');
    const name = E('div', 'ws-cust-name');
    name.appendChild(E('h2', null, c.name));
    name.appendChild(E('span', 'code', `${c.tier} · ${c.industry}`));
    identity.appendChild(name);
    const facts = E('div', 'ws-cust-facts');
    [['阶段', c.stage], ['负责人', c.owner], ['下一节点', `${c.next} · ${fmtDay(c.nextDate)}`],
      ['续约', fmtDay(c.renewal)], ['ARR', c.arr]].forEach(([k, v]) => {
      const span = E('span');
      span.appendChild(document.createTextNode(`${k} `));
      span.appendChild(E('b', null, v));
      facts.appendChild(span);
    });
    identity.appendChild(facts);
    const signal = E('div', 'ws-cust-signal');
    signal.appendChild(E('strong', null, '最高风险'));
    signal.appendChild(E('span', null, c.topRisk));
    identity.appendChild(signal);
    top.appendChild(identity);
    const right = E('div');
    const score = E('div', `ws-cust-score ${c.health < 70 ? 'crit' : c.health < 80 ? 'warn' : 'ok'}`);
    score.appendChild(E('div', 'score', String(c.health)));
    score.appendChild(E('div', 'label', `健康度 · ${c.healthLabel}`));
    right.appendChild(score);
    const actions = E('div', 'ws-cust-actions');
    actions.appendChild(btn('更新阶段', () => openStageModal(c), 'ghost small'));
    actions.appendChild(btn('客户简报', () => customerBrief(c), 'ghost small'));
    actions.appendChild(btn('记录承诺', () => createCommitmentModal({ customerId: c.id }), 'ghost small'));
    actions.appendChild(btn('发起交接', () => createHandoverTask(c), 'ghost small'));
    actions.appendChild(favoriteButton());
    right.appendChild(actions);
    top.appendChild(right);
    head.appendChild(top);
    return head;
  }
  function openStageModal(c) {
    const stage = select(D.LIFECYCLE.map(s => ({ value: s.key, label: s.label })), c.stageKey);
    openModal(`更新生命周期 · ${c.name}`, formField('目标阶段', stage, true), [
      btn('取消', closeOverlays),
      btn('更新阶段', () => {
        const found = D.LIFECYCLE.find(s => s.key === stage.value);
        if (found.key !== c.stageKey) {
          c.timeline.unshift({ date: nowIso(), type: '阶段', title: `阶段切换：${c.stage} → ${found.label}`, detail: meName() });
          c.stageKey = found.key;
          c.stage = found.label;
          c.updatedAt = nowIso();
          save();
        }
        closeOverlays();
        rerender();
        toast('生命周期已更新', 'ok');
      }, 'primary'),
    ]);
  }
  function createHandoverTask(c) {
    const t = {
      id: id('t'), title: `离任交接：${c.name}`, customerId: c.id, owner: meName(),
      createdBy: meName(), status: 'open', waitingOn: '内部协作', priority: 'P2',
      due: new Date(`${D.dateOnly(7)}T18:00:00`).toISOString(),
      summary: '完成档案、关键人、风险与在办事项交接，客户确认后关闭。',
      sourceType: 'task', acceptance: '接手人确认 + 客户知会',
      timeline: [{ date: nowIso(), text: '交接任务创建' }], createdAt: nowIso(), updatedAt: nowIso(),
    };
    ws.data.tasks.unshift(t);
    c.timeline.unshift({ date: nowIso(), type: '交接', title: '发起离任交接', detail: meName() });
    save();
    toast('已创建交接任务', 'ok');
    navigate(`task/${t.id}`);
  }
  function customerOverview(c) {
    const wrap = E('div', 'ws-grid');
    const left = E('div', 'ws-col-8');
    const conclusion = E('div');
    conclusion.appendChild(E('p', null, c.brief));
    const next = E('div', 'hint');
    next.textContent = `下一关键节点：${c.next}（${fmtDay(c.nextDate)}）· 负责人 ${c.owner}`;
    conclusion.appendChild(next);
    left.appendChild(panel('当前结论', 'NOW', conclusion));
    const factors = E('div');
    c.factors.forEach(f => factors.appendChild(meterRow(f.label, f.score, f.score < 60 ? 'crit' : f.score < 75 ? 'warn' : 'ok')));
    left.appendChild(panel('健康度构成', `SCORE ${c.health}`, factors, { sub: c.healthLabel }));
    left.appendChild(panel('近期时间线', 'TIMELINE', timeline(customerTimelineItems(c).slice(0, 6)), { cls: '' }));
    const right = E('div', 'ws-col-4');
    const riskBox = E('div', 'ws-list');
    c.risks.slice(0, 3).forEach(r => riskBox.appendChild(row({
      leading: status(r.level === '高' ? '高风险' : r.level),
      title: r.title, sub: `${r.owner} · ${r.status}`, meta: fmtDay(r.due),
      grid: 'auto minmax(0,1fr) auto',
    })));
    if (!c.risks.length) riskBox.appendChild(E('div', 'hint', '当前没有登记风险。'));
    right.appendChild(panel('关键风险', `${c.risks.length} OPEN`, riskBox));
    const taskBox = E('div', 'ws-list');
    openLocalTasks().filter(t => t.customerId === c.id).slice(0, 4).forEach(t => taskBox.appendChild(row({
      title: t.title, sub: `${t.priority} · ${statusLabel(t.status)}`, meta: t.due ? `D-${daysUntil(t.due)}` : '—',
      onclick: () => navigate(`task/${t.id}`),
    })));
    if (!taskBox.children.length) taskBox.appendChild(E('div', 'hint', '没有未关闭任务。'));
    right.appendChild(panel('下一步', 'OPEN TASKS', taskBox));
    const scope = E('div');
    scope.appendChild(E('div', 'hint', c.services.plan));
    const ul = E('ul');
    ul.style.margin = '6px 0 0';
    ul.style.paddingLeft = '16px';
    c.services.scope.forEach(s => ul.appendChild(E('li', null, s)));
    scope.appendChild(ul);
    right.appendChild(panel('服务范围', 'SCOPE', scope));
    wrap.appendChild(left);
    wrap.appendChild(right);
    return wrap;
  }
  function customerLifecycle(c) {
    const wrap = E('div');
    const currentIndex = Math.max(0, D.LIFECYCLE.findIndex(s => s.key === c.stageKey));
    const stages = E('div', 'ws-stages');
    D.LIFECYCLE.forEach((s, index) => {
      const box = E('div', `ws-stage${index < currentIndex ? ' done' : ''}${index === currentIndex ? ' current' : ''}`);
      box.appendChild(E('div', 'n', `0${index + 1}`));
      box.appendChild(E('div', 't', s.label));
      box.appendChild(E('div', 'mark', index < currentIndex ? '✓' : index === currentIndex ? 'NOW' : ''));
      stages.appendChild(box);
    });
    wrap.appendChild(stages);
    const grid = E('div', 'ws-grid');
    const gates = E('div');
    (LIFECYCLE_GATES[c.stageKey] || []).forEach(g => {
      gates.appendChild(row({ leading: status('通过'), title: g, sub: '阶段闸门 · 需证据', grid: 'auto minmax(0,1fr)' }));
    });
    const left = E('div', 'ws-col-7');
    left.appendChild(panel(`${c.stage} · 阶段闸门`, 'GATES', gates, { sub: c.brief }));
    const nextStage = D.LIFECYCLE[currentIndex + 1];
    const right = E('div', 'ws-col-5');
    const info = E('div', 'ws-list');
    info.appendChild(row({ title: '当前阶段', sub: c.stage, meta: `0${currentIndex + 1}` }));
    info.appendChild(row({ title: '下一阶段', sub: nextStage ? nextStage.label : '已到退出阶段', meta: 'NEXT' }));
    info.appendChild(row({ title: '阶段负责人', sub: c.owner, meta: 'OWNER' }));
    info.appendChild(row({ title: '阶段手册', sub: '客户全生命周期运营', href: `#book/${STAGE_BOOK[c.stageKey] || 'ch11-customer-lifecycle'}`, meta: 'READ' }));
    info.appendChild(row({ title: '阶段实战流程', sub: '开始流程、勾步骤、留证据', href: '#workflows/practice-ch11-customer-lifecycle', meta: 'RUN' }));
    right.appendChild(panel('阶段信息', 'LIFECYCLE', info));
    const actions = E('div', 'ws-action-stack');
    actions.appendChild(btn('推进到下一阶段', () => openStageModal(c), 'primary small'));
    actions.appendChild(btn('查看阶段模板', () => navigate('knowledge/templates'), 'ghost small'));
    right.appendChild(panel('阶段动作', 'ACTIONS', actions));
    grid.appendChild(left);
    grid.appendChild(right);
    wrap.appendChild(grid);
    return wrap;
  }
  function customerServices(c) {
    const wrap = E('div', 'ws-grid');
    const left = E('div', 'ws-col-7');
    const plan = E('div');
    plan.appendChild(E('div', 'hint', c.services.plan));
    plan.appendChild(meterRow('续约倒计时', Math.max(0, 100 - Math.min(100, Math.max(0, (daysUntil(c.services.renewal) || 0) / 365 * 100))), 'warn'));
    plan.appendChild(E('div', 'hint', `续约日期 ${fmtDay(c.services.renewal)}`));
    left.appendChild(panel('服务计划', 'PLAN', plan));
    const scope = E('div', 'ws-list');
    c.services.scope.forEach(s => scope.appendChild(row({ title: s, sub: '服务范围', meta: 'SCOPE' })));
    c.services.entitlements.forEach(s => scope.appendChild(row({ title: s, sub: '客户权益', meta: 'RIGHT' })));
    left.appendChild(panel('范围与权益', 'SCOPE', scope));
    const right = E('div', 'ws-col-5');
    const kv = E('dl', 'ws-kv');
    [['SLA', c.services.sla], ['XLA', c.services.xla], ['支持时段', c.services.hours], ['续约', fmtDay(c.services.renewal)], ['ARR', c.arr]].forEach(([k, v]) => {
      kv.appendChild(E('dt', null, k));
      kv.appendChild(E('dd', null, v));
    });
    right.appendChild(panel('服务口径', 'SLA / XLA', kv));
    const records = E('div', 'ws-list');
    ws.data.service.filter(s => s.customerId === c.id).slice(0, 5).forEach(s => records.appendChild(row({
      title: s.title, sub: `${statusLabel(s.status)} · ${s.owner}`, meta: fmtDay(s.due),
      onclick: () => navigate(`record/${s.id}`),
    })));
    if (!records.children.length) records.appendChild(E('div', 'hint', '暂无服务执行记录。'));
    const recPanel = panel('服务执行记录', 'RECORDS', records);
    recPanel.appendChild(link('查看全部范围与权益 →', '#portfolio/service-scope'));
    right.appendChild(recPanel);
    wrap.appendChild(left);
    wrap.appendChild(right);
    return wrap;
  }
  function customerTech(c) {
    const wrap = E('div');
    const grid = E('div', 'ws-grid');
    const left = E('div', 'ws-col-7');
    left.appendChild(panel('架构摘要', 'ARCH', E('p', null, c.tech.architecture)));
    const assetRows = c.tech.assets.map(a => ({ cells: [a.name, a.type, a.version, { node: status(a.status) }] }));
    left.appendChild(panel('技术资产', `${c.tech.assets.length} ASSETS`, table(['资产', '类型', '版本', '状态'], assetRows)));
    const eolRows = c.tech.eol.map(e => ({ cells: [e.name, fmtDay(e.eol), { node: status(e.risk === '高' ? '高风险' : e.risk) }] }));
    left.appendChild(panel('版本生命周期', 'EOL', eolRows.length ? table(['组件', 'EOL', '风险'], eolRows) : empty('暂无 EOL 风险', '版本生命周期会在这里跟踪。')));
    const right = E('div', 'ws-col-5');
    const config = E('div', 'ws-list');
    c.tech.config.forEach(item => config.appendChild(row({ title: item, sub: '关键配置', meta: 'CFG' })));
    if (!config.children.length) config.appendChild(E('div', 'hint', '暂无关键配置记录。'));
    right.appendChild(panel('关键配置', 'CONFIG', config));
    const risks = E('div', 'ws-list');
    c.risks.slice(0, 4).forEach(r => risks.appendChild(row({ title: r.title, sub: `${r.owner} · ${r.status}`, meta: fmtDay(r.due) })));
    right.appendChild(panel('技术风险', 'RISKS', risks));
    grid.appendChild(left);
    grid.appendChild(right);
    wrap.appendChild(grid);
    return wrap;
  }
  function customerRisks(c) {
    const wrap = E('div');
    const linked = (state.history || []).filter(h => ws.data.investigationLinks[h.id] === c.id);
    const rows = c.risks.map(r => ({
      cells: [
        { node: status(r.level === '高' ? '高风险' : r.level) },
        { node: (() => { const d = E('div'); d.appendChild(E('div', 'title', r.title)); d.appendChild(E('div', 'sub', r.desc)); return d; })() },
        r.owner, { node: status(r.status) }, fmtDay(r.due),
      ],
    }));
    wrap.appendChild(panel('风险登记', `${c.risks.length} RISKS`, rows.length ? table(['级别', '风险', '负责人', '状态', '期限'], rows) : empty('暂无登记风险', '从服务执行的“风险登记册”登记新风险。', btn('登记风险', () => navigate('service/risk-register'), 'ghost small')), { sub: '权威数据属于服务执行 / 风险登记册' }));
    const events = E('div');
    if (c.events.length) events.appendChild(timeline(c.events.map(e => ({ date: e.date, type: e.sev, title: e.title, detail: `${e.status} · ${e.detail}` }))));
    else events.appendChild(empty('暂无客户事件', '事件权威数据属于事件与问题模块。', btn('查看工单', () => navigate('incidents'), 'ghost small')));
    wrap.appendChild(panel('事件与工单', `${c.events.length} EVENTS`, events, { sub: '客户视角的回放，不复制权威台账' }));
    if (linked.length) {
      const box = E('div', 'ws-list');
      linked.forEach(h => box.appendChild(row({ title: h.root_cause || h.alert_id, sub: h.status, meta: fmtDate(h.created_at), onclick: () => navigate(`event/${h.id}`) })));
      wrap.appendChild(panel('关联排查', 'INVESTIGATIONS', box));
    }
    return wrap;
  }
  function customerAdoption(c) {
    const wrap = E('div', 'ws-grid');
    const left = E('div', 'ws-col-7');
    const metrics = E('div');
    c.adoption.metrics.forEach(m => {
      const ratio = metricPercent(m.value, m.target);
      metrics.appendChild(meterRow(`${m.label} · ${m.value} / ${m.target}`, ratio, ratio < 60 ? 'crit' : ratio < 85 ? 'warn' : 'ok'));
    });
    left.appendChild(panel('采纳指标', 'ADOPTION', metrics));
    const ledgerRows = c.adoption.ledger.map(v => ({
      cells: [{ node: (() => { const d = E('div'); d.appendChild(E('div', 'title', v.item)); d.appendChild(E('div', 'sub', fmtDay(v.date))); return d; })() }, v.value],
    }));
    left.appendChild(panel('价值账本', `${c.adoption.ledger.length} ITEMS`, ledgerRows.length ? table(['价值项', '证明'], ledgerRows) : empty('暂无价值记录', '把可证明的客户结果记入价值账本。')));
    const right = E('div', 'ws-col-5');
    const qbr = E('div', 'ws-assist-block');
    qbr.appendChild(E('div', 'label', '下一业务回顾'));
    qbr.appendChild(E('p', null, c.adoption.qbr?.date ? `${fmtDay(c.adoption.qbr.date)} · ${c.adoption.qbr.status}` : '未排期'));
    right.appendChild(panel('QBR / EBR', 'BUSINESS REVIEW', qbr));
    const actions = E('div', 'ws-action-stack');
    actions.appendChild(btn('打开 QBR 流程', () => navigate('workflows/tool-08-qbr-ebr-template'), 'ghost small'));
    actions.appendChild(btn('生成价值报告', () => createCommitmentModal({ customerId: c.id, type: 'vbr-value', title: `${c.name} · 价值报告` }), 'ghost small'));
    actions.appendChild(btn('记录价值项', () => addValueItem(c), 'ghost small'));
    right.appendChild(panel('经营动作', 'ACTIONS', actions));
    wrap.appendChild(left);
    wrap.appendChild(right);
    return wrap;
  }
  function metricPercent(value, target) {
    const parse = v => {
      const s = String(v || '');
      if (s.includes('/')) { const [a, b] = s.split('/').map(Number); return b ? a / b * 100 : 0; }
      const n = parseFloat(s.replace(/[^\d.]/g, ''));
      return Number.isFinite(n) ? n : 0;
    };
    const t = parse(target);
    return t ? Math.min(100, parse(value) / t * 100) : 0;
  }
  function addValueItem(c) {
    const title = input('text', '');
    const value = input('text', '');
    const form = E('div', 'ws-form');
    form.appendChild(formField('价值项', title, true));
    form.appendChild(formField('证明 / 结果', value, true));
    openModal('记录价值项', form, [
      btn('取消', closeOverlays),
      btn('保存', () => {
        if (!title.value.trim()) { toast('请填写价值项', 'error'); return; }
        c.adoption.ledger.unshift({ item: title.value.trim(), value: value.value.trim() || '待补充', date: nowIso() });
        c.timeline.unshift({ date: nowIso(), type: '价值', title: title.value.trim(), detail: value.value.trim() });
        save();
        closeOverlays();
        rerender();
        toast('价值项已记录', 'ok');
      }, 'primary'),
    ]);
  }
  function customerRelations(c) {
    const wrap = E('div');
    const grid = E('div', 'ws-grid');
    const people = E('div');
    c.relations.forEach(r => {
      people.appendChild(row({
        leading: status(r.stance === '支持' ? '健康' : r.stance === '中性' ? '关注' : '预警'),
        title: `${r.name} · ${r.role}`, sub: r.note, meta: r.stance,
        grid: 'auto minmax(0,1fr) auto',
      }));
    });
    if (!c.relations.length) people.appendChild(E('div', 'hint', '暂无关键人记录。'));
    const left = E('div', 'ws-col-7');
    left.appendChild(panel('关键人与立场', `${c.relations.length} PEOPLE`, people));
    const team = E('div', 'ws-list');
    c.team.forEach(name => team.appendChild(row({ title: name, sub: name === c.owner ? '客户负责人' : '协同成员', meta: isMe(name) ? 'ME' : 'TEAM' })));
    const right = E('div', 'ws-col-5');
    right.appendChild(panel('内部协同', 'TEAM', team));
    const collabs = E('div', 'ws-list');
    ws.data.collab.filter(x => x.customerId === c.id).slice(0, 5).forEach(x => collabs.appendChild(row({
      title: x.title, sub: `${x.status} · ${x.owner}`, meta: fmtDate(x.date),
      onclick: () => navigate(`record/${x.id}`),
    })));
    if (!collabs.children.length) collabs.appendChild(E('div', 'hint', '暂无协同记录。'));
    right.appendChild(panel('承诺与会议', 'COLLAB', collabs));
    grid.appendChild(left);
    grid.appendChild(right);
    wrap.appendChild(grid);
    return wrap;
  }
  function customerSignals(c) {
    const wrap = E('div');
    const signals = D.SIGNALS.filter(s => s.customerId === c.id).concat(c.signals.map(s => ({
      level: s.confidence === '高' ? '高' : '中', title: s.title, type: s.type, owner: c.owner, date: s.date,
    })));
    const rows = signals.map(s => ({
      cells: [{ node: status(s.level === '高' ? '高风险' : s.type) }, s.title, s.type, s.owner, fmtDay(s.date)],
    }));
    wrap.appendChild(panel('经营信号', `${signals.length} SIGNALS`, rows.length ? table(['级别', '信号', '类型', '负责人', '日期'], rows) : empty('暂无经营信号', '在协同与经营中记录续约、增购或流失信号。'), { sub: '客户视角过滤；权威数据属于协同与经营' }));
    const grid = E('div', 'ws-grid');
    const renewal = E('div');
    renewal.appendChild(meterRow('续约倒计时', Math.max(0, Math.min(100, 100 - (daysUntil(c.renewal) || 0) / 365 * 100)), daysUntil(c.renewal) < 90 ? 'warn' : 'ok'));
    renewal.appendChild(E('div', 'hint', `续约日期 ${fmtDay(c.renewal)} · 剩余 ${daysUntil(c.renewal)} 天`));
    const left = E('div', 'ws-col-6');
    left.appendChild(panel('续约', 'RENEWAL', renewal));
    const health = E('div');
    c.factors.forEach(f => health.appendChild(meterRow(f.label, f.score, f.score < 60 ? 'crit' : f.score < 75 ? 'warn' : 'ok')));
    const right = E('div', 'ws-col-6');
    right.appendChild(panel('健康信号', `SCORE ${c.health}`, health));
    grid.appendChild(left);
    grid.appendChild(right);
    wrap.appendChild(grid);
    return wrap;
  }
  function customerTimelineItems(c) {
    const items = (c.timeline || []).map(x => ({ date: x.date, type: x.type, title: x.title, detail: x.detail }));
    openLocalTasks().filter(t => t.customerId === c.id).forEach(t => items.push({
      date: t.updatedAt || t.createdAt, type: '任务', title: t.title, detail: `${statusLabel(t.status)} · ${t.owner}`,
    }));
    ws.data.collab.filter(x => x.customerId === c.id).forEach(x => items.push({
      date: x.date, type: '协同', title: x.title, detail: x.decision || x.status,
    }));
    ws.data.service.filter(x => x.customerId === c.id).forEach(x => items.push({
      date: x.updatedAt, type: '服务', title: x.title, detail: `${x.stage} · ${x.status}`,
    }));
    (state.history || []).filter(h => ws.data.investigationLinks[h.id] === c.id).forEach(h => items.push({
      date: h.created_at, type: '事件', title: h.root_cause || h.alert_id, detail: h.status,
    }));
    return items.sort((a, b) => new Date(b.date) - new Date(a.date));
  }
  function customerTimeline(c) {
    return panel('统一时间线', `${customerTimelineItems(c).length} EVENTS`, timeline(customerTimelineItems(c)), { sub: '承诺、会议、变更、事件、QBR 与决策在同一时间线上' });
  }
  function customerArchive(c) {
    const wrap = E('div', 'ws-grid');
    const left = E('div', 'ws-col-7');
    const info = E('dl', 'ws-kv');
    [['交接状态', c.archive.status || '未启动'], ['责任人', c.archive.owner || c.owner], ['客户确认', '待确认'], ['备注', c.archive.note || '—']].forEach(([k, v]) => {
      info.appendChild(E('dt', null, k));
      info.appendChild(E('dd', null, v));
    });
    left.appendChild(panel('档案与交接', 'HANDOVER', info));
    const docs = E('div', 'ws-list');
    (c.archive.docs || []).forEach(d => docs.appendChild(row({ title: d, sub: '客户档案', meta: 'DOC' })));
    if (!docs.children.length) docs.appendChild(E('div', 'hint', '暂无档案清单。'));
    left.appendChild(panel('档案清单', `${(c.archive.docs || []).length} DOCS`, docs));
    const right = E('div', 'ws-col-5');
    const checklist = E('div');
    ['服务与合同摘要', '架构与配置基线', '关键人与关系地图', '风险与在办事项', '客户确认与知会'].forEach(item => {
      checklist.appendChild(row({ leading: status('待完成'), title: item, sub: '离任交接检查项', grid: 'auto minmax(0,1fr)' }));
    });
    right.appendChild(panel('交接检查', 'CHECKLIST', checklist));
    const actions = E('div', 'ws-action-stack');
    actions.appendChild(btn('发起交接任务', () => createHandoverTask(c), 'primary small'));
    actions.appendChild(btn('生成客户简报', () => customerBrief(c), 'ghost small'));
    actions.appendChild(btn('查看全部档案', () => navigate('portfolio/archive'), 'ghost small'));
    right.appendChild(panel('动作', 'ACTIONS', actions));
    wrap.appendChild(left);
    wrap.appendChild(right);
    return wrap;
  }

  /* ---------- lifecycle / portfolio ---------- */
  function renderLifecycle(stage) {
    const page = E('div');
    if (stage) {
      const info = D.LIFECYCLE.find(s => s.key === stage);
      if (!info) return empty('未知阶段', '请返回客户生命周期总览。');
      const customers = ws.data.customers.filter(c => c.stageKey === stage);
      page.appendChild(pageHead(info.label, `阶段目标、闸门与当前客户；权威流程来自 TAM 手册。`, [
        btn('返回生命周期', () => navigate('lifecycle'), 'ghost small'),
        btn('客户列表', () => navigate('customers'), 'ghost small'),
      ]));
      const grid = E('div', 'ws-grid');
      const gates = E('div');
      (LIFECYCLE_GATES[stage] || []).forEach(g => gates.appendChild(row({ leading: status('闸门'), title: g, sub: '进入下一阶段前需提供证据', grid: 'auto minmax(0,1fr)' })));
      const left = E('div', 'ws-col-7');
      left.appendChild(panel('阶段闸门', 'GATES', gates));
      const list = E('div', 'ws-list');
      customers.forEach(c => list.appendChild(row({
        leading: status(c.health < 70 ? '预警' : '健康'), title: c.name,
        sub: `${c.owner} · 健康 ${c.health} · ${c.next}`, meta: fmtDay(c.nextDate),
        onclick: () => navigate(`customer/${c.id}/lifecycle`), grid: 'auto minmax(0,1fr) auto',
      })));
      if (!customers.length) list.appendChild(E('div', 'hint', '当前没有处于该阶段的客户。'));
      left.appendChild(panel('阶段客户', `${customers.length} CUSTOMERS`, list));
      const right = E('div', 'ws-col-5');
      const links = E('div', 'ws-list');
      links.appendChild(row({ title: '客户全生命周期运营', sub: '第 11 章', href: '#book/ch11-customer-lifecycle', meta: 'READ' }));
      links.appendChild(row({ title: '生命周期实战流程', sub: '开始流程并留证', href: '#workflows/practice-ch11-customer-lifecycle', meta: 'RUN' }));
      links.appendChild(row({ title: '服务计划模板', sub: '模板 01', href: '#book/01-service-plan', meta: 'TPL' }));
      right.appendChild(panel('阶段资料', 'GUIDE', links));
      grid.appendChild(left);
      grid.appendChild(right);
      page.appendChild(grid);
      return page;
    }
    page.appendChild(pageHead('客户生命周期', '从售前移交到退出的七个阶段；点击阶段查看闸门与客户。', [
      btn('客户列表', () => navigate('customers'), 'ghost small'),
    ]));
    const stages = E('div', 'ws-stages');
    D.LIFECYCLE.forEach((s, index) => {
      const count = ws.data.customers.filter(c => c.stageKey === s.key).length;
      const box = E('div', 'ws-stage');
      box.style.cursor = 'pointer';
      box.appendChild(E('div', 'n', `0${index + 1}`));
      box.appendChild(E('div', 't', s.label));
      box.appendChild(E('div', 'mark', `${count} 客户`));
      box.addEventListener('click', () => navigate(`lifecycle/${s.key}`));
      stages.appendChild(box);
    });
    page.appendChild(stages);
    const grid = E('div', 'ws-grid');
    D.LIFECYCLE.forEach((s, index) => {
      const customers = ws.data.customers.filter(c => c.stageKey === s.key);
      const body = E('div', 'ws-list');
      customers.forEach(c => body.appendChild(row({
        leading: status(c.health < 70 ? '预警' : '健康'), title: c.name,
        sub: `${c.owner} · ${c.next}`, meta: `${c.health}`,
        onclick: () => navigate(`customer/${c.id}/${'lifecycle'}`), grid: 'auto minmax(0,1fr) auto',
      })));
      if (!customers.length) body.appendChild(E('div', 'hint', '暂无客户'));
      const col = E('div', index < 4 ? 'ws-col-3' : 'ws-col-4');
      const p = panel(s.label, `${customers.length}`, body);
      p.appendChild(link('查看阶段 →', `#lifecycle/${s.key}`));
      col.appendChild(p);
      grid.appendChild(col);
    });
    page.appendChild(grid);
    return page;
  }
  function renderPortfolio(param) {
    const page = E('div');
    const meta = portfolioMeta(param);
    page.appendChild(pageHead(meta.title, meta.sub, [btn('客户列表', () => navigate('customers'), 'ghost small')]));
    if (param === 'service-scope' || param === 'service-plan') {
      const rows = ws.data.customers.map(c => ({
        cells: [
          { node: (() => { const d = E('div'); d.appendChild(E('div', 'title', c.name)); d.appendChild(E('div', 'sub', `${c.tier} · ${c.stage}`)); return d; })() },
          c.services.plan, c.services.sla, c.services.xla, c.services.hours, fmtDay(c.services.renewal), c.owner,
        ],
        __onclick: () => navigate(`customer/${c.id}/services`),
      }));
      page.appendChild(table(['客户', '服务计划', 'SLA', 'XLA', '支持时段', '续约', '负责人'], rows));
      const grid = E('div', 'ws-grid');
      const scope = E('div');
      ws.data.customers.forEach(c => {
        c.services.scope.slice(0, 2).forEach(s => scope.appendChild(row({ title: s, sub: c.name, meta: 'SCOPE' })));
      });
      const left = E('div', 'ws-col-7');
      left.appendChild(panel('服务范围', 'SCOPE', scope));
      const links = E('div', 'ws-list');
      links.appendChild(row({ title: '服务计划模板', sub: '模板 01', href: '#book/01-service-plan', meta: 'TPL' }));
      links.appendChild(row({ title: '年度服务节奏', sub: '第 11 章', href: '#book/ch11-customer-lifecycle', meta: 'READ' }));
      const right = E('div', 'ws-col-5');
      right.appendChild(panel('资料', 'GUIDE', links));
      grid.appendChild(left);
      grid.appendChild(right);
      page.appendChild(grid);
      return page;
    }
    if (param === 'tech-assets') {
      const rows = [];
      ws.data.customers.forEach(c => c.tech.assets.forEach(a => rows.push({
        cells: [
          { node: (() => { const d = E('div'); d.appendChild(E('div', 'title', a.name)); d.appendChild(E('div', 'sub', c.name)); return d; })() },
          a.type, a.version, { node: status(a.status) }, c.owner,
        ],
        __onclick: () => navigate(`customer/${c.id}/tech`),
      })));
      page.appendChild(table(['资产', '类型', '版本', '状态', '负责人'], rows));
      const eolRows = [];
      ws.data.customers.forEach(c => c.tech.eol.forEach(e => eolRows.push({
        cells: [e.name, c.name, fmtDay(e.eol), { node: status(e.risk === '高' ? '高风险' : e.risk) }],
      })));
      page.appendChild(panel('EOL 风险', `${eolRows.length} ITEMS`, eolRows.length ? table(['组件', '客户', 'EOL', '风险'], eolRows) : empty('暂无 EOL 风险', '版本生命周期会在这里汇总。')));
      return page;
    }
    if (param === 'adoption') {
      const rows = [];
      ws.data.customers.forEach(c => c.adoption.metrics.forEach(m => rows.push({
        cells: [c.name, m.label, m.value, m.target, { node: (() => { const p = metricPercent(m.value, m.target); return meter(p, p < 60 ? 'crit' : p < 85 ? 'warn' : 'ok'); })() }],
        __onclick: () => navigate(`customer/${c.id}/adoption`),
      })));
      page.appendChild(table(['客户', '指标', '当前', '目标', '进度'], rows));
      const ledger = [];
      ws.data.customers.forEach(c => c.adoption.ledger.forEach(v => ledger.push({
        cells: [c.name, v.item, v.value, fmtDay(v.date)],
      })));
      page.appendChild(panel('价值账本', `${ledger.length} ITEMS`, ledger.length ? table(['客户', '价值项', '证明', '日期'], ledger) : empty('暂无价值记录', '在客户 360° 中记录价值项。')));
      return page;
    }
    if (param === 'health') {
      const grid = E('div', 'ws-grid');
      ws.data.customers.slice().sort((a, b) => a.health - b.health).forEach(c => {
        const col = E('div', 'ws-col-4');
        const body = E('div');
        const score = E('div', `ws-health-score ${c.health < 70 ? 'crit' : c.health < 80 ? 'warn' : 'ok'}`);
        score.appendChild(E('strong', null, String(c.health)));
        score.appendChild(E('span', null, '健康分'));
        body.appendChild(score);
        const factors = E('div', 'ws-health-factors');
        c.factors.forEach(f => factors.appendChild(meterRow(f.label, f.score, f.score < 60 ? 'crit' : f.score < 75 ? 'warn' : 'ok')));
        body.appendChild(factors);
        const p = panel(c.name, `${c.health} · ${c.healthLabel}`, body, { sub: c.topRisk });
        p.addEventListener('click', () => navigate(`customer/${c.id}/signals`));
        p.style.cursor = 'pointer';
        col.appendChild(p);
        grid.appendChild(col);
      });
      page.appendChild(grid);
      return page;
    }
    if (param === 'relations') {
      const rows = [];
      ws.data.customers.forEach(c => c.relations.forEach(r => rows.push({
        cells: [
          { node: (() => { const d = E('div'); d.appendChild(E('div', 'title', r.name)); d.appendChild(E('div', 'sub', r.role)); return d; })() },
          c.name, { node: status(r.stance === '支持' ? '健康' : r.stance === '中性' ? '关注' : '预警') }, r.note, c.owner,
        ],
        __onclick: () => navigate(`customer/${c.id}/relations`),
      })));
      page.appendChild(table(['关键人', '客户', '立场', '备注', '负责人'], rows));
      return page;
    }
    if (param === 'value') {
      const rows = [];
      ws.data.customers.forEach(c => c.adoption.ledger.forEach(v => rows.push({
        cells: [c.name, v.item, v.value, fmtDay(v.date)], __onclick: () => navigate(`customer/${c.id}/adoption`),
      })));
      page.appendChild(table(['客户', '价值项', '证明', '日期'], rows));
      return page;
    }
    if (param === 'archive') {
      const rows = ws.data.customers.map(c => ({
        cells: [
          { node: (() => { const d = E('div'); d.appendChild(E('div', 'title', c.name)); d.appendChild(E('div', 'sub', `${c.stage} · ${c.owner}`)); return d; })() },
          { node: status(c.archive.status === '未启动' ? '未开始' : c.archive.status) },
          (c.archive.docs || []).length, c.archive.owner || c.owner, c.archive.note || '—',
        ],
        __onclick: () => navigate(`customer/${c.id}/archive`),
      }));
      page.appendChild(table(['客户', '交接状态', '档案数', '责任人', '备注'], rows));
      return page;
    }
    page.appendChild(empty('选择客户工作视图', '从左侧选择客户总览、服务计划、健康度或价值账本。'));
    return page;
  }

  /* ---------- service execution ---------- */
  async function openServiceRoute(key) {
    if (!key) {
      showPage(null, '服务执行', '架构评审、风险、变更、重保等跨客户工作队列', () => renderServiceOverview());
      return;
    }
    await openServicePage(key);
  }
  function renderServiceOverview() {
    const page = E('div');
    const records = ws.data.service.slice();
    const open = records.filter(r => !['已关闭', '已完成'].includes(r.status));
    const overdue = open.filter(r => r.due && daysUntil(r.due) < 0);
    page.appendChild(pageHead('服务执行', '架构评审、风险、变更、重保等跨客户工作队列；每个对象使用统一详情骨架。', [
      btn('新建记录', () => pickServiceType(), 'primary small'),
      btn('重大保障', () => navigate('service/major-assurance'), 'ghost small'),
    ]));
    page.appendChild(kpis([
      { label: '服务记录', value: records.length, sub: `${open.length} 个未关闭` },
      { label: '待审批/验证', value: records.filter(r => ['待审批', '待验证', '待会签'].includes(r.status)).length, sub: '需要明确结论', kind: 'warn' },
      { label: '逾期', value: overdue.length, sub: overdue.length ? overdue[0].title : '无逾期', kind: overdue.length ? 'crit' : 'ok' },
      { label: '服务对象', value: Object.keys(D.SERVICE_PAGES).length, sub: '架构 / 变更 / 重保 / 容量…' },
    ]));
    const rows = records.map(r => ({
      cells: [
        { node: (() => { const d = E('div'); d.appendChild(E('div', 'title', r.title)); d.appendChild(E('div', 'sub', `${(serviceType(r.type) || {}).title || r.type} · ${r.stage}`)); return d; })() },
        customerName(r.customerId), r.owner, { node: status(r.status) }, fmtDay(r.due),
      ],
      __onclick: () => navigate(`record/${r.id}`),
    }));
    page.appendChild(panel('全部工作队列', `${records.length} ITEMS`, table(['事项', '客户', '负责人', '状态', '期限'], rows)));
    const grid = E('div', 'ws-grid');
    const types = E('div', 'ws-list');
    Object.entries(D.SERVICE_PAGES).forEach(([key, info]) => {
      const count = records.filter(r => r.type === key && !['已关闭', '已完成'].includes(r.status)).length;
      types.appendChild(row({ title: info.title, sub: info.note, meta: `${count} OPEN`, onclick: () => navigate(`service/${key}`) }));
    });
    const left = E('div', 'ws-col-7');
    left.appendChild(panel('按对象查看', 'QUEUES', types));
    const guide = E('div', 'ws-list');
    guide.appendChild(row({ title: 'TAM 体系流程与规范', sub: '附录 B', href: '#book/appx-b-tam-process-system', meta: 'READ' }));
    guide.appendChild(row({ title: '模板与 Checklist', sub: '19 个模板', href: '#knowledge/templates', meta: 'TPL' }));
    guide.appendChild(row({ title: '风险与合规', sub: '第 9 章', href: '#book/ch09-risk-compliance', meta: 'READ' }));
    const right = E('div', 'ws-col-5');
    right.appendChild(panel('方法与依据', 'GUIDE', guide));
    grid.appendChild(left);
    grid.appendChild(right);
    page.appendChild(grid);
    return page;
  }
  function pickServiceType() {
    const type = select(Object.entries(D.SERVICE_PAGES).map(([key, info]) => ({ value: key, label: info.title })), 'architecture-review');
    openModal('新建服务记录', formField('服务对象', type, true), [
      btn('取消', closeOverlays),
      btn('继续', () => {
        closeOverlays();
        createServiceRecordModal(type.value, serviceType(type.value));
      }, 'primary'),
    ]);
  }
  async function openServicePage(key) {
    const info = serviceType(key);
    if (!info) {
      showPage('service-architecture-review', '服务执行', '未知服务对象', () => empty('未找到该服务对象', '请从左侧服务执行菜单进入。'));
      return;
    }
    showAsyncPage(`service-${key}`, info.title, info.note, async () => renderServicePage(key, info));
  }
  function renderServicePage(key, info) {
    const page = E('div');
    const records = ws.data.service.filter(r => r.type === key);
    const open = records.filter(r => !['已关闭', '已完成', 'closed'].includes(r.status));
    const pending = records.filter(r => ['待审批', '待验证', '待会签', '待确认'].includes(r.status));
    const overdue = open.filter(r => r.due && daysUntil(r.due) < 0);
    page.appendChild(pageHead(info.title, info.note, [
      btn('新建记录', () => createServiceRecordModal(key, info), 'primary small'),
      btn('返回服务执行', () => navigate('service'), 'ghost small'),
    ]));
    page.appendChild(kpis([
      { label: '记录总数', value: records.length, sub: `${open.length} 个未关闭` },
      { label: '待审批/验证', value: pending.length, sub: '需要明确结论', kind: pending.length ? 'warn' : '' },
      { label: '逾期', value: overdue.length, sub: overdue.length ? overdue[0].title : '无逾期', kind: overdue.length ? 'crit' : 'ok' },
      { label: '已关闭', value: records.filter(r => ['已关闭', '已完成'].includes(r.status)).length, sub: '已验证并归档' },
    ]));
    const rows = records.map(r => ({
      cells: [
        { node: (() => { const d = E('div'); d.appendChild(E('div', 'title', r.title)); d.appendChild(E('div', 'sub', r.stage)); return d; })() },
        customerName(r.customerId), r.owner, { node: status(r.status) }, fmtDay(r.due), r.approval || '—',
      ],
      __onclick: () => navigate(`record/${r.id}`),
    }));
    page.appendChild(panel('工作队列', `${records.length} ITEMS`, rows.length ? table(['事项', '客户', '负责人', '状态', '期限', '审批'], rows) : empty('暂无记录', '新建一条记录开始执行。', btn('新建记录', () => createServiceRecordModal(key, info), 'primary small'))));
    const grid = E('div', 'ws-grid');
    const guide = E('div', 'ws-list');
    guide.appendChild(row({ title: '对应手册', sub: '打开章节原文', href: `#book/${info.book}`, meta: 'READ' }));
    guide.appendChild(row({ title: '执行流程', sub: '开始可执行流程', href: `#workflows/${info.workflow}`, meta: 'RUN' }));
    guide.appendChild(row({ title: '模板 / Checklist', sub: '打开模板', href: `#book/${info.template}`, meta: 'TPL' }));
    const left = E('div', 'ws-col-7');
    left.appendChild(panel('方法与依据', 'GUIDE', guide));
    const patterns = E('div');
    patterns.appendChild(E('p', null, info.note));
    patterns.appendChild(E('div', 'hint', '所有记录使用统一详情骨架：基本信息、当前结论、执行内容、协作、关联、时间线与关闭标准。'));
    const right = E('div', 'ws-col-5');
    right.appendChild(panel('执行要点', 'STANDARD', patterns));
    grid.appendChild(left);
    grid.appendChild(right);
    page.appendChild(grid);
    return page;
  }
  function createServiceRecordModal(key, info) {
    const title = input('text', '');
    const customer = select(customerOptions(), defaultCustomerId());
    const owner = select([meName(), '陈默', '赵启', '李衡', '王珂', '林晓'], meName());
    const statusValue = select(['待启动', '进行中', '待审批', '待验证', '已关闭'], '进行中');
    const due = input('date', D.dateOnly(7));
    const summary = textarea('', '目标、范围与当前结论');
    const evidence = input('text', '');
    const approval = input('text', '');
    const form = E('div', 'ws-form');
    form.appendChild(formField('事项', title, true));
    form.appendChild(formField('客户', customer));
    form.appendChild(formField('负责人', owner));
    form.appendChild(formField('状态', statusValue));
    form.appendChild(formField('期限', due));
    form.appendChild(formField('摘要', summary, true));
    form.appendChild(formField('证据', evidence));
    form.appendChild(formField('审批 / 验收', approval));
    openModal(`新建 · ${info.title}`, form, [
      btn('取消', closeOverlays),
      btn('创建', () => {
        if (!title.value.trim()) { toast('请填写事项标题', 'error'); return; }
        const rec = {
          id: id('s'), type: key, title: title.value.trim(),
          customerId: customer.value || '', owner: owner.value, status: statusValue.value,
          due: due.value ? new Date(`${due.value}T17:00:00`).toISOString() : null,
          stage: statusValue.value, summary: summary.value.trim(),
          evidence: evidence.value.trim(), approval: approval.value.trim(),
          timeline: [{ date: nowIso(), text: '记录创建' }], createdAt: nowIso(), updatedAt: nowIso(),
        };
        ws.data.service.unshift(rec);
        save();
        closeOverlays();
        navigate(`record/${rec.id}`);
        toast('服务记录已创建', 'ok');
      }, 'primary'),
    ]);
  }

  /* ---------- generic record detail ---------- */
  async function openRecordDetail(rid) {
    const rec = recordById(rid);
    if (!rec) {
      showPage('service-architecture-review', '记录不存在', '未找到该记录', () => empty('记录不存在', '它可能已被删除。', btn('返回客户列表', () => navigate('customers'))));
      return;
    }
    const isService = !!serviceType(rec.type);
    const info = isService ? serviceType(rec.type) : collabType(rec.type) || { title: '协同记录' };
    const nav = isService ? `service-${rec.type}` : `collab-${rec.type}`;
    showPage(nav, rec.title, `${info.title} · ${customerName(rec.customerId)} · ${statusLabel(rec.status)}`, () => renderRecordDetail(rec, info, isService));
  }
  function renderRecordDetail(rec, info, isService) {
    const page = E('div');
    page.appendChild(pageHead(rec.title, `${info.title} · ${customerName(rec.customerId)} · ${rec.owner}`, [
      btn('返回队列', () => navigate(isService ? `service/${rec.type}` : `collab/${rec.type}`), 'ghost small'),
    ]));
    const layout = E('div', 'ws-skeleton');
    const sections = E('div', 'ws-sections');
    const section = (n, title, body) => {
      const box = E('section', 'ws-section');
      const head = E('div', 'ws-section-head');
      head.appendChild(E('h3', null, title));
      head.appendChild(E('span', 'n', `0${n}`));
      box.appendChild(head);
      const content = E('div', 'ws-section-body');
      if (body && body.nodeType) content.appendChild(body);
      else content.textContent = body || '—';
      box.appendChild(content);
      return box;
    };
    const kv = pairs => {
      const dl = E('dl', 'ws-kv');
      pairs.forEach(([k, v]) => {
        dl.appendChild(E('dt', null, k));
        const dd = E('dd');
        if (v && v.nodeType) dd.appendChild(v);
        else dd.textContent = v || '—';
        dl.appendChild(dd);
      });
      return dl;
    };
    sections.appendChild(section(1, '基本信息', kv([
      ['对象', rec.title], ['客户', customerName(rec.customerId)], ['负责人', rec.owner],
      ['状态', status(rec.status)], ['期限', rec.due ? fmtDay(rec.due) : rec.date ? fmtDate(rec.date) : '—'],
      ['类型', info.title],
    ])));
    const conclusion = E('div');
    conclusion.appendChild(E('p', null, rec.summary || rec.decision || '尚未填写当前结论。'));
    conclusion.appendChild(E('div', 'hint', rec.status === '已关闭' || rec.status === '已完成' ? '下一步：归档并关联到客户时间线。' : '下一步：补齐证据与审批，推进到可验证状态。'));
    sections.appendChild(section(2, '当前结论', conclusion));
    const exec = E('div');
    if (isService) {
      exec.appendChild(kv([['执行阶段', rec.stage || '—'], ['证据', rec.evidence || '待补充'], ['审批', rec.approval || '待补充']]));
    } else {
      exec.appendChild(kv([['参与人', (rec.participants || []).join('、') || '—'], ['结论 / 承诺', rec.decision || '—'], ['行动项', (rec.actions || []).join('；') || '—']]));
    }
    sections.appendChild(section(3, '执行内容', exec));
    sections.appendChild(section(4, '协作信息', kv([
      ['客户团队', (customerById(rec.customerId)?.team || []).join('、') || '—'],
      ['等待方', rec.approval || rec.status === '待验证' ? '验收人' : '—'],
      ['关联承诺', (ws.data.collab.find(c => c.customerId === rec.customerId && c.type === 'presales-handover') || {}).title || '—'],
    ])));
    const related = E('div', 'ws-list');
    if (rec.customerId) related.appendChild(row({ title: `${customerName(rec.customerId)} · 客户 360°`, href: `#customer/${rec.customerId}` }));
    if (isService) {
      related.appendChild(row({ title: '执行流程', href: `#workflows/${info.workflow}` }));
      related.appendChild(row({ title: '模板 / Checklist', href: `#book/${info.template}` }));
    } else {
      related.appendChild(row({ title: '协同流程', href: `#workflows/${info.workflow}` }));
    }
    sections.appendChild(section(5, '关联对象', related));
    sections.appendChild(section(6, '时间线', timeline((rec.timeline || []).slice().reverse())));
    sections.appendChild(section(7, '关闭标准', kv([
      ['验收人', rec.approval || '客户 / 负责人'], ['验证证据', rec.evidence || '关键证据归档'],
      ['后续动作', '关闭后保留在客户时间线，必要时生成改进项'],
    ])));
    const aside = E('div', 'ws-aside');
    const actions = E('div', 'ws-action-stack');
    actions.appendChild(btn(recordActionLabel(rec, isService), () => advanceRecord(rec, isService), 'primary small'));
    if (rec.status !== '已关闭' && rec.status !== '已完成') actions.appendChild(btn('记录跟进', () => addRecordNote(rec), 'ghost small'));
    else actions.appendChild(btn('重新打开', () => { rec.status = '进行中'; rec.timeline.push({ date: nowIso(), text: '重新打开' }); save(); rerender(); }, 'ghost small'));
    aside.appendChild(panel('动作', 'ACTIONS', actions));
    const meta = E('div', 'ws-list');
    meta.appendChild(row({ title: '记录 ID', sub: rec.id, meta: 'ID' }));
    meta.appendChild(row({ title: '创建时间', sub: fmtDate(rec.createdAt) }));
    meta.appendChild(row({ title: '最近更新', sub: fmtDate(rec.updatedAt) }));
    aside.appendChild(panel('记录信息', 'META', meta));
    layout.appendChild(sections);
    layout.appendChild(aside);
    page.appendChild(layout);
    return page;
  }
  function recordActionLabel(rec, isService) {
    if (isService) {
      if (['已关闭', '已完成'].includes(rec.status)) return '已关闭';
      if (rec.status === '待验证') return '验证并关闭';
      if (rec.status === '待审批') return '审批通过';
      if (rec.status === '待启动') return '启动执行';
      return '提交验证';
    }
    if (['已完成', '已关闭'].includes(rec.status)) return '已完成';
    return '标记完成';
  }
  function advanceRecord(rec, isService) {
    if (isService) {
      rec.status = rec.status === '待启动' ? '进行中'
        : rec.status === '待审批' ? '进行中'
          : rec.status === '待验证' ? '已关闭'
            : rec.status === '进行中' ? '待验证' : '已关闭';
    } else {
      rec.status = rec.status === '草稿' ? '进行中' : '已完成';
    }
    rec.updatedAt = nowIso();
    rec.timeline = rec.timeline || [];
    rec.timeline.push({ date: nowIso(), text: `状态更新：${statusLabel(rec.status)}` });
    save();
    toast(`状态：${statusLabel(rec.status)}`, 'ok');
    rerender();
  }
  function addRecordNote(rec) {
    const note = textarea('', '记录审批、证据、客户反馈或下一步');
    openModal('记录跟进', formField('内容', note, true), [
      btn('取消', closeOverlays),
      btn('保存', () => {
        if (!note.value.trim()) { toast('请填写内容', 'error'); return; }
        rec.timeline = rec.timeline || [];
        rec.timeline.push({ date: nowIso(), text: note.value.trim() });
        rec.updatedAt = nowIso();
        save();
        closeOverlays();
        rerender();
        toast('已记录', 'ok');
      }, 'primary'),
    ]);
  }

  /* ---------- collaboration ---------- */
  async function openCollabRoute(key) {
    if (!key) {
      showPage(null, '协同与经营', '承诺、移交、需求、会议、商业信号与协同事项队列', () => renderCollabOverview());
      return;
    }
    await openCollabPage(key);
  }
  function renderCollabOverview() {
    const page = E('div');
    const records = ws.data.collab.slice();
    const open = records.filter(r => !['已完成', '已关闭'].includes(r.status));
    page.appendChild(pageHead('协同与经营', '承诺、移交、需求、会议、商业信号与协同事项；所有记录进入客户时间线。', [
      btn('记录承诺 / 会议', () => createCommitmentModal(), 'primary small'),
      btn('经营信号', () => navigate('collab/renewal-signals'), 'ghost small'),
    ]));
    page.appendChild(kpis([
      { label: '协同记录', value: records.length, sub: `${open.length} 个进行中` },
      { label: '待闭环', value: open.length, sub: '需要结论或行动项', kind: open.length ? 'warn' : 'ok' },
      { label: '会议 / 决策', value: records.filter(r => r.type === 'meeting-decisions').length, sub: '决策留痕' },
      { label: '经营信号', value: D.SIGNALS.length, sub: '续约 / 扩容 / 流失' },
    ]));
    const rows = records.map(r => ({
      cells: [
        { node: (() => { const d = E('div'); d.appendChild(E('div', 'title', r.title)); d.appendChild(E('div', 'sub', `${(collabType(r.type) || {}).title || r.type} · ${customerName(r.customerId)}`)); return d; })() },
        r.owner, { node: status(r.status) }, fmtDate(r.date), r.decision || '—',
      ],
      __onclick: () => navigate(`record/${r.id}`),
    }));
    page.appendChild(panel('协同事项', `${records.length} ITEMS`, table(['事项', '负责人', '状态', '日期', '结论 / 承诺'], rows)));
    const grid = E('div', 'ws-grid');
    const types = E('div', 'ws-list');
    Object.entries(D.COLLAB_PAGES).forEach(([key, info]) => {
      const count = records.filter(r => r.type === key && !['已完成', '已关闭'].includes(r.status)).length;
      types.appendChild(row({ title: info.title, sub: info.note, meta: `${count} OPEN`, onclick: () => navigate(`collab/${key}`) }));
    });
    const left = E('div', 'ws-col-7');
    left.appendChild(panel('按协同对象查看', 'QUEUES', types));
    const guide = E('div', 'ws-list');
    guide.appendChild(row({ title: '内部协同接口', sub: '第 13 章', href: '#book/ch13-internal-collaboration', meta: 'READ' }));
    guide.appendChild(row({ title: '商业化协同', sub: '第 15 章', href: '#book/ch15-commercial-synergy', meta: 'READ' }));
    guide.appendChild(row({ title: 'QBR / EBR 模板', sub: '模板 08', href: '#book/08-qbr-ebr-template', meta: 'TPL' }));
    const right = E('div', 'ws-col-5');
    right.appendChild(panel('方法与依据', 'GUIDE', guide));
    grid.appendChild(left);
    grid.appendChild(right);
    page.appendChild(grid);
    return page;
  }
  async function openCollabPage(key) {
    const info = collabType(key);
    if (!info) {
      showPage('collab-iron-triangle', '协同与经营', '未知协同对象', () => empty('未找到该协同对象', '请从左侧协同与经营菜单进入。'));
      return;
    }
    showAsyncPage(`collab-${key}`, info.title, info.note, async () => renderCollabPage(key, info));
  }
  function renderCollabPage(key, info) {
    const page = E('div');
    const records = ws.data.collab.filter(r => r.type === key);
    const open = records.filter(r => !['已完成', '已关闭'].includes(r.status));
    const signals = D.SIGNALS.filter(s => key === 'renewal-signals' ? ['续约', '扩容', '流失', '商业'].includes(s.type) : true);
    page.appendChild(pageHead(info.title, info.note, [
      btn('记录承诺 / 会议', () => createCommitmentModal({ type: key }), 'primary small'),
      btn('返回协同与经营', () => navigate('collab'), 'ghost small'),
      btn('协同流程', () => navigate(`workflows/${info.workflow}`), 'ghost small'),
    ]));
    page.appendChild(kpis([
      { label: '记录总数', value: records.length, sub: `${open.length} 个进行中` },
      { label: '待闭环', value: open.length, sub: open.length ? open[0].title : '无待办', kind: open.length ? 'warn' : 'ok' },
      { label: '完成', value: records.filter(r => ['已完成', '已关闭'].includes(r.status)).length, sub: '已形成决策或结论' },
      { label: '经营信号', value: key === 'renewal-signals' ? signals.length : '—', sub: key === 'renewal-signals' ? '续约 / 扩容 / 流失' : info.title },
    ]));
    const rows = records.map(r => ({
      cells: [
        { node: (() => { const d = E('div'); d.appendChild(E('div', 'title', r.title)); d.appendChild(E('div', 'sub', `${customerName(r.customerId)} · ${(r.participants || []).join('、')}`)); return d; })() },
        r.owner, { node: status(r.status) }, fmtDate(r.date), r.decision || '—',
      ],
      __onclick: () => navigate(`record/${r.id}`),
    }));
    page.appendChild(panel('协同队列', `${records.length} ITEMS`, rows.length ? table(['事项', '负责人', '状态', '日期', '结论 / 承诺'], rows) : empty('暂无协同记录', '记录一次会议、承诺或决策。', btn('记录', () => createCommitmentModal({ type: key }), 'primary small'))));
    if (key === 'renewal-signals') {
      const sRows = signals.map(s => ({
        cells: [{ node: status(s.level === '高' ? '高风险' : s.type) }, s.title, customerName(s.customerId), s.owner, fmtDay(s.date)],
        __onclick: () => navigate(`customer/${s.customerId}/signals`),
      }));
      page.appendChild(panel('经营信号台账', `${signals.length} SIGNALS`, table(['级别', '信号', '客户', '负责人', '日期'], sRows)));
    }
    const grid = E('div', 'ws-grid');
    const guide = E('div', 'ws-list');
    guide.appendChild(row({ title: '对应手册', sub: '打开章节原文', href: `#book/${info.book}`, meta: 'READ' }));
    guide.appendChild(row({ title: '执行流程', sub: '开始可执行流程', href: `#workflows/${info.workflow}`, meta: 'RUN' }));
    guide.appendChild(row({ title: '模板', sub: '打开模板', href: `#book/${info.template}`, meta: 'TPL' }));
    const left = E('div', 'ws-col-7');
    left.appendChild(panel('方法与依据', 'GUIDE', guide));
    const right = E('div', 'ws-col-5');
    const actions = E('div', 'ws-action-stack');
    actions.appendChild(btn('记录承诺 / 会议', () => createCommitmentModal({ type: key }), 'ghost small'));
    actions.appendChild(btn('生成客户简报', () => { const c = activeCustomer() || ws.data.customers[0]; customerBrief(c); }, 'ghost small'));
    right.appendChild(panel('协同动作', 'ACTIONS', actions));
    grid.appendChild(left);
    grid.appendChild(right);
    page.appendChild(grid);
    return page;
  }

  /* ---------- incidents ---------- */
  async function openIncidents(mode) {
    const map = {
      '': ['incidents-tickets', '工单管理', D.PAGE_TITLES.incidents[1]],
      major: ['incidents-major', '重大事件', D.PAGE_TITLES['incidents/major'][1]],
      escalation: ['incidents-escalation', '升级与沟通', D.PAGE_TITLES['incidents/escalation'][1]],
      rca: ['incidents-rca', 'RCA', D.PAGE_TITLES['incidents/rca'][1]],
      review: ['incidents-review', '问题复盘', D.PAGE_TITLES['incidents/review'][1]],
      improvement: ['incidents-improvement', '改进项闭环', D.PAGE_TITLES['incidents/improvement'][1]],
    };
    const meta = map[mode || ''] || map[''];
    await ensureHistory(true);
    showAsyncPage(meta[0], meta[1], meta[2], async () => {
      if (mode === 'major') return renderMajorIncidents();
      if (mode === 'escalation') return renderEscalations();
      if (mode === 'rca') return renderRca();
      if (mode === 'review') return renderReviews();
      if (mode === 'improvement') return renderImprovements();
      return renderIncidentTickets();
    });
  }
  function incidentRows() {
    const local = (ws.data.majorIncidents || D.MAJOR_INCIDENTS).map(i => Object.assign({ local: true }, i));
    const history = (state.history || []).map(h => ({
      id: h.id, title: h.root_cause || h.alert_id || h.id, customerId: ws.data.investigationLinks[h.id] || '',
      sev: h.status === 'error' ? 'P2' : 'P2', status: h.status === 'running' ? '处理中' : h.status === 'done' ? '已关闭' : '异常',
      commander: meName(), started: h.created_at, summary: h.root_cause || '排查记录', local: false,
      historyId: h.id, root_cause: h.root_cause, confidence: h.confidence, report_path: h.report_path,
    }));
    return local.concat(history);
  }
  function renderIncidentTickets() {
    const page = E('div');
    const rowsData = incidentRows();
    const filter = ws.incidentFilter || 'all';
    page.appendChild(pageHead('工单管理', '从告警受理到根因报告的工单队列；重大事件会进入作战室。', [
      btn('发起排查', () => navigate('workbench'), 'primary small'),
      btn('重大事件', () => navigate('incidents/major'), 'ghost small'),
    ]));
    page.appendChild(kpis([
      { label: '工单总数', value: rowsData.length, sub: '含历史排查与本地重大事件' },
      { label: '进行中', value: rowsData.filter(r => ['处理中', 'running', '监控中'].includes(r.status)).length, sub: '需要持续跟进', kind: 'warn' },
      { label: '已关闭', value: rowsData.filter(r => ['已关闭', '已恢复', 'done'].includes(r.status)).length, sub: '已完成报告或复盘' },
      { label: '异常', value: rowsData.filter(r => ['异常', 'error'].includes(r.status)).length, sub: '排查失败需人工介入', kind: 'crit' },
    ]));
    const chips = E('div', 'filter-row');
    [['all', '全部'], ['open', '进行中'], ['closed', '已关闭']].forEach(([key, label]) => {
      const b = E('button', 'chip', label);
      b.type = 'button';
      b.setAttribute('aria-pressed', filter === key ? 'true' : 'false');
      b.addEventListener('click', () => { ws.incidentFilter = key; rerender(); });
      chips.appendChild(b);
    });
    page.appendChild(chips);
    let rows = rowsData;
    if (filter === 'open') rows = rows.filter(r => ['处理中', 'running', '监控中', '异常'].includes(r.status));
    if (filter === 'closed') rows = rows.filter(r => ['已关闭', '已恢复', 'done'].includes(r.status));
    const tableRows = rows.map(r => ({
      cells: [
        { node: status(r.status) },
        { node: (() => { const d = E('div'); d.appendChild(E('div', 'title', r.title)); d.appendChild(E('div', 'sub', `${customerName(r.customerId) || '未关联客户'} · ${r.sev}`)); return d; })() },
        r.commander || '—',
        fmtDate(r.started),
        { node: r.local ? status('本地') : E('span', 'mono', r.id.slice(0, 10)) },
      ],
      __onclick: () => navigate(r.local ? `event/${r.id}` : `event/${r.historyId}`),
    }));
    page.appendChild(table(['状态', '工单 / 根因', '负责人', '时间', 'ID'], tableRows));
    return page;
  }
  function renderMajorIncidents() {
    const page = E('div');
    const active = activeIncidents();
    const closed = incidentRows().filter(r => !active.some(a => a.id === r.id));
    page.appendChild(pageHead('重大事件', 'P1/P2 事件、指挥角色与进行中的作战室；作战室是事件进行态，不是长期台账。', [
      btn('进入作战室', () => navigate('war-room'), 'primary small'),
      btn('发起排查', () => navigate('workbench'), 'ghost small'),
    ]));
    page.appendChild(kpis([
      { label: '进行中', value: active.length, sub: active.length ? `${active[0].sev} · ${active[0].title}` : '无进行中事件', kind: active.length ? 'crit' : 'ok' },
      { label: 'P1', value: active.filter(i => i.sev === 'P1').length, sub: '需指挥与客户通报', kind: active.filter(i => i.sev === 'P1').length ? 'crit' : '' },
      { label: '指挥中', value: active.filter(i => isMe(i.commander)).length, sub: '我担任指挥的角色' },
      { label: '已关闭', value: closed.length, sub: '已进入 RCA / 复盘' },
    ]));
    const grid = E('div', 'ws-grid');
    active.forEach(i => {
      const col = E('div', 'ws-col-6');
      const body = E('div');
      body.appendChild(E('div', 'ws-assist-block'));
      body.lastChild.appendChild(E('div', 'label', '当前结论'));
      body.lastChild.appendChild(E('p', null, i.summary || '事件处理中'));
      const facts = E('div', 'ws-cust-facts');
      [['严重度', i.sev], ['指挥', i.commander], ['客户', customerName(i.customerId) || '未关联'], ['开始', fmtDate(i.started)]].forEach(([k, v]) => {
        const s = E('span');
        s.appendChild(document.createTextNode(`${k} `));
        s.appendChild(E('b', null, v));
        facts.appendChild(s);
      });
      body.appendChild(facts);
      if (i.nextComm) body.appendChild(E('div', 'hint', `下一通报：${i.nextComm}`));
      const actions = E('div', 'ws-action-row');
      actions.style.display = 'flex';
      actions.style.gap = '6px';
      actions.style.marginTop = '9px';
      actions.appendChild(btn('进入作战室', () => navigate('war-room'), 'primary small'));
      actions.appendChild(btn('事件详情', () => navigate(`event/${i.id}`), 'ghost small'));
      actions.appendChild(btn('记录升级', () => createEscalationModal(i), 'ghost small'));
      body.appendChild(actions);
      col.appendChild(panel(`${i.title}`, `${i.sev} · ${i.status}`, body));
      grid.appendChild(col);
    });
    if (!active.length) {
      const col = E('div', 'ws-col-12');
      col.appendChild(empty('当前没有进行中的重大事件', '告警接入或从工作台发起排查后，作战室会临时置顶。', btn('发起排查', () => navigate('workbench'), 'primary small')));
      grid.appendChild(col);
    }
    page.appendChild(grid);
    if (closed.length) {
      const rows = closed.map(r => ({
        cells: [{ node: status(r.status) }, { node: (() => { const d = E('div'); d.appendChild(E('div', 'title', r.title)); d.appendChild(E('div', 'sub', customerName(r.customerId) || '—')); return d; })() }, r.commander || '—', fmtDate(r.started)],
        __onclick: () => navigate(r.local ? `event/${r.id}` : `event/${r.historyId}`),
      }));
      page.appendChild(panel('近期关闭', `${closed.length} EVENTS`, table(['状态', '事件', '负责人', '时间'], rows)));
    }
    return page;
  }
  function renderEscalations() {
    const page = E('div');
    page.appendChild(pageHead('升级与沟通', '升级矩阵、客户通报与决策记录；节奏重于内容。', [
      btn('记录升级', () => createEscalationModal(activeIncidents()[0]), 'primary small'),
      btn('沟通模板', () => navigate('book/06-major-incident-communication-matrix'), 'ghost small'),
    ]));
    page.appendChild(kpis([
      { label: '升级记录', value: ws.data.escalations.length, sub: '客户 / 内部升级' },
      { label: '处理中', value: ws.data.escalations.filter(e => e.status === '处理中').length, sub: '需要持续通报', kind: 'warn' },
      { label: 'P1', value: ws.data.escalations.filter(e => e.level === 'P1').length, sub: '高层与客户双线', kind: 'crit' },
      { label: '最近通报', value: ws.data.escalations.filter(e => new Date(e.date) > new Date(Date.now() - 86400000)).length, sub: '24 小时内' },
    ]));
    const rows = ws.data.escalations.map(e => ({
      cells: [
        { node: status(e.level === 'P1' ? '高风险' : e.level) },
        { node: (() => { const d = E('div'); d.appendChild(E('div', 'title', e.title)); d.appendChild(E('div', 'sub', `${customerName(e.customerId)} · ${e.channel}`)); return d; })() },
        e.owner, { node: status(e.status) }, fmtDate(e.date), e.next || '—',
      ],
    }));
    page.appendChild(panel('升级台账', `${rows.length} ITEMS`, table(['级别', '事项', '负责人', '状态', '时间', '下一动作'], rows)));
    const matrix = [
      ['P1', '15 分钟内', '电话 + 作战室 + 高层', '每 30 分钟', 'CEO/CIO + 客户技术负责人'],
      ['P2', '30 分钟内', '客户技术群 + 电话', '每 2 小时', '客户技术负责人'],
      ['P3', '2 小时内', '工单 + 邮件', '每日', '客户接口人'],
      ['P4', '1 个工作日', '工单', '按计划', '客户接口人'],
    ].map(r => ({ cells: r }));
    page.appendChild(panel('沟通矩阵', 'CADENCE', table(['级别', '首次响应', '通道', '节奏', '对象'], matrix), { sub: '来自第 12 章升级与危机管理' }));
    return page;
  }
  function createEscalationModal(incident) {
    const title = input('text', incident ? incident.title : '');
    const customer = select(customerOptions(), incident?.customerId || defaultCustomerId());
    const level = select(['P1', 'P2', 'P3'], incident?.sev || 'P2');
    const owner = select([meName(), '陈默', '赵启', '李衡'], meName());
    const channel = input('text', '客户技术群 + 电话');
    const next = input('text', '');
    const form = E('div', 'ws-form');
    form.appendChild(formField('事项', title, true));
    form.appendChild(formField('客户', customer));
    form.appendChild(formField('级别', level));
    form.appendChild(formField('负责人', owner));
    form.appendChild(formField('通道', channel));
    form.appendChild(formField('下一动作', next));
    openModal('记录升级 / 通报', form, [
      btn('取消', closeOverlays),
      btn('保存', () => {
        if (!title.value.trim()) { toast('请填写事项', 'error'); return; }
        ws.data.escalations.unshift({
          id: id('esc'), title: title.value.trim(), customerId: customer.value,
          level: level.value, owner: owner.value, channel: channel.value.trim(),
          date: nowIso(), status: '处理中', next: next.value.trim() || '按矩阵通报',
        });
        save();
        closeOverlays();
        rerender();
        toast('升级已记录', 'ok');
      }, 'primary'),
    ]);
  }
  function renderRca() {
    const page = E('div');
    const done = (state.history || []).filter(h => h.status === 'done');
    page.appendChild(pageHead('RCA', '根因分析报告与证据链；报告来自生产排查管线。', [
      btn('RCA 模板', () => navigate('book/07-rca-template'), 'ghost small'),
      btn('发起排查', () => navigate('workbench'), 'ghost small'),
    ]));
    page.appendChild(kpis([
      { label: 'RCA 报告', value: done.length, sub: '已完成排查' },
      { label: '有根因', value: done.filter(h => h.root_cause).length, sub: '可进入复盘' },
      { label: '高置信', value: done.filter(h => h.confidence === 'high').length, sub: 'confidence=high' },
      { label: '关联改进', value: ws.data.improvements.length, sub: '从 RCA 转改进项' },
    ]));
    if (!done.length) {
      page.appendChild(empty('还没有已完成的 RCA', '完成一次排查后，根因与报告会出现在这里。', btn('进入工作台', () => navigate('workbench'), 'primary small')));
    } else {
      const rows = done.map(h => ({
        cells: [
          { node: (() => { const d = E('div'); d.appendChild(E('div', 'title', h.root_cause || '未定位根因')); d.appendChild(E('div', 'sub', `${customerName(ws.data.investigationLinks[h.id]) || '未关联客户'} · ${fmtDate(h.created_at)}`)); return d; })() },
          h.confidence || '—',
          { node: status('已完成') },
          { node: (() => { const b = btn('预览报告', () => previewReport(h.id), 'ghost small'); return b; })() },
          { node: (() => { const b = btn('事件详情', () => navigate(`event/${h.id}`), 'ghost small'); return b; })() },
        ],
      }));
      page.appendChild(table(['根因', '置信度', '状态', '报告', '操作'], rows));
    }
    const grid = E('div', 'ws-grid');
    const guide = E('div', 'ws-list');
    guide.appendChild(row({ title: 'RCA 模板', sub: '模板 07 · 结论、证据、排除项、动作', href: '#book/07-rca-template', meta: 'TPL' }));
    guide.appendChild(row({ title: '金融级事件管理', sub: '第 19 章', href: '#book/ch19-financial-incident', meta: 'READ' }));
    guide.appendChild(row({ title: '问题复盘模板', sub: '模板 16', href: '#book/16-problem-retrospective-template', meta: 'TPL' }));
    const left = E('div', 'ws-col-7');
    left.appendChild(panel('RCA 方法', 'GUIDE', guide));
    const right = E('div', 'ws-col-5');
    const actions = E('div', 'ws-action-stack');
    actions.appendChild(btn('生成改进项', () => createImprovementModal(), 'ghost small'));
    actions.appendChild(btn('进入复盘', () => navigate('incidents/review'), 'ghost small'));
    right.appendChild(panel('下一步', 'ACTIONS', actions));
    grid.appendChild(left);
    grid.appendChild(right);
    page.appendChild(grid);
    return page;
  }
  async function previewReport(invId) {
    try {
      const response = await fetch(`/api/history/${encodeURIComponent(invId)}/report`, { headers: authHeaders() });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      const body = E('div');
      const pre = E('pre');
      pre.style.cssText = 'white-space:pre-wrap;font:11px/1.6 var(--mono);margin:0;max-height:60vh;overflow:auto';
      pre.textContent = text;
      body.appendChild(pre);
      openModal('RCA 报告', body, [
        btn('下载 .md', () => downloadText(`rca-${invId}.md`, text), 'primary'),
      ], 'min(820px, 94vw)');
    } catch (error) {
      toast(`报告加载失败：${error.message}`, 'error');
    }
  }
  function renderReviews() {
    const page = E('div');
    page.appendChild(pageHead('问题复盘', '复盘结论、行动项与责任分配；复盘不是追责会。', [
      btn('新建复盘', () => createRetroModal(), 'primary small'),
      btn('复盘模板', () => navigate('book/16-problem-retrospective-template'), 'ghost small'),
    ]));
    const rows = ws.data.retros.map(r => ({
      cells: [
        { node: status(r.status) },
        { node: (() => { const d = E('div'); d.appendChild(E('div', 'title', r.title)); d.appendChild(E('div', 'sub', `${customerName(r.customerId)} · ${r.incident}`)); return d; })() },
        r.owner, fmtDate(r.date), (r.actions || []).length,
        { node: btn('查看', () => openRetro(r), 'ghost small') },
      ],
    }));
    page.appendChild(table(['状态', '复盘', '负责人', '日期', '行动项', '操作'], rows));
    const guide = E('div', 'ws-list');
    guide.appendChild(row({ title: '复盘模板', sub: '模板 16', href: '#book/16-problem-retrospective-template', meta: 'TPL' }));
    guide.appendChild(row({ title: '升级与危机管理', sub: '第 12 章', href: '#book/ch12-escalation-crisis', meta: 'READ' }));
    guide.appendChild(row({ title: '改进项闭环', sub: '从复盘到验证关闭', href: '#incidents/improvement', meta: 'TRACK' }));
    page.appendChild(panel('方法与工具', 'GUIDE', guide));
    return page;
  }
  function openRetro(r) {
    const body = E('div');
    const wrap = E('div');
    r.conclusions.forEach(c => wrap.appendChild(row({ title: c, sub: '结论', meta: 'FIND' })));
    body.appendChild(panel('结论', 'FINDINGS', wrap));
    const actions = E('div');
    (r.actions || []).forEach(a => actions.appendChild(row({ title: a, sub: '行动项', meta: 'TODO' })));
    body.appendChild(panel('行动项', 'ACTIONS', actions));
    openModal(r.title, body, [btn('关闭', closeOverlays, 'ghost')]);
  }
  function createRetroModal() {
    const title = input('text', '');
    const customer = select(customerOptions(), defaultCustomerId());
    const incident = input('text', '');
    const conclusion = textarea('', '结论，每行一条');
    const actions = textarea('', '行动项，每行一条');
    const form = E('div', 'ws-form');
    form.appendChild(formField('复盘标题', title, true));
    form.appendChild(formField('客户', customer));
    form.appendChild(formField('关联事件', incident));
    form.appendChild(formField('结论', conclusion, true));
    form.appendChild(formField('行动项', actions, true));
    openModal('新建复盘', form, [
      btn('取消', closeOverlays),
      btn('保存', () => {
        if (!title.value.trim()) { toast('请填写标题', 'error'); return; }
        ws.data.retros.unshift({
          id: id('retro'), title: title.value.trim(), customerId: customer.value,
          incident: incident.value.trim(), owner: meName(), date: nowIso(),
          status: '进行中',
          conclusions: conclusion.value.split('\n').map(s => s.trim()).filter(Boolean),
          actions: actions.value.split('\n').map(s => s.trim()).filter(Boolean),
        });
        save();
        closeOverlays();
        rerender();
        toast('复盘已创建', 'ok');
      }, 'primary'),
    ]);
  }
  function renderImprovements() {
    const page = E('div');
    page.appendChild(pageHead('改进项闭环', '从复盘到验证关闭的改进项台账。', [
      btn('新建改进项', () => createImprovementModal(), 'primary small'),
      btn('复盘', () => navigate('incidents/review'), 'ghost small'),
    ]));
    const open = ws.data.improvements.filter(i => i.status !== '已关闭');
    page.appendChild(kpis([
      { label: '改进项', value: ws.data.improvements.length, sub: `${open.length} 个未关闭` },
      { label: '进行中', value: ws.data.improvements.filter(i => i.status === '进行中').length, sub: '需要跟踪', kind: 'warn' },
      { label: '待验证', value: ws.data.improvements.filter(i => i.status === '待验证').length, sub: '需要证据' },
      { label: '已关闭', value: ws.data.improvements.filter(i => i.status === '已关闭').length, sub: '已验证', kind: 'ok' },
    ]));
    const rows = ws.data.improvements.map(i => ({
      cells: [
        { node: status(i.status) },
        { node: (() => { const d = E('div'); d.appendChild(E('div', 'title', i.title)); d.appendChild(E('div', 'sub', `${i.incident} · ${customerName(i.customerId)}`)); return d; })() },
        i.owner, fmtDay(i.due), i.evidence,
        { node: btn(i.status === '已关闭' ? '重开' : '关闭', () => {
          i.status = i.status === '已关闭' ? '进行中' : '已关闭';
          save(); rerender(); toast('改进项状态已更新', 'ok');
        }, 'ghost small') },
      ],
    }));
    page.appendChild(table(['状态', '改进项', '负责人', '期限', '验证证据', '操作'], rows));
    return page;
  }
  function createImprovementModal() {
    const title = input('text', '');
    const customer = select(customerOptions(), defaultCustomerId());
    const incident = input('text', '');
    const owner = select([meName(), '陈默', '赵启', '李衡', '王珂'], meName());
    const due = input('date', D.dateOnly(14));
    const evidence = input('text', '');
    const form = E('div', 'ws-form');
    form.appendChild(formField('改进项', title, true));
    form.appendChild(formField('客户', customer));
    form.appendChild(formField('来源事件', incident));
    form.appendChild(formField('负责人', owner));
    form.appendChild(formField('期限', due));
    form.appendChild(formField('验证证据', evidence));
    openModal('新建改进项', form, [
      btn('取消', closeOverlays),
      btn('保存', () => {
        if (!title.value.trim()) { toast('请填写改进项', 'error'); return; }
        ws.data.improvements.unshift({
          id: id('imp'), title: title.value.trim(), incident: incident.value.trim() || '未关联事件',
          customerId: customer.value, owner: owner.value, status: '进行中',
          due: due.value ? new Date(`${due.value}T18:00:00`).toISOString() : null,
          evidence: evidence.value.trim() || '待补充',
        });
        save();
        closeOverlays();
        rerender();
        toast('改进项已创建', 'ok');
      }, 'primary'),
    ]);
  }

  async function openEventDetail(eventId) {
    await ensureHistory(true);
    const local = (ws.data.majorIncidents || D.MAJOR_INCIDENTS).find(i => i.id === eventId);
    if (local) {
      showPage(local.sev === 'P1' ? 'incidents-major' : 'incidents-tickets', local.title, `${local.sev} · ${customerName(local.customerId)} · ${local.status}`, () => renderEventDetail(local, null));
      return;
    }
    let record = null;
    let report = '';
    try {
      const response = await fetch(`/api/history/${encodeURIComponent(eventId)}`, { headers: authHeaders() });
      if (response.ok) record = await response.json();
      if (record && record.report_path) {
        const r = await fetch(`/api/history/${encodeURIComponent(eventId)}/report`, { headers: authHeaders() });
        if (r.ok) report = await r.text();
      }
    } catch (error) { /* render empty detail */ }
    if (!record) {
      const summary = (state.history || []).find(h => h.id === eventId);
      if (summary) record = summary;
    }
    if (!record) {
      showPage('incidents-tickets', '事件不存在', '未找到该事件', () => empty('事件不存在', '它可能来自其他用户或已被清理。', btn('返回工单管理', () => navigate('incidents'))));
      return;
    }
    const customerId = ws.data.investigationLinks[record.id] || '';
    showPage(record.status === 'running' ? 'incidents-major' : 'incidents-rca', record.root_cause || record.alert_id || record.id, `${statusLabel(record.status)} · ${customerName(customerId) || '未关联客户'}`, () => renderEventDetail(record, report, customerId));
  }
  function renderEventDetail(record, report, customerId) {
    const local = record.local !== false && !record.history_id && !!record.sev;
    const cid = record.customerId || customerId || '';
    const page = E('div');
    page.appendChild(pageHead(record.title || record.root_cause || '事件详情', `${local ? record.sev : statusLabel(record.status)} · ${customerName(cid) || '未关联客户'}`, [
      btn('进入作战室', () => navigate('war-room'), 'primary small'),
      btn('记录升级', () => createEscalationModal(local ? record : { title: record.root_cause || record.alert_id, customerId: cid, sev: 'P2' }), 'ghost small'),
    ]));
    const layout = E('div', 'ws-skeleton');
    const sections = E('div', 'ws-sections');
    const section = (n, title, body) => {
      const box = E('section', 'ws-section');
      const head = E('div', 'ws-section-head');
      head.appendChild(E('h3', null, title));
      head.appendChild(E('span', 'n', `0${n}`));
      box.appendChild(head);
      const content = E('div', 'ws-section-body');
      if (body && body.nodeType) content.appendChild(body);
      else content.textContent = body || '—';
      box.appendChild(content);
      return box;
    };
    const kv = pairs => {
      const dl = E('dl', 'ws-kv');
      pairs.forEach(([k, v]) => {
        dl.appendChild(E('dt', null, k));
        const dd = E('dd');
        if (v && v.nodeType) dd.appendChild(v);
        else dd.textContent = v || '—';
        dl.appendChild(dd);
      });
      return dl;
    };
    sections.appendChild(section(1, '基本信息', kv([
      ['事件', record.title || record.alert_id || record.id],
      ['客户', customerName(cid) || '未关联'],
      ['级别', local ? record.sev : 'P2'],
      ['状态', status(record.status)],
      ['指挥', record.commander || meName()],
      ['时间', fmtDate(record.started || record.created_at)],
    ])));
    const conclusion = E('div');
    conclusion.appendChild(E('p', null, record.summary || record.root_cause || '排查进行中，尚未形成结论。'));
    if (record.confidence) conclusion.appendChild(E('div', 'hint', `置信度：${record.confidence}`));
    sections.appendChild(section(2, '当前结论', conclusion));
    const exec = E('div');
    if (report) {
      const pre = E('pre');
      pre.style.cssText = 'white-space:pre-wrap;font:10.5px/1.55 var(--mono);margin:0;max-height:360px;overflow:auto';
      pre.textContent = report;
      exec.appendChild(pre);
      exec.appendChild(btn('查看 / 下载完整报告', () => previewReport(record.id), 'ghost small'));
    } else {
      exec.appendChild(kv([
        ['执行方式', local ? '本地事件台账' : '生产排查管线'],
        ['报告', record.report_path || '报告生成后可见'],
        ['Trace', record.trace_path || '—'],
      ]));
    }
    sections.appendChild(section(3, '执行内容', exec));
    const comm = E('div', 'ws-list');
    (ws.data.escalations.filter(e => e.customerId === cid)).forEach(e => comm.appendChild(row({ title: e.title, sub: `${e.level} · ${e.channel}`, meta: fmtDate(e.date) })));
    if (!comm.children.length) comm.appendChild(E('div', 'hint', '暂无升级或通报记录。'));
    sections.appendChild(section(4, '协作信息', comm));
    const related = E('div', 'ws-list');
    if (cid) related.appendChild(row({ title: `${customerName(cid)} · 客户 360°`, href: `#customer/${cid}/risks` }));
    related.appendChild(row({ title: 'RCA 模板', href: '#book/07-rca-template' }));
    related.appendChild(row({ title: '改进项', href: '#incidents/improvement' }));
    sections.appendChild(section(5, '关联对象', related));
    sections.appendChild(section(6, '时间线', timeline(local
      ? [{ date: record.started, type: '开始', title: record.title, detail: record.summary }]
      : [{ date: record.created_at, type: '创建', title: '排查创建' }, { date: record.updated_at, type: '更新', title: statusLabel(record.status), detail: record.root_cause || '' }])));
    sections.appendChild(section(7, '关闭标准', kv([
      ['RCA 验收', '根因、证据、排除项与动作齐全'],
      ['客户通报', '完成升级矩阵要求的通报节奏'],
      ['改进项', '行动项已登记并指定负责人'],
    ])));
    const aside = E('div', 'ws-aside');
    const actions = E('div', 'ws-action-stack');
    actions.appendChild(btn('进入作战室', () => navigate('war-room'), 'primary small'));
    actions.appendChild(btn('生成改进项', () => createImprovementModal(), 'ghost small'));
    if (local) {
      actions.appendChild(btn(record.status === '已关闭' ? '重开事件' : '关闭事件', () => {
        record.status = record.status === '已关闭' ? '处理中' : '已关闭';
        save(); rerender(); toast('事件状态已更新', 'ok');
      }, 'ghost small'));
    }
    aside.appendChild(panel('动作', 'ACTIONS', actions));
    layout.appendChild(sections);
    layout.appendChild(aside);
    page.appendChild(layout);
    return page;
  }

  /* ---------- growth ---------- */
  async function openGrowth(key) {
    await Promise.all([ensureHistory(), ensureWorkflowRuns(), ensureAttempts(), ensureEvals(), ensureTeam()]);
    const map = {
      '': ['growth-overview', '成长总览', D.PAGE_TITLES.growth[1], renderGrowthOverview],
      career: ['growth-career', '职业路径', D.PAGE_TITLES['growth/career'][1], renderGrowthCareer],
      goals: ['growth-goals', '发展目标与 IDP', D.PAGE_TITLES['growth/goals'][1], renderGrowthGoals],
      capability: ['growth-capability', '能力图谱', D.PAGE_TITLES['growth/capability'][1], renderGrowthCapability],
      learning: ['growth-learning', '学习与训练', D.PAGE_TITLES['growth/learning'][1], renderGrowthLearning],
      certs: ['growth-certs', '认证管理', D.PAGE_TITLES['growth/certs'][1], renderGrowthCerts],
      reviews: ['growth-reviews', '定期回顾与 1:1', D.PAGE_TITLES['growth/reviews'][1], renderGrowthReviews],
      performance: ['growth-performance', '绩效评估', D.PAGE_TITLES['growth/performance'][1], renderGrowthPerformance],
      evidence: ['growth-evidence', '工作证据与成就档案', D.PAGE_TITLES['growth/evidence'][1], renderGrowthEvidence],
      promotion: ['growth-promotion', '晋升申请与答辩', D.PAGE_TITLES['growth/promotion'][1], renderGrowthPromotion],
      mentoring: ['growth-mentoring', '带教与组织贡献', D.PAGE_TITLES['growth/mentoring'][1], renderGrowthMentoring],
      time: ['growth-time', '我的工时、加班与调休', D.PAGE_TITLES['growth/time'][1], renderGrowthTime],
      transition: ['growth-transition', '职业转换与经验传承', D.PAGE_TITLES['growth/transition'][1], renderGrowthTransition],
    };
    const meta = map[key || ''] || map[''];
    showAsyncPage(meta[0], meta[1], meta[2], async () => meta[3]());
  }
  function growthStats() {
    const modulesDone = (MODULES || []).filter(m => moduleDone(m.id)).length;
    const casesDone = (CASE_CATALOG || []).filter(c => caseDone(c.id)).length;
    const moduleSet = new Set((MODULES || []).filter(m => moduleDone(m.id)).map(m => m.id));
    const caseSet = new Set((CASE_CATALOG || []).filter(c => caseDone(c.id)).map(c => c.id));
    const coverage = SKILL_CATALOG.length ? skillCoverage(moduleSet, caseSet) : 0;
    const latestEval = (state.evals || [])[0] || null;
    const runs = state.workflowRuns || [];
    const startedRuns = runs.length;
    const completedRuns = runs.filter(r => r.status === 'completed').length;
    const evidence = (ws.attempts || []).length + startedRuns + (state.history || []).length + (ws.data.growth.achievements || []).length;
    const certs = growthCertsData(latestEval, modulesDone, casesDone, runs);
    return {
      modulesDone, casesDone, coverage, latestEval, runs, startedRuns, completedRuns,
      evidence, certs, modulesTotal: (MODULES || []).length || 6,
      casesTotal: (CASE_CATALOG || []).length || 12,
      skillsTotal: (SKILL_CATALOG || []).length || 8,
    };
  }
  function growthCertsData(latestEval, modulesDone, casesDone, runs) {
    const faultCases = (CASE_CATALOG || []).filter(c => c.kind === 'fault');
    return [
      { id: 'entry', name: 'TAM 入门认证', criteria: '完成 6 个入门模块 + 4 个案例', met: modulesDone >= 6 && casesDone >= 4, note: `模块 ${modulesDone}/6 · 案例 ${casesDone}` },
      { id: 'practice', name: 'TAM 实战认证', criteria: '完成 8 个故障案例并留有证据', met: casesDone >= 8, note: `故障案例完成 ${faultCases.filter(c => caseDone(c.id)).length}/8` },
      { id: 'rca', name: '根因分析认证', criteria: '评测命中率 ≥ 80%，证据分 ≥ 0.60', met: !!latestEval && Number(latestEval.hit_rate) >= 0.8 && Number(latestEval.avg_evidence_sufficiency) >= 0.6, note: latestEval ? `命中 ${Math.round(Number(latestEval.hit_rate) * 100)}% · 证据 ${Number(latestEval.avg_evidence_sufficiency).toFixed(2)}` : '还没有评测记录' },
      { id: 'assurance', name: '重大保障认证', criteria: '完成一次重保流程并归档复盘', met: runs.some(r => String(r.workflow_id).includes('major-assurance') && r.status === 'completed'), note: `流程完成 ${runs.filter(r => String(r.workflow_id).includes('major-assurance') && r.status === 'completed').length}` },
    ];
  }
  function radarSvg(dims) {
    const W = 220, H = 210, cx = W / 2, cy = H / 2 + 2, r = 72;
    const angles = dims.map((_, i) => -Math.PI / 2 + i * Math.PI * 2 / dims.length);
    const point = (value, i) => {
      const rr = r * Math.max(0, Math.min(100, value)) / 100;
      return [cx + Math.cos(angles[i]) * rr, cy + Math.sin(angles[i]) * rr];
    };
    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="能力雷达">`;
    [25, 50, 75, 100].forEach(level => {
      const pts = dims.map((_, i) => point(level, i).join(',')).join(' ');
      svg += `<polygon points="${pts}" fill="none" stroke="#e0e0e0"/>`;
    });
    dims.forEach((_, i) => {
      const p = point(100, i);
      svg += `<line x1="${cx}" y1="${cy}" x2="${p[0]}" y2="${p[1]}" stroke="#e0e0e0"/>`;
    });
    const dataPts = dims.map((d, i) => point(d.value, i).join(',')).join(' ');
    svg += `<polygon points="${dataPts}" fill="rgba(15,98,254,.14)" stroke="#0f62fe" stroke-width="1.5"/>`;
    dims.forEach((d, i) => {
      const p = point(d.value, i);
      svg += `<circle cx="${p[0]}" cy="${p[1]}" r="2.5" fill="#0f62fe"/>`;
      const labelP = point(116, i);
      const anchor = Math.abs(labelP[0] - cx) < 8 ? 'middle' : labelP[0] > cx ? 'start' : 'end';
      svg += `<text x="${labelP[0]}" y="${labelP[1] + 3}" font-size="9" fill="#525252" text-anchor="${anchor}">${esc(d.label)}</text>`;
    });
    return svg + '</svg>';
  }
  function esc(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function radarDims(stats) {
    const closedService = ws.data.service.filter(s => ['已关闭', '已完成'].includes(s.status)).length;
    const serviceRatio = ws.data.service.length ? closedService / ws.data.service.length * 100 : 40;
    const relationScore = Math.min(100, 45 + ws.data.customers.reduce((sum, c) => sum + c.relations.length, 0) * 5);
    const businessScore = Math.min(100, 40 + ws.data.customers.length * 8 + stats.coverage * 3);
    const aiScore = stats.latestEval ? Math.min(100, Number(stats.latestEval.hit_rate) * 70 + Number(stats.latestEval.avg_evidence_sufficiency) * 30) : 45;
    const teamScore = Math.min(100, 40 + (ws.attempts || []).length * 4 + (ws.data.contribution || []).length * 6);
    return [
      { label: '技术纵深', value: Math.round((stats.modulesDone / stats.modulesTotal) * 60 + (stats.casesDone / stats.casesTotal) * 40) },
      { label: '业务洞察', value: Math.round(businessScore) },
      { label: '关系经营', value: Math.round(relationScore) },
      { label: '服务治理', value: Math.round(serviceRatio) },
      { label: 'AI 应用', value: Math.round(aiScore) },
      { label: '团队贡献', value: Math.round(teamScore) },
    ];
  }
  function renderGrowthOverview() {
    const stats = growthStats();
    const dims = radarDims(stats);
    const certsMet = stats.certs.filter(c => c.met).length;
    const page = E('div');
    page.appendChild(pageHead('成长总览', '能力进度、目标、认证与下一步行动；证据来自服务端学习记录与本地工作区。', [
      btn('学习与训练', () => navigate('growth/learning'), 'primary small'),
      btn('能力路径', () => navigate('path'), 'ghost small'),
    ]));
    page.appendChild(kpis([
      { label: '入门模块', value: `${stats.modulesDone}/${stats.modulesTotal}`, sub: '完成练习后自动记录', kind: 'accent' },
      { label: '案例完成', value: `${stats.casesDone}/${stats.casesTotal}`, sub: '故障与阅读案例' },
      { label: 'Skill 覆盖', value: `${stats.coverage}/${stats.skillsTotal}`, sub: '由案例与模块共同证明' },
      { label: '认证达成', value: `${certsMet}/4`, sub: '入门 / 实战 / 根因 / 重保' },
    ]));
    const grid = E('div', 'ws-grid');
    const radarBody = E('div', 'ws-radar');
    const svgWrap = E('div');
    svgWrap.innerHTML = radarSvg(dims);
    radarBody.appendChild(svgWrap);
    const legend = E('div', 'ws-radar-legend');
    dims.forEach(d => {
      const row = E('div', 'row');
      row.appendChild(E('span', null, d.label));
      row.appendChild(meter(d.value, d.value < 50 ? 'crit' : d.value < 75 ? 'warn' : 'ok'));
      row.appendChild(E('span', 'val', String(Math.round(d.value))));
      legend.appendChild(row);
    });
    radarBody.appendChild(legend);
    const radarPanel = panel('能力雷达', '6 DIMENSIONS', radarBody, { sub: '分数用于自评与讨论，不是绩效结论' });
    const left = E('div', 'ws-col-7');
    left.appendChild(radarPanel);
    const goalsBody = E('div', 'ws-list');
    ws.data.growth.goals.forEach(g => goalsBody.appendChild(row({
      title: g.title, sub: `${g.current} / ${g.target} · ${statusLabel(g.status)}`, meta: fmtDay(g.due),
      onclick: () => navigate('growth/goals'),
    })));
    left.appendChild(panel('发展目标', `${ws.data.growth.goals.length} GOALS`, goalsBody));
    const right = E('div', 'ws-col-5');
    const nextBody = E('div', 'ws-action-stack');
    const nextModule = (MODULES || []).find(m => !moduleDone(m.id));
    const nextCase = (CASE_CATALOG || []).find(c => !caseDone(c.id));
    if (nextModule) nextBody.appendChild(btn(`继续模块：${nextModule.title}`, () => navigate('path'), 'ghost small'));
    if (nextCase) nextBody.appendChild(btn(`练习案例：${nextCase.title}`, () => navigate(`case/${nextCase.name}`), 'ghost small'));
    const nextCert = stats.certs.find(c => !c.met);
    if (nextCert) nextBody.appendChild(btn(`认证缺口：${nextCert.name}`, () => navigate('growth/certs'), 'ghost small'));
    nextBody.appendChild(btn('打开一次可执行流程', () => navigate('workflows'), 'ghost small'));
    right.appendChild(panel('下一步', 'NEXT', nextBody, { sub: '按缺口优先，不按新鲜感' }));
    const achievementBody = E('div', 'ws-list');
    ws.data.growth.achievements.slice(0, 4).forEach(a => achievementBody.appendChild(row({ title: a.title, sub: a.evidence, meta: fmtDay(a.date) })));
    right.appendChild(panel('最近成就', 'EVIDENCE', achievementBody));
    grid.appendChild(left);
    grid.appendChild(right);
    page.appendChild(grid);
    return page;
  }
  function renderGrowthCareer() {
    const stats = growthStats();
    const levels = [
      { name: 'TAM I · 入门', criteria: ['6 个入门模块', '4 个案例', '完成影子值班'], met: stats.modulesDone >= 6 && stats.casesDone >= 4 },
      { name: 'TAM II · 独立', criteria: ['8 个故障案例', '1 个认证', '独立负责 1 个客户'], met: stats.casesDone >= 8 && stats.certs.filter(c => c.met).length >= 1 },
      { name: 'TAM III · 复杂', criteria: ['主导一次重保', '2 个 P1 RCA', '带教 1 名新人'], met: stats.certs.some(c => c.id === 'assurance' && c.met) },
      { name: 'TAM IV · 专家', criteria: ['跨客户影响力', '组织级方法沉淀', '晋升答辩通过'], met: false },
    ];
    const page = E('div');
    page.appendChild(pageHead('职业路径', 'TAM 的能力阶梯、角色边界与成长路线；方法来自第 28 章。', [
      btn('岗位边界', () => navigate('book/ch02-role-boundary-map'), 'ghost small'),
      btn('职业发展章节', () => navigate('book/ch28-career-team-building'), 'ghost small'),
    ]));
    const grid = E('div', 'ws-grid');
    levels.forEach((level, index) => {
      const col = E('div', 'ws-col-3');
      const body = E('div');
      body.appendChild(status(level.met ? '已达成' : index === 0 ? '进行中' : '未开始'));
      const list = E('ul');
      list.style.cssText = 'margin:8px 0 0;padding-left:16px;font-size:11px;color:var(--text-2)';
      level.criteria.forEach(c => list.appendChild(E('li', null, c)));
      body.appendChild(list);
      col.appendChild(panel(level.name, `LEVEL 0${index + 1}`, body));
      grid.appendChild(col);
    });
    page.appendChild(grid);
    const split = E('div', 'ws-grid');
    const left = E('div', 'ws-col-7');
    const modules = E('div', 'ws-list');
    (MODULES || []).forEach((m, index) => modules.appendChild(row({
      leading: status(moduleDone(m.id) ? '已完成' : '未开始'),
      title: `${String(index + 1).padStart(2, '0')} ${m.title}`,
      sub: `${m.level} · ${m.time} · ${m.goal}`,
      meta: moduleDone(m.id) ? 'DONE' : 'TODO',
      onclick: () => navigate('path'), grid: 'auto minmax(0,1fr) auto',
    })));
    left.appendChild(panel('入门路径', `${stats.modulesDone}/${stats.modulesTotal}`, modules));
    const right = E('div', 'ws-col-5');
    const actions = E('div', 'ws-action-stack');
    actions.appendChild(btn('查看带教与组织贡献', () => navigate('growth/mentoring'), 'ghost small'));
    actions.appendChild(btn('查看职业转换', () => navigate('growth/transition'), 'ghost small'));
    actions.appendChild(btn('更新发展目标', () => navigate('growth/goals'), 'ghost small'));
    right.appendChild(panel('成长动作', 'ACTIONS', actions));
    const guide = E('div', 'ws-list');
    guide.appendChild(row({ title: '岗位边界与协作图谱', sub: '第 2 章', href: '#book/ch02-role-boundary-map', meta: 'READ' }));
    guide.appendChild(row({ title: 'TAM 的不可替代性', sub: '第 25 章', href: '#book/ch25-tam-irreplaceability', meta: 'READ' }));
    right.appendChild(panel('延伸阅读', 'READ', guide));
    split.appendChild(left);
    split.appendChild(right);
    page.appendChild(split);
    return page;
  }
  function renderGrowthGoals() {
    const page = E('div');
    page.appendChild(pageHead('发展目标与 IDP', '把能力缺口转成带期限的目标，并与 1:1、证据和认证联动。', [
      btn('新建目标', () => createGoalModal(), 'primary small'),
      btn('回顾记录', () => navigate('growth/reviews'), 'ghost small'),
    ]));
    const grid = E('div', 'ws-grid');
    ws.data.growth.goals.forEach(g => {
      const col = E('div', 'ws-col-4');
      const body = E('div');
      body.appendChild(E('div', 'ws-cust-facts'));
      const facts = body.lastChild;
      [['类别', g.category], ['期限', fmtDay(g.due)], ['状态', statusLabel(g.status)]].forEach(([k, v]) => {
        const s = E('span');
        s.appendChild(document.createTextNode(`${k} `));
        s.appendChild(E('b', null, v));
        facts.appendChild(s);
      });
      const metric = E('div', 'hint');
      metric.style.marginTop = '7px';
      metric.textContent = `${g.current} → ${g.target}`;
      body.appendChild(metric);
      if (g.note) body.appendChild(E('div', 'ws-panel-sub', g.note));
      const actions = E('div', 'ws-action-row');
      actions.style.cssText = 'display:flex;gap:6px;margin-top:9px';
      actions.appendChild(btn('更新进度', () => updateGoalModal(g), 'ghost small'));
      actions.appendChild(btn(g.status === '已完成' ? '重开' : '完成', () => {
        g.status = g.status === '已完成' ? '进行中' : '已完成';
        save(); rerender(); toast('目标状态已更新', 'ok');
      }, 'ghost small'));
      body.appendChild(actions);
      col.appendChild(panel(g.title, g.category, body));
      grid.appendChild(col);
    });
    page.appendChild(grid);
    const guide = E('div', 'ws-list');
    guide.appendChild(row({ title: 'TAM 自评模板', sub: '模板 12', href: '#book/12-tam-self-assessment', meta: 'TPL' }));
    guide.appendChild(row({ title: '职业发展与团队建设', sub: '第 28 章', href: '#book/ch28-career-team-building', meta: 'READ' }));
    page.appendChild(panel('方法', 'GUIDE', guide));
    return page;
  }
  function createGoalModal() {
    const title = input('text', '');
    const category = select(['能力', '实践', '贡献', '认证'], '能力');
    const target = input('text', '');
    const current = input('text', '');
    const due = input('date', D.dateOnly(60));
    const note = textarea('', '为什么重要、如何证明');
    const form = E('div', 'ws-form');
    form.appendChild(formField('目标', title, true));
    form.appendChild(formField('类别', category));
    form.appendChild(formField('目标值', target));
    form.appendChild(formField('当前进度', current));
    form.appendChild(formField('期限', due));
    form.appendChild(formField('说明', note, true));
    openModal('新建发展目标', form, [
      btn('取消', closeOverlays),
      btn('保存', () => {
        if (!title.value.trim()) { toast('请填写目标', 'error'); return; }
        ws.data.growth.goals.unshift({
          id: id('g'), title: title.value.trim(), category: category.value,
          target: target.value.trim() || '待定义', current: current.value.trim() || '未开始',
          due: due.value ? new Date(`${due.value}T18:00:00`).toISOString() : null,
          status: '进行中', note: note.value.trim(),
        });
        save();
        closeOverlays();
        rerender();
        toast('目标已创建', 'ok');
      }, 'primary'),
    ]);
  }
  function updateGoalModal(g) {
    const current = input('text', g.current);
    const statusValue = select(['未开始', '进行中', '已完成'], g.status);
    const form = E('div', 'ws-form');
    form.appendChild(formField('当前进度', current, true));
    form.appendChild(formField('状态', statusValue));
    openModal('更新目标', form, [
      btn('取消', closeOverlays),
      btn('保存', () => {
        g.current = current.value.trim();
        g.status = statusValue.value;
        save();
        closeOverlays();
        rerender();
        toast('目标已更新', 'ok');
      }, 'primary'),
    ]);
  }
  function renderGrowthCapability() {
    const stats = growthStats();
    const page = E('div');
    page.appendChild(pageHead('能力图谱', '技能覆盖、证据与能力缺口；覆盖以案例声明的 skill_ids 为准。', [
      btn('练习案例', () => navigate('cases'), 'ghost small'),
      btn('团队覆盖', () => navigate('team/capability'), 'ghost small'),
    ]));
    page.appendChild(kpis([
      { label: 'Skill 覆盖', value: `${stats.coverage}/${stats.skillsTotal}`, sub: '由模块或案例证明', kind: 'accent' },
      { label: '完成案例', value: stats.casesDone, sub: '案例是技能的主要证据' },
      { label: '完成模块', value: stats.modulesDone, sub: '入门能力证据' },
      { label: '团队沉淀', value: (state.skills || []).length, sub: '可复用的排查 Skill' },
    ]));
    const rows = (SKILL_CATALOG || []).map(skill => {
      const relatedCases = (CASE_CATALOG || []).filter(c => (c.skill_ids || []).includes(skill.id));
      const relatedModules = (MODULES || []).filter(m => (m.skill_ids || []).includes(skill.id));
      const doneCases = relatedCases.filter(c => caseDone(c.id)).length;
      const doneModules = relatedModules.filter(m => moduleDone(m.id)).length;
      const covered = doneCases > 0 || doneModules > 0;
      return {
        cells: [
          { node: (() => { const d = E('div'); d.appendChild(E('div', 'title', skill.name)); d.appendChild(E('div', 'sub', skill.category)); return d; })() },
          { node: status(covered ? '已覆盖' : '缺口') },
          `${doneCases}/${relatedCases.length} 案例`,
          `${doneModules}/${relatedModules.length} 模块`,
          skill.description,
          { node: covered ? btn('巩固', () => navigate('cases'), 'ghost small') : btn('去练习', () => navigate(relatedCases[0] ? `case/${relatedCases[0].name}` : 'cases'), 'ghost small') },
        ],
      };
    });
    page.appendChild(table(['Skill', '覆盖', '案例证据', '模块证据', '说明', '动作'], rows));
    const learned = E('div', 'ws-list');
    (state.skills || []).forEach(s => learned.appendChild(row({ title: s.name, sub: s.description, meta: `${Math.round((s.confidence || 0) * 100)}%` })));
    if (!learned.children.length) learned.appendChild(E('div', 'hint', '还没有团队沉淀的 Skill。完成排查后可运行 skill learn。'));
    page.appendChild(panel('团队沉淀 Skill', `${(state.skills || []).length} LEARNED`, learned));
    return page;
  }
  function renderGrowthLearning() {
    const page = E('div');
    const stats = growthStats();
    page.appendChild(pageHead('学习与训练', '入门模块、故障案例与可执行流程；先练判断，再练表达。', [
      btn('能力路径', () => navigate('path'), 'primary small'),
      btn('案例库', () => navigate('cases'), 'ghost small'),
    ]));
    page.appendChild(kpis([
      { label: '入门路径', value: `${stats.modulesDone}/${stats.modulesTotal}`, sub: '6 个模块' },
      { label: '案例', value: `${stats.casesDone}/${stats.casesTotal}`, sub: '8 个故障 + 4 个阅读' },
      { label: '流程', value: stats.startedRuns, sub: `${stats.completedRuns} 个已完成` },
      { label: '最近评测', value: stats.latestEval ? `${Math.round(Number(stats.latestEval.hit_rate) * 100)}%` : '—', sub: stats.latestEval ? '根因命中率' : '尚无评测' },
    ]));
    const grid = E('div', 'ws-grid');
    const modules = E('div', 'ws-list');
    (MODULES || []).forEach((m, index) => modules.appendChild(row({
      leading: status(moduleDone(m.id) ? '已完成' : '未开始'),
      title: `${String(index + 1).padStart(2, '0')} ${m.title}`,
      sub: `${m.level} · ${m.time} · ${m.goal}`,
      meta: moduleDone(m.id) ? 'DONE' : 'TODO',
      action: btn(moduleDone(m.id) ? '复习' : '开始', () => navigate('path'), 'ghost small'),
      grid: 'auto minmax(0,1fr) auto auto',
    })));
    const left = E('div', 'ws-col-7');
    left.appendChild(panel('入门路径', `${stats.modulesDone}/${stats.modulesTotal}`, modules));
    const cases = E('div', 'ws-list');
    (CASE_CATALOG || []).filter(c => c.kind === 'fault').slice(0, 8).forEach(c => cases.appendChild(row({
      leading: status(caseDone(c.id) ? '已完成' : '未开始'),
      title: c.title, sub: `${c.category} · ${c.level}`,
      action: btn(caseDone(c.id) ? '复习' : '练习', () => navigate(`case/${c.name}`), 'ghost small'),
      grid: 'auto minmax(0,1fr) auto',
    })));
    left.appendChild(panel('故障案例', 'FAULT CASES', cases));
    const right = E('div', 'ws-col-5');
    const flows = E('div', 'ws-list');
    [
      ['practice-ch18-major-assurance', '重大保障五阶段'],
      ['tool-07-rca-template', 'RCA 证据链'],
      ['practice-ch11-customer-lifecycle', '客户生命周期运营'],
      ['tool-08-qbr-ebr-template', 'QBR / EBR'],
    ].forEach(([wid, title]) => flows.appendChild(row({ title, sub: '可执行流程', href: `#workflows/${wid}`, meta: 'RUN' })));
    right.appendChild(panel('推荐流程', 'RECOMMENDED', flows));
    const books = E('div', 'ws-list');
    books.appendChild(row({ title: 'TAM 手册', sub: '28 章 + 22 附录 + 19 模板', href: '#book', meta: 'READ' }));
    books.appendChild(row({ title: '案例库', sub: '故障注入与阅读案例', href: '#cases', meta: 'PRACTICE' }));
    books.appendChild(row({ title: 'Skills', sub: '基础能力与团队沉淀', href: '#skills', meta: 'SKILL' }));
    right.appendChild(panel('知识入口', 'KNOWLEDGE', books));
    grid.appendChild(left);
    grid.appendChild(right);
    page.appendChild(grid);
    return page;
  }
  function renderGrowthCerts() {
    const stats = growthStats();
    const page = E('div');
    page.appendChild(pageHead('认证管理', '认证状态、申请条件与评审记录；认证不是学完，而是能证明。', [
      btn('证据档案', () => navigate('growth/evidence'), 'ghost small'),
      btn('评测趋势', () => navigate('evals'), 'ghost small'),
    ]));
    const grid = E('div', 'ws-grid');
    stats.certs.forEach(cert => {
      const col = E('div', 'ws-col-3');
      const body = E('div');
      body.appendChild(status(cert.met ? '已达成' : '未达成'));
      body.appendChild(E('div', 'ws-panel-sub', cert.criteria));
      body.appendChild(E('div', 'hint', cert.note));
      const actions = E('div', 'ws-action-stack');
      actions.appendChild(btn(cert.met ? '申请认证' : '查看缺口', () => {
        if (!cert.met) { navigate(cert.id === 'rca' ? 'evals' : cert.id === 'assurance' ? 'workflows' : 'growth/learning'); return; }
        const existing = ws.data.growth.certApps.find(a => a.type === cert.name && a.status !== '已通过');
        if (existing) { toast('该认证已在申请中', 'info'); return; }
        ws.data.growth.certApps.unshift({ id: id('ga'), type: cert.name, status: '评审中', submitted: D.dateOnly(0) });
        save(); rerender(); toast('认证申请已提交', 'ok');
      }, 'ghost small'));
      body.appendChild(actions);
      col.appendChild(panel(cert.name, cert.met ? 'READY' : 'GAP', body));
      grid.appendChild(col);
    });
    page.appendChild(grid);
    const rows = ws.data.growth.certApps.map(a => ({
      cells: [a.type, { node: status(a.status) }, a.submitted ? fmtDay(a.submitted) : '—', '—'],
    }));
    page.appendChild(panel('申请记录', `${rows.length} APPLICATIONS`, rows.length ? table(['认证', '状态', '提交日期', '评审人'], rows) : empty('暂无认证申请', '达成条件后从上方卡片提交。')));
    return page;
  }
  function renderGrowthReviews() {
    const page = E('div');
    page.appendChild(pageHead('定期回顾与 1:1', '回顾记录、反馈与行动项；把反馈变成下一次可观察的行为。', [
      btn('记录回顾', () => createReviewModal(), 'primary small'),
    ]));
    const grid = E('div', 'ws-grid');
    ws.data.growth.reviews.forEach(r => {
      const col = E('div', 'ws-col-6');
      const body = E('div');
      body.appendChild(E('div', 'ws-cust-facts'));
      [['日期', fmtDate(r.date)], ['对象', r.reviewer], ['类型', r.type]].forEach(([k, v]) => {
        const s = E('span');
        s.appendChild(document.createTextNode(`${k} `));
        s.appendChild(E('b', null, v));
        body.lastChild.appendChild(s);
      });
      body.appendChild(E('p', null, r.summary));
      const actions = E('ul');
      actions.style.cssText = 'margin:6px 0 0;padding-left:16px;font-size:11px;color:var(--text-2)';
      (r.actions || []).forEach(a => actions.appendChild(E('li', null, a)));
      body.appendChild(actions);
      col.appendChild(panel(`1:1 · ${r.reviewer}`, r.type, body));
      grid.appendChild(col);
    });
    page.appendChild(grid);
    return page;
  }
  function createReviewModal() {
    const reviewer = select([meName(), '陈默', '赵启', '李衡'], '陈默');
    const type = select(['1:1', '季度回顾', '影子值班', '项目复盘'], '1:1');
    const summary = textarea('', '观察、反馈与结论');
    const actions = textarea('', '行动项，每行一条');
    const form = E('div', 'ws-form');
    form.appendChild(formField('回顾对象', reviewer));
    form.appendChild(formField('类型', type));
    form.appendChild(formField('结论', summary, true));
    form.appendChild(formField('行动项', actions, true));
    openModal('记录回顾', form, [
      btn('取消', closeOverlays),
      btn('保存', () => {
        ws.data.growth.reviews.unshift({
          id: id('rv'), date: nowIso(), reviewer: reviewer.value, type: type.value,
          summary: summary.value.trim(), actions: actions.value.split('\n').map(s => s.trim()).filter(Boolean),
        });
        save(); closeOverlays(); rerender(); toast('回顾已记录', 'ok');
      }, 'primary'),
    ]);
  }
  function renderGrowthPerformance() {
    const perf = ws.data.growth.performance;
    const page = E('div');
    page.appendChild(pageHead('绩效评估', '自评、证据与评分维度；用同一套骨架避免“感觉不错”。', [
      btn('编辑自评', () => editPerformanceModal(), 'primary small'),
      btn('绩效模板', () => navigate('book/13-tam-evaluation-scorecard'), 'ghost small'),
    ]));
    const dims = Object.entries(perf.self);
    const avg = dims.reduce((s, [, v]) => s + Number(v), 0) / Math.max(1, dims.length);
    page.appendChild(kpis([
      { label: '自评均分', value: avg.toFixed(1), sub: '1–5 分' },
      { label: '证据数', value: growthStats().evidence, sub: '案例 / 流程 / 事件 / 成就' },
      { label: '达成认证', value: growthStats().certs.filter(c => c.met).length, sub: '4 项认证' },
      { label: '回顾记录', value: ws.data.growth.reviews.length, sub: '1:1 与季度回顾' },
    ]));
    const rows = dims.map(([label, value]) => ({
      cells: [
        { node: (() => { const d = E('div'); d.appendChild(E('div', 'title', label)); d.appendChild(E('div', 'sub', '自评维度')); return d; })() },
        { node: (() => { const wrap = E('div'); wrap.appendChild(meter(Number(value) / 5 * 100, Number(value) >= 4 ? 'ok' : Number(value) >= 3 ? 'warn' : 'crit')); return wrap; })() },
        `${value} / 5`,
        '参见证据档案',
      ],
    }));
    page.appendChild(table(['维度', '自评', '分数', '证据'], rows));
    page.appendChild(panel('自评说明', 'NOTE', E('p', null, ws.data.growth.performanceNote || '—')));
    return page;
  }
  function editPerformanceModal() {
    const perf = ws.data.growth.performance;
    const form = E('div', 'ws-form');
    const inputs = {};
    Object.keys(perf.self).forEach(key => {
      const s = select(['1', '2', '3', '4', '5'], String(perf.self[key]));
      inputs[key] = s;
      form.appendChild(formField(key, s));
    });
    const note = textarea(ws.data.growth.performanceNote || '', '本周期最重要的结果与改进');
    form.appendChild(formField('说明', note, true));
    openModal('编辑绩效自评', form, [
      btn('取消', closeOverlays),
      btn('保存', () => {
        Object.entries(inputs).forEach(([key, node]) => { perf.self[key] = Number(node.value); });
        ws.data.growth.performanceNote = note.value.trim();
        save(); closeOverlays(); rerender(); toast('自评已保存', 'ok');
      }, 'primary'),
    ]);
  }
  function renderGrowthEvidence() {
    const stats = growthStats();
    const page = E('div');
    page.appendChild(pageHead('工作证据与成就档案', '案例、流程、事件与可证明的成果；没有证据的成长不可复用。', [
      btn('导出成就清单', () => exportAchievements(), 'ghost small'),
      btn('认证管理', () => navigate('growth/certs'), 'ghost small'),
    ]));
    page.appendChild(kpis([
      { label: '证据总数', value: stats.evidence, sub: '案例 + 流程 + 事件 + 成就' },
      { label: '案例尝试', value: (ws.attempts || []).length, sub: '服务端记录' },
      { label: '流程运行', value: stats.startedRuns, sub: `${stats.completedRuns} 个完成` },
      { label: '排查记录', value: (state.history || []).length, sub: '生产排查管线' },
    ]));
    const grid = E('div', 'ws-grid');
    const attempts = E('div', 'ws-list');
    (ws.attempts || []).slice(0, 8).forEach(a => attempts.appendChild(row({
      title: `案例 ${a.case_id}`, sub: `${statusLabel(a.status)} · 评分 ${a.score === null || a.score === undefined ? '—' : Number(a.score).toFixed(2)}`,
      meta: fmtDate(a.updated_at || a.created_at),
    })));
    if (!attempts.children.length) attempts.appendChild(E('div', 'hint', '登录并完成案例后会记录在这里。'));
    const left = E('div', 'ws-col-6');
    left.appendChild(panel('案例证据', 'ATTEMPTS', attempts));
    const runs = E('div', 'ws-list');
    (state.workflowRuns || []).slice(0, 8).forEach(r => runs.appendChild(row({
      title: r.workflow_title || r.workflow_id, sub: `${r.status} · ${Math.round((r.progress || 0) * 100)}%`,
      meta: fmtDate(r.updated_at || r.created_at), onclick: () => navigate(`workflow-run/${r.id}`),
    })));
    if (!runs.children.length) runs.appendChild(E('div', 'hint', '从知识与工具的流程中心开始一个流程。'));
    const right = E('div', 'ws-col-6');
    right.appendChild(panel('流程证据', 'RUNS', runs));
    grid.appendChild(left);
    grid.appendChild(right);
    page.appendChild(grid);
    const achievements = E('div', 'ws-list');
    ws.data.growth.achievements.forEach(a => achievements.appendChild(row({
      title: a.title, sub: `${a.type} · ${a.evidence}`, meta: fmtDay(a.date),
      action: a.link ? btn('查看', () => navigate(a.link), 'ghost small') : null,
      grid: 'minmax(0,1fr) auto auto',
    })));
    page.appendChild(panel('成就档案', `${ws.data.growth.achievements.length} ACHIEVEMENTS`, achievements));
    return page;
  }
  function exportAchievements() {
    const lines = ['# 成就档案', ''];
    ws.data.growth.achievements.forEach(a => lines.push(`- ${fmtDay(a.date)} · ${a.title} · ${a.type} · 证据：${a.evidence}`));
    downloadText('achievements.md', lines.join('\n'));
  }
  function renderGrowthPromotion() {
    const stats = growthStats();
    const ready = stats.certs.filter(c => c.met).length;
    const apps = ws.data.promotions || [];
    const page = E('div');
    page.appendChild(pageHead('晋升申请与答辩', '晋升就绪度、材料与答辩记录；用证据说话。', [
      btn('提交晋升申请', () => createPromotionModal(), 'primary small'),
      btn('晋升评审清单', () => navigate('book/14-onsite-promotion-review-checklist'), 'ghost small'),
    ]));
    page.appendChild(kpis([
      { label: '就绪度', value: `${Math.min(100, ready * 25)}%`, sub: `${ready}/4 认证已达成` },
      { label: '客户价值', value: ws.data.growth.achievements.filter(a => a.type === '客户价值').length, sub: '可证明的客户结果' },
      { label: '团队贡献', value: (ws.data.contribution || []).length, sub: '带教 / 评审 / 沉淀' },
      { label: '申请状态', value: apps.length ? apps[0].status : '未申请', sub: apps.length ? apps[0].type : '准备材料' },
    ]));
    const checklist = E('div');
    ['4 项认证至少达成 2 项', '2 个客户价值证据', '1 次 P1 RCA 或重保主导', '1 项团队知识资产', '直属主管推荐'].forEach((item, index) => {
      const met = index === 0 ? ready >= 2 : index === 1 ? ws.data.growth.achievements.filter(a => a.type === '客户价值').length >= 2 : false;
      checklist.appendChild(row({ leading: status(met ? '已达成' : '待补齐'), title: item, sub: met ? '证据已归档' : '在证据档案中补齐', grid: 'auto minmax(0,1fr)' }));
    });
    page.appendChild(panel('就绪检查', 'READINESS', checklist));
    if (apps.length) {
      const rows = apps.map(a => ({ cells: [a.type, { node: status(a.status) }, fmtDay(a.date), a.note || '—'] }));
      page.appendChild(panel('申请记录', `${apps.length}`, table(['类型', '状态', '日期', '说明'], rows)));
    }
    return page;
  }
  function createPromotionModal() {
    const target = select(['TAM III', 'TAM IV'], 'TAM III');
    const note = textarea('', '代表性成果、客户价值与团队贡献');
    openModal('提交晋升申请', (() => {
      const form = E('div', 'ws-form');
      form.appendChild(formField('目标级别', target));
      form.appendChild(formField('申请说明', note, true));
      return form;
    })(), [
      btn('取消', closeOverlays),
      btn('提交', () => {
        ws.data.promotions = ws.data.promotions || [];
        ws.data.promotions.unshift({ id: id('promo'), type: target.value, status: '评审中', date: D.dateOnly(0), note: note.value.trim() });
        save(); closeOverlays(); rerender(); toast('晋升申请已提交', 'ok');
      }, 'primary'),
    ]);
  }
  function renderGrowthMentoring() {
    const page = E('div');
    const pending = pendingReviews();
    page.appendChild(pageHead('带教与组织贡献', '带教关系、案例评审与知识沉淀；组织贡献是 TAM 的放大器。', [
      btn('记录贡献', () => createContributionModal(), 'primary small'),
      btn('团队知识资产', () => navigate('team/knowledge'), 'ghost small'),
    ]));
    page.appendChild(kpis([
      { label: '待评审', value: pending.length, sub: '案例评审队列' },
      { label: '贡献记录', value: (ws.data.contribution || []).length, sub: '评审 / 带教 / 沉淀' },
      { label: '团队 Skill', value: (state.skills || []).length, sub: '可复用知识资产' },
      { label: '成就', value: ws.data.growth.achievements.length, sub: '个人证据' },
    ]));
    const grid = E('div', 'ws-grid');
    const reviews = E('div', 'ws-list');
    pending.slice(0, 6).forEach(a => reviews.appendChild(row({
      title: `案例 ${a.case_id}`, sub: `待评审 · 评分 ${a.score === null || a.score === undefined ? '—' : Number(a.score).toFixed(2)}`,
      meta: fmtDate(a.updated_at || a.created_at), onclick: () => openReviewModal(a),
    })));
    if (!reviews.children.length) reviews.appendChild(E('div', 'hint', '暂无待评审案例；Mentor/Admin 可在这里评审。'));
    const left = E('div', 'ws-col-6');
    left.appendChild(panel('案例评审', 'REVIEWS', reviews));
    const contrib = E('div', 'ws-list');
    (ws.data.contribution || []).forEach(c => contrib.appendChild(row({ title: c.title, sub: `${c.type} · ${c.note}`, meta: fmtDay(c.date) })));
    if (!contrib.children.length) contrib.appendChild(E('div', 'hint', '记录一次评审、带教或知识沉淀。'));
    const right = E('div', 'ws-col-6');
    right.appendChild(panel('贡献记录', 'CONTRIBUTION', contrib));
    grid.appendChild(left);
    grid.appendChild(right);
    page.appendChild(grid);
    return page;
  }
  function createContributionModal() {
    const title = input('text', '');
    const type = select(['案例评审', '带教', '知识沉淀', '组织活动'], '案例评审');
    const note = textarea('', '贡献说明与影响');
    const form = E('div', 'ws-form');
    form.appendChild(formField('贡献', title, true));
    form.appendChild(formField('类型', type));
    form.appendChild(formField('说明', note, true));
    openModal('记录组织贡献', form, [
      btn('取消', closeOverlays),
      btn('保存', () => {
        if (!title.value.trim()) { toast('请填写贡献', 'error'); return; }
        ws.data.contribution.unshift({ id: id('ctr'), title: title.value.trim(), type: type.value, note: note.value.trim(), date: D.dateOnly(0) });
        save(); closeOverlays(); rerender(); toast('贡献已记录', 'ok');
      }, 'primary'),
    ]);
  }
  function renderGrowthTime() {
    const page = E('div');
    const time = ws.data.growth.time || [];
    const total = time.reduce((s, t) => s + Number(t.hours || 0), 0);
    const overtime = time.filter(t => t.type === '加班').reduce((s, t) => s + Number(t.hours || 0), 0);
    const comp = time.reduce((s, t) => s + Number(t.comp || 0), 0);
    page.appendChild(pageHead('我的工时、加班与调休', '工时台账、加班与调休余额；台账用于保护自己，不是为了填表。', [
      btn('记录工时', () => createTimeModal(), 'primary small'),
      btn('调休模板', () => navigate('book/17-overtime-compoff-ledger'), 'ghost small'),
    ]));
    page.appendChild(kpis([
      { label: '累计工时', value: total.toFixed(1), unit: 'h', sub: '最近记录' },
      { label: '加班', value: overtime.toFixed(1), unit: 'h', sub: '需安排调休' },
      { label: '调休余额', value: comp.toFixed(1), unit: 'h', sub: '加班形成' },
      { label: '记录数', value: time.length, sub: '本地台账' },
    ]));
    const rows = time.slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).map(t => ({
      cells: [t.date, t.type, `${Number(t.hours).toFixed(1)} h`, t.comp ? `${Number(t.comp).toFixed(1)} h` : '—', t.note || '—'],
    }));
    page.appendChild(table(['日期', '类型', '工时', '调休', '备注'], rows));
    return page;
  }
  function renderGrowthTransition() {
    const page = E('div');
    page.appendChild(pageHead('职业转换与经验传承', '交接清单、经验沉淀与转型准备；离开一个岗位也要留下可复用的东西。', [
      btn('导出经验清单', () => exportExperience(), 'ghost small'),
      btn('职业发展章节', () => navigate('book/ch28-career-team-building'), 'ghost small'),
    ]));
    const grid = E('div', 'ws-grid');
    const checks = E('div');
    ['客户档案与在办事项', '关键人与关系地图', '风险与历史决策', '可复用流程与模板', '接手人影子学习'].forEach((item, index) => {
      checks.appendChild(row({ leading: status(index < 2 ? '已完成' : '待完成'), title: item, sub: '经验传承检查项', grid: 'auto minmax(0,1fr)' }));
    });
    const left = E('div', 'ws-col-7');
    left.appendChild(panel('交接检查', 'TRANSITION', checks));
    const customers = E('div', 'ws-list');
    ws.data.customers.forEach(c => customers.appendChild(row({
      title: c.name, sub: `${c.owner} · ${c.stage} · 档案 ${c.archive.status}`, meta: 'HANDOVER',
      onclick: () => navigate(`customer/${c.id}/archive`),
    })));
    left.appendChild(panel('在管客户', `${ws.data.customers.length}`, customers));
    const right = E('div', 'ws-col-5');
    const assets = E('div', 'ws-list');
    (state.skills || []).slice(0, 5).forEach(s => assets.appendChild(row({ title: s.name, sub: '团队 Skill', meta: 'SKILL' })));
    ws.data.growth.achievements.slice(0, 4).forEach(a => assets.appendChild(row({ title: a.title, sub: a.type, meta: 'CASE' })));
    right.appendChild(panel('可传承资产', 'ASSETS', assets));
    const actions = E('div', 'ws-action-stack');
    actions.appendChild(btn('记录经验', () => createContributionModal(), 'ghost small'));
    actions.appendChild(btn('发起客户交接', () => {
      const c = activeCustomer() || ws.data.customers[0];
      if (c) createHandoverTask(c);
    }, 'ghost small'));
    right.appendChild(panel('动作', 'ACTIONS', actions));
    grid.appendChild(left);
    grid.appendChild(right);
    page.appendChild(grid);
    return page;
  }
  function exportExperience() {
    const lines = ['# 经验传承清单', ''];
    (state.skills || []).forEach(s => lines.push(`- Skill：${s.name} · ${s.description}`));
    ws.data.growth.achievements.forEach(a => lines.push(`- 成就：${a.title} · ${a.evidence}`));
    (ws.data.contribution || []).forEach(c => lines.push(`- 贡献：${c.title} · ${c.note}`));
    downloadText('experience.md', lines.join('\n'));
  }

  /* ---------- team ---------- */
  async function openTeam(key) {
    await Promise.all([ensureTeam(), ensureAttempts(), ensureEvals(), ensureWorkflowRuns()]);
    if (key !== '') {
      try { await loadSkills(); } catch (error) { /* demo */ }
    }
    if (ws.teamData?.denied) {
      showPage('team-overview', '团队管理', '需要 Mentor / Admin 角色', () => empty('当前角色无权查看团队数据', '团队管理只对 Mentor / Admin 显示；菜单隐藏不等于授权，服务端仍会校验。', btn('返回工作台', () => navigate('home'), 'ghost small')));
      return;
    }
    if (ws.teamData?.empty) {
      showPage('team-overview', '团队管理', '尚未加入团队', () => empty('团队还没有数据', '管理员可用 open-tam team create 与 user create --team 配置团队。', btn('返回工作台', () => navigate('home'), 'ghost small')));
      return;
    }
    const map = {
      '': ['team-overview', '团队总览', D.PAGE_TITLES.team[1], renderTeamOverview],
      allocation: ['team-allocation', '人员与客户分配', D.PAGE_TITLES['team/allocation'][1], renderTeamAllocation],
      capability: ['team-capability', '能力、备份与人才梯队', D.PAGE_TITLES['team/capability'][1], renderTeamCapability],
      workload: ['team-workload', '工作量、值班与疲劳', D.PAGE_TITLES['team/workload'][1], renderTeamWorkload],
      quality: ['team-quality', '服务质量与工作评估', D.PAGE_TITLES['team/quality'][1], renderTeamQuality],
      calibration: ['team-calibration', '绩效校准与反馈', D.PAGE_TITLES['team/calibration'][1], renderTeamCalibration],
      hiring: ['team-hiring', '招聘与新人培养', D.PAGE_TITLES['team/hiring'][1], renderTeamHiring],
      certification: ['team-certification', '认证与晋升评审', D.PAGE_TITLES['team/certification'][1], renderTeamCertification],
      knowledge: ['team-knowledge', '团队知识资产', D.PAGE_TITLES['team/knowledge'][1], renderTeamKnowledge],
    };
    const meta = map[key || ''] || map[''];
    showAsyncPage(meta[0], meta[1], meta[2], async () => meta[3]());
  }
  function teamSkillRows(members) {
    if (ws.teamData?.skills?.length) {
      return ws.teamData.skills.map(s => ({ id: s.id, name: s.name, category: s.category, covered: s.covered_members, total: s.total_members || members.length }));
    }
    const skills = SKILL_CATALOG || [];
    return skills.map((skill, index) => ({
      id: skill.id, name: skill.name, category: skill.category,
      covered: members.filter(m => index < (m.skills || 0)).length, total: members.length,
    }));
  }
  function openMemberModal(m) {
    const body = E('div');
    const facts = E('div', 'ws-cust-facts');
    [['角色', m.role], ['级别', m.level], ['负责客户', (m.customers || []).map(customerName).join('、') || '未分配'], ['负载', `${m.load}%`], ['值班', m.oncall ? '本周主值' : '否']].forEach(([k, v]) => {
      const s = E('span');
      s.appendChild(document.createTextNode(`${k} `));
      s.appendChild(E('b', null, v));
      facts.appendChild(s);
    });
    body.appendChild(facts);
    const kpi = kpis([
      { label: '模块', value: m.modules, sub: '完成' },
      { label: '案例', value: m.cases, sub: '完成' },
      { label: 'Skill', value: m.skills || '—', sub: '覆盖' },
      { label: '负载', value: `${m.load}%`, sub: m.load > 80 ? '疲劳风险' : '正常', kind: m.load > 80 ? 'warn' : 'ok' },
    ]);
    body.appendChild(kpi);
    const feedback = E('div', 'ws-list');
    (ws.data.team.feedback || []).filter(f => f.member === m.name).forEach(f => feedback.appendChild(row({ title: f.note, sub: `${f.type} · ${fmtDay(f.date)}`, meta: f.type })));
    if (!feedback.children.length) feedback.appendChild(E('div', 'hint', '暂无反馈记录。'));
    body.appendChild(panel('反馈与校准', 'FEEDBACK', feedback));
    openModal(`${m.name} · 成员档案`, body, [btn('关闭', closeOverlays, 'ghost')], 'min(680px, 94vw)');
  }
  function renderTeamOverview() {
    const members = teamMembers();
    const skills = teamSkillRows(members);
    const pending = pendingReviews();
    const avgLoad = members.length ? Math.round(members.reduce((s, m) => s + (m.load || 0), 0) / members.length) : 0;
    const covered = skills.filter(s => s.covered > 0).length;
    const page = E('div');
    page.appendChild(pageHead('团队总览', '团队负载、客户分配、能力与质量；按角色显示，数据来自服务端团队记录。', [
      btn('人员分配', () => navigate('team/allocation'), 'ghost small'),
      btn('质量评估', () => navigate('team/quality'), 'ghost small'),
    ]));
    page.appendChild(kpis([
      { label: '团队成员', value: members.length, sub: ws.teamData?.demo ? '演示团队' : (ws.teamData?.team_name || '—') },
      { label: '平均负载', value: `${avgLoad}%`, sub: avgLoad > 80 ? '存在疲劳风险' : '负载可控', kind: avgLoad > 80 ? 'warn' : 'ok' },
      { label: 'Skill 覆盖', value: `${covered}/${skills.length}`, sub: '至少 1 人覆盖' },
      { label: '待评审', value: pending.length, sub: '案例评审队列', kind: pending.length ? 'warn' : 'ok' },
    ]));
    const grid = E('div', 'ws-grid');
    const memberRows = members.map(m => ({
      cells: [
        { node: (() => { const d = E('div'); d.appendChild(E('div', 'title', m.name)); d.appendChild(E('div', 'sub', `${m.role} · ${m.level}`)); return d; })() },
        (m.customers || []).map(customerName).join('、') || '未分配',
        `${m.modules}/6`,
        `${m.cases}/12`,
        { node: (() => { const d = E('div'); d.appendChild(E('div', 'num', `${m.load}%`)); d.appendChild(meter(m.load, m.load > 80 ? 'crit' : m.load > 65 ? 'warn' : 'ok')); return d; })() },
        { node: status(m.load > 80 ? '疲劳风险' : m.oncall ? '值班' : '正常') },
      ],
      __onclick: () => openMemberModal(m),
    }));
    const left = E('div', 'ws-col-7');
    left.appendChild(panel('成员', `${members.length} MEMBERS`, table(['成员', '客户', '模块', '案例', '负载', '状态'], memberRows)));
    const right = E('div', 'ws-col-5');
    const skillBody = E('div');
    skills.forEach(s => skillBody.appendChild(meterRow(s.name, s.total ? s.covered / s.total * 100 : 0, s.covered === 0 ? 'crit' : s.covered < s.total ? 'warn' : 'ok')));
    right.appendChild(panel('Skill 覆盖', `${covered}/${skills.length}`, skillBody));
    const pendingBody = E('div', 'ws-list');
    pending.slice(0, 5).forEach(a => pendingBody.appendChild(row({
      title: `案例 ${a.case_id}`, sub: `成员 ${a.user_id} · 待评审`, meta: fmtDate(a.updated_at || a.created_at),
      onclick: () => navigate('team/quality'),
    })));
    if (!pendingBody.children.length) pendingBody.appendChild(E('div', 'hint', '没有待评审案例。'));
    right.appendChild(panel('待评审', `${pending.length}`, pendingBody));
    grid.appendChild(left);
    grid.appendChild(right);
    page.appendChild(grid);
    return page;
  }
  function renderTeamAllocation() {
    const members = teamMembers();
    const page = E('div');
    page.appendChild(pageHead('人员与客户分配', '主备负责人、负载与覆盖缺口；每个客户必须有主备。', [
      btn('团队能力', () => navigate('team/capability'), 'ghost small'),
    ]));
    const rows = ws.data.customers.map(c => {
      const backup = ws.data.allocations[c.id] || c.team[1] || '未设置';
      const selectNode = select([{ value: '', label: '未设置' }].concat(members.map(m => m.name)), backup === '未设置' ? '' : backup);
      selectNode.addEventListener('change', () => {
        ws.data.allocations[c.id] = selectNode.value;
        if (selectNode.value && !c.team.includes(selectNode.value)) c.team.push(selectNode.value);
        save();
        toast('备份负责人已更新', 'ok');
        rerender();
      });
      return {
        cells: [
          { node: (() => { const d = E('div'); d.appendChild(E('div', 'title', c.name)); d.appendChild(E('div', 'sub', `${c.tier} · ${c.stage}`)); return d; })() },
          c.owner,
          { node: selectNode },
          c.team.join('、'),
          { node: status(c.team.length >= 2 ? '已备份' : '单点') },
          `${c.health}`,
        ],
      };
    });
    page.appendChild(table(['客户', '主负责人', '备份负责人', '协同成员', '备份状态', '健康'], rows));
    const memberRows = members.map(m => ({
      cells: [m.name, m.role, (m.customers || []).map(customerName).join('、') || '—', `${m.load}%`, { node: meter(m.load, m.load > 80 ? 'crit' : 'ok') }],
      __onclick: () => openMemberModal(m),
    }));
    page.appendChild(panel('成员负载', `${members.length} MEMBERS`, table(['成员', '角色', '客户', '负载', '状态'], memberRows)));
    return page;
  }
  function renderTeamCapability() {
    const members = teamMembers();
    const skills = teamSkillRows(members);
    const gaps = skills.filter(s => s.covered <= 1);
    const page = E('div');
    page.appendChild(pageHead('能力、备份与人才梯队', '技能覆盖、备份关系与梯队风险；单点能力是团队最大的隐性风险。', [
      btn('认证与晋升', () => navigate('team/certification'), 'ghost small'),
      btn('新人培养', () => navigate('team/hiring'), 'ghost small'),
    ]));
    page.appendChild(kpis([
      { label: 'Skill 覆盖', value: `${skills.filter(s => s.covered > 0).length}/${skills.length}`, sub: '至少 1 人覆盖' },
      { label: '单点能力', value: gaps.length, sub: '覆盖 ≤ 1 人', kind: gaps.length ? 'crit' : 'ok' },
      { label: '平均模块', value: members.length ? (members.reduce((s, m) => s + (m.modules || 0), 0) / members.length).toFixed(1) : '—', sub: '团队均值' },
      { label: '平均案例', value: members.length ? (members.reduce((s, m) => s + (m.cases || 0), 0) / members.length).toFixed(1) : '—', sub: '团队均值' },
    ]));
    const rows = skills.map(s => ({
      cells: [
        { node: (() => { const d = E('div'); d.appendChild(E('div', 'title', s.name)); d.appendChild(E('div', 'sub', s.category)); return d; })() },
        `${s.covered}/${s.total}`,
        { node: meter(s.total ? s.covered / s.total * 100 : 0, s.covered === 0 ? 'crit' : s.covered <= 1 ? 'warn' : 'ok') },
        { node: status(s.covered === 0 ? '缺口' : s.covered <= 1 ? '单点' : '健康') },
        s.covered <= 1 ? '指定备份并安排练习' : '保持',
      ],
    }));
    page.appendChild(panel('技能矩阵', 'CAPABILITY', table(['Skill', '覆盖', '比例', '风险', '动作'], rows)));
    const memberRows = members.map(m => ({
      cells: [m.name, `${m.modules}/6 模块`, `${m.cases}/12 案例`, `${m.load}% 负载`, (m.customers || []).map(customerName).join('、') || '—'],
      __onclick: () => openMemberModal(m),
    }));
    page.appendChild(panel('人才梯队', 'ROSTER', table(['成员', '模块', '案例', '负载', '客户'], memberRows)));
    return page;
  }
  function renderTeamWorkload() {
    const members = teamMembers();
    const page = E('div');
    page.appendChild(pageHead('工作量、值班与疲劳', '任务负载、值班强度与疲劳信号；负载超过 80% 需要主动调整。', [
      btn('人员分配', () => navigate('team/allocation'), 'ghost small'),
    ]));
    const rows = members.map(m => {
      const open = computedTasks().local.filter(t => t.owner === m.name && !['done', 'closed'].includes(t.status)).length;
      const load = Math.min(100, (m.load || 0) + open * 2);
      return {
        cells: [
          { node: (() => { const d = E('div'); d.appendChild(E('div', 'title', m.name)); d.appendChild(E('div', 'sub', m.role)); return d; })() },
          open,
          `${m.load}%`,
          { node: (() => { const d = E('div'); d.appendChild(E('div', 'num', `${load}%`)); d.appendChild(meter(load, load > 85 ? 'crit' : load > 70 ? 'warn' : 'ok')); return d; })() },
          m.oncall ? '主值' : '—',
          { node: status(load > 85 ? '疲劳风险' : load > 70 ? '偏高' : '正常') },
        ],
        __onclick: () => openMemberModal(m),
      };
    });
    page.appendChild(table(['成员', '未关闭任务', '基础负载', '综合负载', '值班', '状态'], rows));
    const dutyRows = ws.data.team.duty.map(d => ({ cells: [d.day, d.primary, d.backup, d.window, { node: status(d.primary === meName() ? '我值班' : '正常') }] }));
    page.appendChild(panel('本周值班', 'ROSTER', table(['日期', '主值', '备份', '窗口', '状态'], dutyRows)));
    const fatigue = members.filter(m => (m.load || 0) > 80);
    page.appendChild(panel('疲劳信号', `${fatigue.length}`, fatigue.length ? timeline(fatigue.map(m => ({ date: nowIso(), type: '疲劳', title: `${m.name} 负载 ${m.load}%`, detail: '建议调整客户分配或延期非关键任务' }))) : empty('当前没有疲劳风险', '保持负载透明，比事后补救更便宜。')));
    return page;
  }
  function renderTeamQuality() {
    const page = E('div');
    const latest = (state.evals || [])[0];
    const pending = pendingReviews();
    const attempts = ws.attempts || [];
    page.appendChild(pageHead('服务质量与工作评估', '评测、复盘质量与工作评价；用同一套指标对齐个人与团队。', [
      btn('查看评测', () => navigate('evals'), 'ghost small'),
      btn('评分规则', () => navigate('settings/metrics'), 'ghost small'),
    ]));
    page.appendChild(kpis([
      { label: '最新命中率', value: latest ? `${Math.round(Number(latest.hit_rate) * 100)}%` : '—', sub: latest ? `${latest.total} 个样本` : '尚无评测' },
      { label: '证据充分性', value: latest ? Number(latest.avg_evidence_sufficiency).toFixed(2) : '—', sub: '0–1' },
      { label: '待评审', value: pending.length, sub: '案例评审队列', kind: pending.length ? 'warn' : 'ok' },
      { label: '案例尝试', value: attempts.length, sub: '团队成员' },
    ]));
    if (latest) {
      const rows = (state.evals || []).slice(0, 8).map(run => ({
        cells: [run.model_label || 'eval', `${Math.round(Number(run.hit_rate) * 100)}%`, Number(run.avg_evidence_sufficiency).toFixed(2), Number(run.avg_steps).toFixed(1), fmtDate(run.created_at)],
      }));
      page.appendChild(panel('质量趋势', 'EVALS', table(['模型', '命中率', '证据分', '平均步数', '时间'], rows)));
    } else {
      page.appendChild(empty('还没有评测记录', '运行 open-tam eval --fake 验证链路，配置模型后运行真实评测。', btn('打开评测', () => navigate('evals'), 'ghost small')));
    }
    if (pending.length) {
      const rows = pending.map(a => ({
        cells: [a.case_id, a.user_id, a.score === null || a.score === undefined ? '待评分' : Number(a.score).toFixed(2), fmtDate(a.updated_at || a.created_at), { node: btn('去评审', () => openReviewModal(a), 'ghost small') }],
      }));
      page.appendChild(panel('待评审', `${pending.length}`, table(['案例', '成员', '评分', '时间', '动作'], rows)));
    }
    const guide = E('div', 'ws-list');
    guide.appendChild(row({ title: 'TAM 服务质量记分卡', sub: '模板 15', href: '#book/15-tam-service-quality-scorecard', meta: 'TPL' }));
    guide.appendChild(row({ title: 'TAM 工作评估', sub: '模板 13', href: '#book/13-tam-evaluation-scorecard', meta: 'TPL' }));
    page.appendChild(panel('评估工具', 'GUIDE', guide));
    return page;
  }
  function renderTeamCalibration() {
    const members = teamMembers();
    const page = E('div');
    page.appendChild(pageHead('绩效校准与反馈', '成员评价、校准记录与反馈；先对齐标准，再讨论分数。', [
      btn('记录反馈', () => createFeedbackModal(), 'primary small'),
      btn('绩效模板', () => navigate('book/13-tam-evaluation-scorecard'), 'ghost small'),
    ]));
    const grid = E('div', 'ws-grid');
    const feedback = E('div', 'ws-list');
    ws.data.team.feedback.forEach(f => feedback.appendChild(row({
      leading: status(f.type === '改进' ? '关注' : f.type === '培养' ? '未开始' : '健康'),
      title: `${f.member} · ${f.note}`, sub: `${f.type} · ${fmtDay(f.date)}`, meta: f.type,
      grid: 'auto minmax(0,1fr) auto',
    })));
    const left = E('div', 'ws-col-7');
    left.appendChild(panel('反馈记录', `${ws.data.team.feedback.length} NOTES`, feedback));
    const right = E('div', 'ws-col-5');
    const rows = members.map(m => ({
      cells: [m.name, `${m.load}%`, { node: status(m.load > 80 ? '关注' : '正常') }, (m.customers || []).map(customerName).join('、') || '—'],
      __onclick: () => openMemberModal(m),
    }));
    right.appendChild(panel('成员校准', 'CALIBRATION', table(['成员', '负载', '状态', '客户'], rows)));
    grid.appendChild(left);
    grid.appendChild(right);
    page.appendChild(grid);
    return page;
  }
  function createFeedbackModal() {
    const member = select(teamMembers().map(m => m.name), meName());
    const type = select(['优势', '改进', '培养', '校准'], '优势');
    const note = textarea('', '具体行为、影响与下一步');
    const form = E('div', 'ws-form');
    form.appendChild(formField('成员', member));
    form.appendChild(formField('类型', type));
    form.appendChild(formField('反馈', note, true));
    openModal('记录反馈', form, [
      btn('取消', closeOverlays),
      btn('保存', () => {
        ws.data.team.feedback.unshift({ id: id('f'), member: member.value, type: type.value, note: note.value.trim(), date: D.dateOnly(0) });
        save(); closeOverlays(); rerender(); toast('反馈已记录', 'ok');
      }, 'primary'),
    ]);
  }
  function openReviewModal(attempt) {
    const score = input('number', '1');
    score.min = '0';
    score.max = '1';
    score.step = '0.1';
    const note = textarea('', '评审意见与证据');
    const form = E('div', 'ws-form');
    form.appendChild(formField('评分（0–1）', score));
    form.appendChild(formField('评审意见', note, true));
    openModal(`评审案例 · ${attempt.case_id}`, form, [
      btn('取消', closeOverlays),
      btn('提交评审', async () => {
        const value = Number(score.value);
        if (!Number.isFinite(value) || value < 0 || value > 1) { toast('评分需在 0–1 之间', 'error'); return; }
        try {
          const response = await fetch(`/api/attempts/${encodeURIComponent(attempt.id)}/review`, {
            method: 'POST',
            headers: authHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ score: value, review_note: note.value.trim() }),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          ws.teamLoaded = false;
          await ensureTeam();
          closeOverlays();
          rerender();
          toast('评审已提交', 'ok');
        } catch (error) {
          toast(`评审失败：${error.message}`, 'error');
        }
      }, 'primary'),
    ]);
  }
  function renderTeamHiring() {
    const page = E('div');
    page.appendChild(pageHead('招聘与新人培养', '招聘管道、画像与 90 天培养；先定义成功，再开始招聘。', [
      btn('新增候选人', () => createHiringModal(), 'primary small'),
      btn('招聘画像', () => navigate('book/ch28-career-team-building'), 'ghost small'),
    ]));
    const rows = ws.data.team.pipeline.map(p => ({
      cells: [p.name, p.stage, p.profile, p.next],
    }));
    page.appendChild(panel('招聘管道', `${rows.length} CANDIDATES`, table(['候选人', '阶段', '画像', '下一步'], rows)));
    const checks = E('div');
    ['第 1–30 天：案例与工具入门', '第 31–60 天：影子值班与客户旁听', '第 61–90 天：独立小客户 + 答辩'].forEach((item, index) => {
      checks.appendChild(row({ leading: status(index === 0 ? '已完成' : index === 1 ? '进行中' : '未开始'), title: item, sub: '新人 90 天培养', grid: 'auto minmax(0,1fr)' }));
    });
    page.appendChild(panel('90 天培养', 'ONBOARDING', checks));
    const guide = E('div', 'ws-list');
    guide.appendChild(row({ title: '新人 90 天清单', sub: '模板 02', href: '#book/02-onboarding-90d-checklist', meta: 'TPL' }));
    guide.appendChild(row({ title: '招聘画像', sub: '第 28 章', href: '#book/ch28-career-team-building', meta: 'READ' }));
    page.appendChild(panel('方法', 'GUIDE', guide));
    return page;
  }
  function createHiringModal() {
    const name = input('text', '');
    const stage = select(['简历', '初筛', '一面', '二面', 'Offer'], '简历');
    const profile = input('text', '');
    const next = input('text', '');
    const form = E('div', 'ws-form');
    form.appendChild(formField('候选人', name, true));
    form.appendChild(formField('阶段', stage));
    form.appendChild(formField('画像', profile));
    form.appendChild(formField('下一步', next));
    openModal('新增候选人', form, [
      btn('取消', closeOverlays),
      btn('保存', () => {
        ws.data.team.pipeline.unshift({ id: id('h'), name: name.value.trim() || '候选人', stage: stage.value, profile: profile.value.trim(), next: next.value.trim() });
        save(); closeOverlays(); rerender(); toast('候选人已添加', 'ok');
      }, 'primary'),
    ]);
  }
  function renderTeamCertification() {
    const stats = growthStats();
    const page = E('div');
    page.appendChild(pageHead('认证与晋升评审', '认证申请、晋升材料与评审队列；按证据审批，不按印象。', [
      btn('认证规则', () => navigate('growth/certs'), 'ghost small'),
    ]));
    page.appendChild(kpis([
      { label: '申请记录', value: ws.data.team.certApplications.length, sub: '认证 / 晋升' },
      { label: '评审中', value: ws.data.team.certApplications.filter(a => a.status === '评审中').length, sub: '需要结论', kind: 'warn' },
      { label: '我达成', value: `${stats.certs.filter(c => c.met).length}/4`, sub: '个人认证' },
      { label: '待提交', value: ws.data.team.certApplications.filter(a => a.status === '待提交').length, sub: '材料未齐' },
    ]));
    const rows = ws.data.team.certApplications.map(a => ({
      cells: [
        a.member, a.type, { node: status(a.status) }, a.submitted ? fmtDay(a.submitted) : '—',
        { node: (() => {
          const wrap = E('div');
          wrap.style.display = 'flex';
          wrap.style.gap = '4px';
          if (a.status === '评审中') {
            wrap.appendChild(btn('通过', () => { a.status = '已通过'; save(); rerender(); toast('已通过', 'ok'); }, 'ghost small'));
            wrap.appendChild(btn('退回', () => { a.status = '待提交'; save(); rerender(); toast('已退回补充材料', 'info'); }, 'ghost small'));
          }
          return wrap;
        })() },
      ],
    }));
    page.appendChild(panel('评审队列', `${rows.length}`, table(['成员', '类型', '状态', '提交日期', '动作'], rows)));
    const promotionRows = (ws.data.promotions || []).map(p => ({ cells: [meName(), p.type, { node: status(p.status) }, fmtDay(p.date), p.note || '—'] }));
    page.appendChild(panel('晋升申请', `${promotionRows.length}`, promotionRows.length ? table(['成员', '目标级别', '状态', '日期', '说明'], promotionRows) : empty('暂无晋升申请', '在“我的成长 / 晋升申请与答辩”提交。')));
    return page;
  }
  function renderTeamKnowledge() {
    const page = E('div');
    const runs = (state.workflowRuns || []).filter(r => r.status === 'completed');
    page.appendChild(pageHead('团队知识资产', 'Skill、流程、模板与贡献；知识的价值在被复用时才出现。', [
      btn('知识库', () => navigate('knowledge'), 'ghost small'),
      btn('模板中心', () => navigate('knowledge/templates'), 'ghost small'),
    ]));
    page.appendChild(kpis([
      { label: '团队 Skill', value: (state.skills || []).length, sub: '从 trace 沉淀' },
      { label: '完成流程', value: runs.length, sub: '可复用执行记录' },
      { label: '贡献记录', value: (ws.data.contribution || []).length, sub: '评审 / 带教 / 沉淀' },
      { label: '手册模板', value: 19, sub: '可直接使用' },
    ]));
    const grid = E('div', 'ws-grid');
    const skills = E('div', 'ws-list');
    (state.skills || []).forEach(s => skills.appendChild(row({ title: s.name, sub: s.description, meta: `${Math.round((s.confidence || 0) * 100)}%` })));
    if (!skills.children.length) skills.appendChild(E('div', 'hint', '还没有团队 Skill。完成排查后运行 open-tam skill learn。'));
    const left = E('div', 'ws-col-6');
    left.appendChild(panel('Skill 资产', `${(state.skills || []).length}`, skills));
    const flows = E('div', 'ws-list');
    runs.slice(0, 8).forEach(r => flows.appendChild(row({ title: r.workflow_title || r.workflow_id, sub: `${Math.round((r.progress || 0) * 100)}% · ${r.stage || ''}`, meta: fmtDay(r.updated_at), onclick: () => navigate(`workflow-run/${r.id}`) })));
    if (!flows.children.length) flows.appendChild(E('div', 'hint', '从流程中心开始一个可执行流程。'));
    const right = E('div', 'ws-col-6');
    right.appendChild(panel('流程资产', `${runs.length}`, flows));
    grid.appendChild(left);
    grid.appendChild(right);
    page.appendChild(grid);
    return page;
  }

  /* ---------- knowledge ---------- */
  async function openKnowledge(param) {
    if (param === 'templates') {
      await showAsyncPage('knowledge-templates', '模板与 Checklist', D.PAGE_TITLES['knowledge/templates'][1], async () => renderTemplates());
      return;
    }
    await showAsyncPage('knowledge-home', '我的知识库与收藏', D.PAGE_TITLES.knowledge[1], async () => renderKnowledgeHome());
  }
  async function renderKnowledgeHome() {
    let book = null;
    let workflows = null;
    try { book = await loadBook(); } catch (error) { /* auth */ }
    try { workflows = await loadWorkflowCatalog(); } catch (error) { /* auth */ }
    const counts = book?.counts || {};
    const wfCounts = workflows?.counts || {};
    const page = E('div');
    page.appendChild(pageHead('我的知识库与收藏', '收藏、最近使用与推荐内容；所有内容都有明确的来源与用途。', [
      btn('搜索知识', openPalette, 'primary small'),
      btn('模板中心', () => navigate('knowledge/templates'), 'ghost small'),
    ]));
    page.appendChild(kpis([
      { label: '手册专题', value: counts.total || '—', sub: `${counts.chapters || 28} 章 · ${counts.appendices || 22} 附录` },
      { label: '可执行流程', value: wfCounts.total || '—', sub: `${wfCounts.tool || 19} 个模板工具` },
      { label: '案例', value: (CASE_CATALOG || []).length || '—', sub: '故障与阅读案例' },
      { label: '收藏页面', value: ws.data.navFavorites.length, sub: '导航收藏' },
    ]));
    const grid = E('div', 'ws-grid');
    const fav = E('div', 'ws-fav-grid');
    const idx = navIndex();
    ws.data.navFavorites.map(key => idx[key]).filter(Boolean).forEach(item => {
      const card = E('div', 'ws-fav-card');
      card.appendChild(E('div', 'kind', item.groupLabel));
      card.appendChild(E('div', 'title', item.label));
      card.appendChild(E('div', 'sub', '已收藏'));
      const actions = E('div', 'actions');
      actions.appendChild(btn('打开', () => navigate(item.route), 'ghost small'));
      actions.appendChild(btn('取消收藏', () => toggleNavFavorite(item.id), 'ghost small'));
      card.appendChild(actions);
      fav.appendChild(card);
    });
    if (!fav.children.length) fav.appendChild(empty('还没有收藏', '在任意页面右上角点击“收藏”，把常用入口放在这里。'));
    const left = E('div', 'ws-col-7');
    left.appendChild(panel('收藏', `${ws.data.navFavorites.length}`, fav));
    const recommendations = E('div', 'ws-list');
    recommendations.appendChild(row({ title: 'TAM 手册', sub: '按篇浏览 71 个专题', href: '#book', meta: 'READ' }));
    recommendations.appendChild(row({ title: '方法与 Playbook', sub: '69 个可执行流程', href: '#workflows', meta: 'RUN' }));
    recommendations.appendChild(row({ title: '案例库', sub: '用故障模式练习判断', href: '#cases', meta: 'PRACTICE' }));
    recommendations.appendChild(row({ title: '模板与 Checklist', sub: '19 个手册模板', href: '#knowledge/templates', meta: 'TPL' }));
    recommendations.appendChild(row({ title: '术语表', sub: '中英对照', href: '#book/appx-a-glossary', meta: 'REF' }));
    recommendations.appendChild(row({ title: '产品通告与监管资料', sub: '2026 云厂商通告汇编', href: '#book/appx-f-cloud-vendor-notices-2026', meta: 'REF' }));
    const right = E('div', 'ws-col-5');
    right.appendChild(panel('推荐入口', 'START HERE', recommendations));
    grid.appendChild(left);
    grid.appendChild(right);
    page.appendChild(grid);
    return page;
  }
  async function renderTemplates() {
    let book = null;
    try { book = await loadBook(); } catch (error) { /* auth */ }
    const page = E('div');
    page.appendChild(pageHead('模板与 Checklist', '手册中的 19 个模板，可直接转成执行流程；模板不是装饰，是防遗漏。', [
      btn('流程中心', () => navigate('workflows'), 'ghost small'),
    ]));
    const docs = [];
    (book?.parts || []).forEach(part => (part.documents || []).forEach(doc => {
      if (doc.kind === 'tool') docs.push(Object.assign({ part: part.title }, doc));
    }));
    const search = input('search', '');
    search.placeholder = '搜索模板';
    page.appendChild(formField('搜索', search, true));
    const list = E('div', 'ws-list');
    const draw = () => {
      const query = search.value.trim().toLowerCase();
      clear(list);
      docs.filter(d => !query || `${d.title} ${d.summary || ''}`.toLowerCase().includes(query)).forEach(doc => {
        const rowNode = row({
          title: doc.title,
          sub: doc.summary || doc.part,
          meta: 'TEMPLATE',
          action: (() => {
            const wrap = E('div');
            wrap.style.display = 'flex';
            wrap.style.gap = '5px';
            wrap.appendChild(link('阅读', `#book/${doc.slug}`, 'btn ghost small'));
            wrap.appendChild(link('开始流程', `#workflows/tool-${doc.slug}`, 'btn ghost small'));
            return wrap;
          })(),
          grid: 'minmax(0,1fr) auto auto',
        });
        list.appendChild(rowNode);
      });
      if (!list.children.length) list.appendChild(empty('没有匹配的模板', '换个关键词，或清空搜索。'));
    };
    search.addEventListener('input', draw);
    draw();
    page.appendChild(list);
    if (!docs.length) page.appendChild(empty('模板加载失败', '需要登录后才能读取内部手册。', btn('登录', () => showLogin(), 'ghost small')));
    return page;
  }

  /* ---------- settings ---------- */
  async function openSettings(key) {
    await ensureHistory();
    const map = {
      '': ['settings-home', '个人偏好', D.PAGE_TITLES.settings[1], renderSettingsHome],
      roles: ['settings-roles', '角色与权限', D.PAGE_TITLES['settings/roles'][1], renderSettingsRoles],
      integrations: ['settings-integrations', '数据源与系统集成', D.PAGE_TITLES['settings/integrations'][1], renderSettingsIntegrations],
      metrics: ['settings-metrics', '指标与评分规则', D.PAGE_TITLES['settings/metrics'][1], renderSettingsMetrics],
      notifications: ['settings-notifications', '通知与升级规则', D.PAGE_TITLES['settings/notifications'][1], renderSettingsNotifications],
      ai: ['settings-ai', '数据与 AI 权限', D.PAGE_TITLES['settings/ai'][1], renderSettingsAI],
      sharing: ['settings-sharing', '对外分享与脱敏规则', D.PAGE_TITLES['settings/sharing'][1], renderSettingsSharing],
      retention: ['settings-retention', '数据保留与归档', D.PAGE_TITLES['settings/retention'][1], renderSettingsRetention],
      audit: ['settings-audit', '审计日志', D.PAGE_TITLES['settings/audit'][1], renderSettingsAudit],
    };
    const meta = map[key || ''] || map[''];
    showAsyncPage(meta[0], meta[1], meta[2], async () => meta[3]());
  }
  function renderSettingsHome() {
    const prefs = ws.data.settings.prefs;
    const page = E('div');
    page.appendChild(pageHead('个人偏好', '默认客户、起始页与本地工作区；这些偏好只影响当前浏览器。', [
      btn('重置演示数据', () => resetModal(), 'ghost small'),
    ]));
    const grid = E('div', 'ws-grid');
    const defaultCustomer = select([{ value: 'all', label: '全部客户' }].concat(ws.data.customers.map(c => ({ value: c.id, label: c.name }))), prefs.defaultCustomer);
    const startPage = select([
      { value: 'home', label: '今日工作台' },
      { value: 'tasks', label: '任务中心' },
      { value: 'customers', label: '客户列表' },
      { value: 'growth', label: '我的成长' },
    ], prefs.startPage);
    const density = select([{ value: 'compact', label: '紧凑' }, { value: 'standard', label: '标准' }], prefs.density);
    const form = E('div', 'ws-form');
    form.appendChild(formField('默认客户', defaultCustomer));
    form.appendChild(formField('起始页', startPage));
    form.appendChild(formField('密度', density));
    const left = E('div', 'ws-col-7');
    left.appendChild(panel('工作区偏好', 'PREFERENCES', form));
    const saveBtn = btn('保存偏好', () => {
      prefs.defaultCustomer = defaultCustomer.value;
      prefs.startPage = startPage.value;
      prefs.density = density.value;
      ws.data.activeCustomer = defaultCustomer.value;
      save();
      updateCustomerButton();
      toast('偏好已保存', 'ok');
    }, 'primary small');
    left.appendChild(saveBtn);
    const counts = E('div', 'ws-list');
    [['客户', ws.data.customers.length], ['任务', ws.data.tasks.length], ['服务记录', ws.data.service.length],
      ['协同记录', ws.data.collab.length], ['目标', ws.data.growth.goals.length],
      ['收藏', ws.data.navFavorites.length]].forEach(([k, v]) => counts.appendChild(row({ title: k, sub: '本地工作区', meta: String(v) })));
    const right = E('div', 'ws-col-5');
    right.appendChild(panel('工作区数据', 'LOCAL DATA', counts, { sub: '演示数据保存在当前浏览器 localStorage' }));
    const info = E('div');
    info.appendChild(E('p', null, '登录后，学习进度、案例尝试、流程运行与团队数据来自服务端；客户、任务、服务与协同记录目前是本地演示工作区。'));
    right.appendChild(panel('数据边界', 'SOURCE', info));
    grid.appendChild(left);
    grid.appendChild(right);
    page.appendChild(grid);
    return page;
  }
  function resetModal() {
    openModal('重置演示工作区', E('p', null, '将清除当前浏览器中的客户、任务、服务、协同与偏好数据，并恢复演示种子数据。学习进度、服务端流程与团队数据不受影响。'), [
      btn('取消', closeOverlays),
      btn('确认重置', () => { closeOverlays(); resetWorkspace(); }, 'danger'),
    ]);
  }
  function permissionLabel(p) {
    return ({
      read: '读取', write: '写入', investigate: '发起排查', manage_users: '用户管理',
      manage_skills: 'Skill 管理', manage_teams: '团队管理', view_team: '查看团队',
      review_attempts: '案例评审',
    })[p] || p;
  }
  function renderSettingsRoles() {
    const roles = state.config?.roles || {};
    const page = E('div');
    page.appendChild(pageHead('角色与权限', '角色能力边界与服务端权限点；菜单隐藏不等于授权。', [
      btn('团队管理', () => navigate('team'), 'ghost small'),
    ]));
    const rows = Object.entries(roles).map(([role, perms]) => ({
      cells: [
        { node: (() => { const d = E('div'); d.appendChild(E('div', 'title', role)); d.appendChild(E('div', 'sub', role === state.me?.role ? '当前角色' : '服务端角色')); return d; })() },
        perms.length,
        perms.map(permissionLabel).join(' · '),
      ],
    }));
    page.appendChild(panel('角色矩阵', `${rows.length} ROLES`, table(['角色', '权限数', '权限'], rows)));
    const note = E('div');
    note.appendChild(E('p', null, '敏感能力（绩效、晋升、客户涉敏字段）不能只靠菜单隐藏，必须由服务端权限与数据授权共同控制。'));
    page.appendChild(panel('授权原则', 'POLICY', note));
    return page;
  }
  function renderSettingsIntegrations() {
    const c = state.config || {};
    const page = E('div');
    page.appendChild(pageHead('数据源与系统集成', '指标、日志、模型、区域与 Webhook；配置错误必须显式失败，不能静默返回空数据。', [
      btn('检查健康', async () => { await loadHealth(); toast(state.health ? 'API 正常' : 'API 异常', state.health ? 'ok' : 'error'); }, 'ghost small'),
    ]));
    const rows = [
      ['指标后端', c.metrics_backend || '—', c.metrics_backend === 'mock' ? '演示数据' : '已接入'],
      ['日志后端', c.logs_backend || '—', c.logs_backend === 'mock' ? '演示数据' : '已接入'],
      ['主模型', c.model_primary || '—', 'DashScope'],
      ['备用模型', c.model_fallback || '—', '故障切换'],
      ['区域', (c.regions || []).join(', ') || '默认区域', '多区域 fan-out'],
      ['Webhook 密钥', c.webhook_secret_configured ? '已配置' : '未配置', '告警接入'],
      ['API 健康', state.health === null ? '检查中' : state.health ? '正常' : '异常', '/health'],
    ].map(r => ({ cells: [r[0], { node: E('span', 'mono', r[1]) }, { node: status(r[2] === '异常' ? '预警' : '正常') }, r[2]] }));
    page.appendChild(panel('集成状态', 'INTEGRATIONS', table(['项', '值', '状态', '说明'], rows)));
    const links = E('div', 'ws-list');
    links.appendChild(row({ title: '告警接入', sub: 'POST /alerts', meta: 'API' }));
    links.appendChild(row({ title: '健康检查', sub: 'GET /health', meta: 'API' }));
    links.appendChild(row({ title: '架构与接入说明', sub: 'docs/architecture.md', meta: 'DOC' }));
    page.appendChild(panel('接入入口', 'ENDPOINTS', links));
    return page;
  }
  function renderSettingsMetrics() {
    const latest = (state.evals || [])[0];
    const page = E('div');
    page.appendChild(pageHead('指标与评分规则', '评测口径、质量门与案例评分；fake 评测只验证链路，不代表模型效果。', [
      btn('查看评测', () => navigate('evals'), 'ghost small'),
    ]));
    page.appendChild(kpis([
      { label: '根因命中率', value: latest ? `${Math.round(Number(latest.hit_rate) * 100)}%` : '—', sub: '质量门 ≥ 80%' },
      { label: '证据充分性', value: latest ? Number(latest.avg_evidence_sufficiency).toFixed(2) : '—', sub: '质量门 ≥ 0.60' },
      { label: '平均步数', value: latest ? Number(latest.avg_steps).toFixed(1) : '—', sub: '越低越收敛' },
      { label: '评测样本', value: latest ? latest.total : '—', sub: '最近一次' },
    ]));
    const rows = [
      ['根因命中率', 'hit_rate', '≥ 80%', '根因关键词命中'],
      ['关键词命中率', 'keyword_rate', '≥ 80%', '异常证据关键词'],
      ['证据充分性', 'avg_evidence_sufficiency', '≥ 0.60', 'LLM-as-Judge'],
      ['平均步数', 'avg_steps', '趋势观察', '收敛效率'],
      ['案例评分', 'score', '0–1', '关键词命中即 1'],
    ].map(r => ({ cells: r }));
    page.appendChild(panel('评分规则', 'RULES', table(['指标', '字段', '口径', '说明'], rows)));
    const note = E('div');
    note.appendChild(E('p', null, 'CI 使用 fake 模式做质量门，验证链路与报告结构；真实模型效果必须用真实评测，不得用 fake 结果对外宣称。'));
    page.appendChild(panel('质量门说明', 'GATE', note));
    return page;
  }
  function renderSettingsNotifications() {
    const n = state.config?.notifications || {};
    const page = E('div');
    page.appendChild(pageHead('通知与升级规则', '通知通道、触发条件与升级矩阵；节奏重于内容。', [
      btn('升级记录', () => navigate('incidents/escalation'), 'ghost small'),
    ]));
    const channels = [
      ['钉钉', n.dingtalk], ['飞书', n.feishu], ['Slack', n.slack],
    ].map(([label, on]) => ({ cells: [label, { node: status(on ? '已配置' : '未配置') }, on ? '完成与确认通知' : '通过环境变量配置 Webhook'] }));
    page.appendChild(panel('通知通道', 'CHANNELS', table(['通道', '状态', '用途'], channels)));
    const triggers = [
      ['排查完成', 'done', '发送根因报告摘要', '全部'],
      ['敏感动作待确认', 'confirm_request', '推送确认请求', 'P1 / 高风险动作'],
      ['重大事件升级', 'escalation', '按矩阵通报', 'P1 / P2'],
      ['任务逾期', 'overdue', '每日汇总', '负责人 / 主管'],
    ].map(r => ({ cells: r }));
    page.appendChild(panel('触发规则', 'TRIGGERS', table(['事件', '代码', '动作', '范围'], triggers)));
    const matrix = [
      ['P1', '15 分钟', '电话 + 作战室 + 高层', '每 30 分钟'],
      ['P2', '30 分钟', '客户技术群 + 电话', '每 2 小时'],
      ['P3', '2 小时', '工单 + 邮件', '每日'],
    ].map(r => ({ cells: r }));
    page.appendChild(panel('升级矩阵', 'ESCALATION', table(['级别', '首次响应', '通道', '节奏'], matrix)));
    return page;
  }
  function renderSettingsAI() {
    const c = state.config || {};
    const page = E('div');
    page.appendChild(pageHead('数据与 AI 权限', '模型、调用边界与护栏；AI 可以建议，但不能绕过审批。', [
      btn('护栏手册', () => navigate('book/ch09-risk-compliance'), 'ghost small'),
      btn('排查工作台', () => navigate('workbench'), 'ghost small'),
    ]));
    const rows = [
      ['主模型', c.model_primary || '—', '生成排查计划与报告'],
      ['备用模型', c.model_fallback || '—', '主模型故障时切换'],
      ['最大步数', c.max_steps || '—', 'ReAct 循环上限'],
      ['区域', (c.regions || []).join(', ') || '默认', '跨区域查询'],
      ['动作白名单', '启用', '仅允许登记动作'],
      ['Dry-run', '启用', '敏感动作先预览'],
      ['人工确认', '启用', '高风险动作必须批准'],
      ['审计', '启用', '所有动作写入审计'],
    ].map(r => ({ cells: [r[0], { node: E('span', 'mono', r[1]) }, r[2]] }));
    page.appendChild(panel('AI 运行边界', 'GUARDRAILS', table(['项', '值', '说明'], rows)));
    const boundary = E('div');
    boundary.appendChild(E('p', null, '客户敏感字段、关键人评价、绩效与晋升材料分别授权；AI 助手只读取当前工作区上下文，不自动跨客户聚合敏感数据。'));
    page.appendChild(panel('数据边界', 'PRIVACY', boundary));
    return page;
  }
  function renderSettingsSharing() {
    const s = ws.data.settings.sharing;
    const page = E('div');
    page.appendChild(pageHead('对外分享与脱敏规则', '客户材料外出前的检查与授权；分享出去的内容不可撤回。', [
      btn('风险与合规', () => navigate('book/ch09-risk-compliance'), 'ghost small'),
    ]));
    const toggles = E('div');
    [['redaction', '自动脱敏', '客户名称、IP、账号等敏感字段'], ['externalApproval', '外部审批', '客户材料外出前需审批'], ['watermark', '水印', '导出文件带分享者标识']].forEach(([key, label, desc]) => {
      const checked = input('checkbox');
      checked.checked = !!s[key];
      checked.addEventListener('change', () => { s[key] = checked.checked; save(); toast('分享规则已更新', 'ok'); });
      const wrap = E('div');
      wrap.style.cssText = 'display:flex;align-items:center;gap:8px';
      wrap.appendChild(checked);
      wrap.appendChild(E('span', null, label));
      const setting = E('div', 'ws-setting-row');
      const left = E('div');
      left.appendChild(wrap);
      left.appendChild(E('div', 'desc', desc));
      setting.appendChild(left);
      const value = E('div', 'value', checked.checked ? '开启' : '关闭');
      checked.addEventListener('change', () => { value.textContent = checked.checked ? '开启' : '关闭'; });
      setting.appendChild(value);
      toggles.appendChild(setting);
    });
    page.appendChild(panel('分享规则', 'SHARING', toggles));
    const checklist = E('div');
    ['确认接收方与用途', '移除客户涉敏字段', '检查截图与附件', '取得外部分享授权', '记录审计信息'].forEach(item => checklist.appendChild(row({ leading: status('检查'), title: item, sub: '对外分享前', grid: 'auto minmax(0,1fr)' })));
    page.appendChild(panel('外出前检查', 'CHECKLIST', checklist));
    return page;
  }
  function renderSettingsRetention() {
    const r = ws.data.settings.retention;
    const page = E('div');
    page.appendChild(pageHead('数据保留与归档', '报告、Trace、审计与档案的保留策略；保留不是永久，删除也要可解释。', []));
    const rows = [
      ['排查报告', `${r.reportsDays} 天`, `${(state.history || []).length} 条记录`],
      ['Trace', `${r.tracesDays} 天`, '排查过程 JSONL'],
      ['审计日志', `${r.auditDays} 天`, '敏感动作与审批'],
      ['客户档案', '合同期 + 90 天', '离任交接后归档'],
      ['学习与证据', '账号存续期', '案例、流程与成就'],
    ].map(x => ({ cells: [x[0], { node: E('span', 'mono', x[1]) }, x[2]] }));
    page.appendChild(panel('保留策略', 'RETENTION', table(['对象', '保留期', '说明'], rows)));
    const actions = E('div', 'ws-action-stack');
    actions.appendChild(btn('导出审计记录', async () => {
      try {
        const response = await fetch('/api/audit?limit=500', { headers: authHeaders() });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        downloadText('audit.json', await response.text());
      } catch (error) { toast(`导出失败：${error.message}`, 'error'); }
    }, 'ghost small'));
    actions.appendChild(btn('查看审计日志', () => navigate('settings/audit'), 'ghost small'));
    page.appendChild(panel('归档动作', 'ACTIONS', actions));
    return page;
  }
  async function renderSettingsAudit() {
    const page = E('div');
    const response = await fetch('/api/audit?limit=100', { headers: authHeaders() });
    if (!response.ok) {
      const message = response.status === 401 ? '需要登录后查看审计日志。' : response.status === 403 ? '审计日志仅对 Admin 开放。' : `HTTP ${response.status}`;
      page.appendChild(pageHead('审计日志', '敏感动作、批准与执行记录。', []));
      page.appendChild(empty('无权查看审计日志', message, btn('返回设置', () => navigate('settings'), 'ghost small')));
      return page;
    }
    const data = await response.json();
    page.appendChild(pageHead('审计日志', '敏感动作、批准与执行记录；只读，不可修改。', [
      btn('刷新', rerender, 'ghost small'),
    ]));
    const entries = data.entries || [];
    page.appendChild(kpis([
      { label: '审计记录', value: entries.length, sub: '最近 100 条' },
      { label: '已执行', value: entries.filter(e => e.result === 'executed').length, sub: '动作完成' },
      { label: '已拒绝', value: entries.filter(e => e.result === 'denied').length, sub: '护栏拦截' },
      { label: 'Dry-run', value: entries.filter(e => e.dry_run).length, sub: '预览' },
    ]));
    if (!entries.length) {
      page.appendChild(empty('还没有审计记录', '敏感动作执行后会出现在这里。'));
    } else {
      const rows = entries.map(e => ({
        cells: [
          { node: status(e.result === 'executed' ? '已执行' : e.result === 'denied' ? '已拒绝' : e.result || '—') },
          { node: (() => { const d = E('div'); d.appendChild(E('div', 'title', e.action)); d.appendChild(E('div', 'sub', e.params ? JSON.stringify(e.params) : '—')); return d; })() },
          e.actor, e.dry_run ? '是' : '否', fmtDate(e.created_at),
        ],
      }));
      page.appendChild(panel('审计记录', `${entries.length} ENTRIES`, table(['结果', '动作', '执行人', 'Dry-run', '时间'], rows)));
    }
    return page;
  }

  /* ---------- finish module ---------- */

  window.WS = {
    init() {
      ensureOverlays();
      ws.data = loadData();
      ensureCollections();
      renderNav();
      bindShell();
      updateCustomerButton();
      refreshBadges();
    },
    async handleRoute(route, param) { return handleRoute(route, param); },
    defaultRoute() {
      return (ws.data && ws.data.settings && ws.data.settings.prefs && ws.data.settings.prefs.startPage) || 'home';
    },
    setActiveNav(key) { return setActiveNav(key); },
    syncUser() {
      renderNav();
      updateCustomerButton();
      refreshBadges();
    },
    linkInvestigation(invId) {
      const c = activeCustomer();
      if (!c) return;
      ws.data.investigationLinks[invId] = c.id;
      save();
    },
    refresh() {
      renderNav();
      updateCustomerButton();
      refreshBadges();
    },
  };

  /* ---------- shell binding ---------- */
  function bindShell() {
    $('#ws-customer-btn')?.addEventListener('click', event => openCustomerMenu(event.currentTarget));
    $('#ws-search-btn')?.addEventListener('click', openPalette);
    $('#ws-quick-btn')?.addEventListener('click', event => openMenu(event.currentTarget, [
      { label: '新建任务', key: 'T', onclick: () => createTaskModal() },
      { label: '记录承诺 / 会议', key: 'C', onclick: () => createCommitmentModal() },
      { label: '发起排查', key: 'I', onclick: () => navigate('workbench') },
      { label: '开始流程', key: 'W', onclick: () => navigate('workflows') },
      { label: '记录工时', key: 'H', onclick: () => createTimeModal() },
    ]));
    $('#ws-assistant-btn')?.addEventListener('click', openAssistant);
    $('#ws-notif-btn')?.addEventListener('click', openNotifications);
    $('#ws-backdrop')?.addEventListener('click', closeOverlays);
    $('#ws-palette-input')?.addEventListener('input', event => {
      ws.lastSearch = event.target.value;
      renderPalette(event.target.value);
    });
    $('#ws-palette-input')?.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        const first = $('#ws-palette-results .ws-palette-row');
        if (first) first.click();
      }
    });
    window.addEventListener('keydown', event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openPalette();
      }
      if (event.key === 'Escape') closeOverlays();
    });
  }

  /* ---------- shared creation modals ---------- */
  function createCommitmentModal(defaults) {
    const d = defaults || {};
    const title = input('text', d.title || '');
    const customer = select(customerOptions(), d.customerId || defaultCustomerId());
    const owner = select([meName(), '陈默', '赵启', '李衡', '王珂', '林晓'], d.owner || meName());
    const type = select([
      { value: 'meeting-decisions', label: '会议 / 决策' },
      { value: 'iron-triangle', label: '铁三角协同' },
      { value: 'presales-handover', label: '承诺 / 移交' },
      { value: 'product-feedback', label: '产品反馈' },
      { value: 'partner', label: '伙伴协同' },
      { value: 'qbr-ebr', label: 'QBR / EBR' },
      { value: 'vbr-value', label: '价值报告' },
      { value: 'renewal-signals', label: '经营信号' },
    ], d.type || 'meeting-decisions');
    const decision = textarea(d.decision || '', '结论、承诺或待确认事项');
    const date = input('date', d.date ? String(d.date).slice(0, 10) : D.dateOnly(0));
    const form = E('div', 'ws-form');
    form.appendChild(formField('标题', title, true));
    form.appendChild(formField('客户', customer));
    form.appendChild(formField('类型', type));
    form.appendChild(formField('负责人', owner));
    form.appendChild(formField('日期', date));
    form.appendChild(formField('结论 / 承诺', decision, true));
    openModal('记录承诺 / 会议', form, [
      btn('取消', closeOverlays),
      btn('保存', () => {
        if (!title.value.trim()) { toast('请填写标题', 'error'); return; }
        const rec = {
          id: id('c'), type: type.value, title: title.value.trim(),
          customerId: customer.value || '', owner: owner.value,
          status: '进行中', date: new Date(`${date.value}T10:00:00`).toISOString(),
          participants: [owner.value], decision: decision.value.trim(),
          actions: [], related: '', timeline: [{ date: nowIso(), text: '记录创建' }],
          createdAt: nowIso(), updatedAt: nowIso(),
        };
        ws.data.collab.unshift(rec);
        save();
        closeOverlays();
        toast('已记录', 'ok');
        navigate(`record/${rec.id}`);
      }, 'primary'),
    ]);
  }
  function createTimeModal() {
    const date = input('date', D.dateOnly(0));
    const type = select(['客户现场', '重大保障', '值班', '学习', '加班', '调休', '其他'], '客户现场');
    const hours = input('number', '2');
    hours.step = '0.5';
    hours.min = '0.5';
    const note = input('text', '');
    const form = E('div', 'ws-form');
    form.appendChild(formField('日期', date));
    form.appendChild(formField('类型', type));
    form.appendChild(formField('小时', hours));
    form.appendChild(formField('备注', note));
    openModal('记录工时', form, [
      btn('取消', closeOverlays),
      btn('保存', () => {
        const h = Number(hours.value) || 0;
        if (!h) { toast('请填写小时数', 'error'); return; }
        ws.data.growth.time.unshift({
          id: id('tm'), date: date.value, type: type.value, hours: h,
          note: note.value.trim(), comp: type.value === '加班' ? h : 0,
        });
        save();
        closeOverlays();
        rerender();
        toast('工时已记录', 'ok');
      }, 'primary'),
    ]);
  }

  /* ---------- customer brief ---------- */
  function customerBrief(c) {
    const text = [
      `# ${c.name} · 客户简报`,
      '',
      `- 生命周期：${c.stage}`,
      `- 健康度：${c.health}（${c.healthLabel}）`,
      `- 负责人：${c.owner}`,
      `- 服务：${c.services.plan} · SLA ${c.services.sla} · XLA ${c.services.xla}`,
      `- 下一节点：${c.next}（${fmtDay(c.nextDate)}）`,
      `- 续约：${fmtDay(c.renewal)} · ARR ${c.arr}`,
      '',
      '## 当前结论',
      c.brief,
      '',
      `最高风险：${c.topRisk}`,
      '',
      '## 关键风险',
      ...c.risks.map(r => `- [${r.level}] ${r.title} · ${r.owner} · ${r.status}`),
      '',
      '## 关系与协同',
      ...c.relations.map(r => `- ${r.name}（${r.role}）· ${r.stance} · ${r.note}`),
      '',
      '## 价值账本',
      ...c.adoption.ledger.map(v => `- ${v.item} · ${v.value}`),
      '',
      '## 下一步',
      ...openLocalTasks().filter(t => t.customerId === c.id).slice(0, 5).map(t => `- ${t.title}（${t.priority}，${statusLabel(t.status)}）`),
    ].join('\n');
    const body = E('div');
    const pre = E('pre');
    pre.style.margin = '0';
    pre.style.whiteSpace = 'pre-wrap';
    pre.style.font = '11px/1.6 var(--mono)';
    pre.textContent = text;
    body.appendChild(pre);
    openModal(`${c.name} · 客户简报`, body, [
      btn('复制 Markdown', async () => {
        try { await navigator.clipboard.writeText(text); toast('已复制', 'ok'); }
        catch (error) { toast('复制失败，请手动选择文本', 'error'); }
      }, 'ghost'),
      btn('下载 .md', () => downloadText(`${c.id}-brief.md`, text), 'primary'),
    ], 'min(720px, 94vw)');
  }
  function downloadText(filename, text) {
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = E('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ---------- war room ---------- */
  function openWarRoom() {
    $$('.view').forEach(view => view.classList.toggle('active', view.id === 'view-workbench'));
    const incident = activeIncidents()[0];
    const title = incident ? `作战室 · ${incident.title}` : '作战室';
    setTopbar(title, incident ? `${incident.sev} · 指挥 ${incident.commander} · ${incident.nextComm || '保持通报节奏'}` : '告警进，证据出；结束后回到重大事件台账');
    highlightNav('war-room', false);
    const view = $('#view-workbench');
    if (!view) return;
    let banner = $('#ws-war-banner');
    if (!banner) {
      banner = E('div', 'ws-war-banner');
      banner.id = 'ws-war-banner';
      view.insertBefore(banner, view.firstChild);
    }
    clear(banner);
    const left = E('div');
    left.appendChild(E('div', 'ws-war-kicker', incident ? 'INCIDENT WAR ROOM' : 'STANDBY WAR ROOM'));
    left.appendChild(E('div', 'ws-war-title', incident ? incident.title : '当前没有进行中的重大事件'));
    left.appendChild(E('div', 'ws-war-sub', incident
      ? `${customerName(incident.customerId) || '未关联客户'} · ${incident.summary || ''}`
      : '从重大事件进入，或直接粘贴告警开始一次排查。'));
    banner.appendChild(left);
    const right = E('div', 'ws-war-actions');
    if (incident) right.appendChild(btn('事件详情', () => navigate(`event/${incident.id}`), 'ghost small'));
    right.appendChild(btn('RCA 模板', () => navigate('book/07-rca-template'), 'ghost small'));
    right.appendChild(btn('返回重大事件', () => navigate('incidents/major'), 'ghost small'));
    banner.appendChild(right);
    updateWorkbenchContext();
    renderFaultChips();
    const status = $('#status');
    if (status && state.currentInvId) status.textContent = `排查 ${state.currentInvId}`;
    window.scrollTo(0, 0);
  }
})();
