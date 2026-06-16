/**
 * 聚合页（壳页面）- 导航与模块装载
 */

(function() {
  'use strict';

  const ROUTES = {
    links: './links/index.html',
    notepad: './notepad/index.html',
    json: './tools/json/index.html',
    'file-generator': './tools/file-generator/index.html',
    'image-generator': './tools/image-generator/index.html',
    'properties-yaml': './tools/properties-yaml/index.html',
    'svg-editor': './tools/svg-editor/index.html',
    'md5': './tools/md5/index.html',
    'base64': './tools/base64/index.html',
    'qrcode': './tools/qrcode/index.html',
    'timestamp': './tools/timestamp/index.html',
    'cron': './tools/cron/index.html',
    'url': './tools/url/index.html',
    'jwt': './tools/jwt/index.html',
    'uuid': './tools/uuid/index.html',
    'regex': './tools/regex/index.html',
    'diff': './tools/diff/index.html',
    'json-to-struct': './tools/json-to-struct/index.html',
    'http-request': './tools/http-request/index.html',
    'password-generator': './tools/password-generator/index.html',
    'unicode': './tools/unicode/index.html',
    'workflow': './workflow/index.html'
  };

  const NAV_ITEMS = [
    { id: 'links', icon: '🔗', name: '常用链接', group: 'module' },
    { id: 'notepad', icon: '📒', name: '备忘录', group: 'module' },
    { id: 'workflow', icon: '⚡', name: '工作流编排', group: 'module' },
    { id: 'json', icon: '📝', name: 'JSON 工具', group: 'toolbox' },
    { id: 'file-generator', icon: '📄', name: '文件生成器', group: 'toolbox' },
    { id: 'image-generator', icon: '🖼️', name: '图片生成器', group: 'toolbox' },
    { id: 'properties-yaml', icon: '⚙️', name: 'Properties ↔ YAML', group: 'toolbox' },
    { id: 'svg-editor', icon: '🧩', name: 'SVG 编辑器', group: 'toolbox' },
    { id: 'md5', icon: '#️⃣', name: 'MD5 计算', group: 'toolbox' },
    { id: 'base64', icon: '🔐', name: 'Base64 编解码', group: 'toolbox' },
    { id: 'qrcode', icon: '📱', name: '二维码工具', group: 'toolbox' },
    { id: 'timestamp', icon: '🕐', name: '时间戳转换', group: 'toolbox' },
    { id: 'cron', icon: '⏰', name: 'Cron 表达式', group: 'toolbox' },
    { id: 'url', icon: '🔗', name: 'URL 编解码', group: 'toolbox' },
    { id: 'jwt', icon: '🎫', name: 'JWT 解码', group: 'toolbox' },
    { id: 'uuid', icon: '🆔', name: 'UUID 生成器', group: 'toolbox' },
    { id: 'regex', icon: '🔍', name: '正则测试', group: 'toolbox' },
    { id: 'diff', icon: '🔄', name: '文本对比', group: 'toolbox' },
    { id: 'json-to-struct', icon: '📦', name: 'JSON 转 Struct', group: 'toolbox' },
    { id: 'http-request', icon: '🌐', name: 'HTTP 请求', group: 'toolbox' },
    { id: 'password-generator', icon: '🔑', name: '密码生成器', group: 'toolbox' },
    { id: 'unicode', icon: '🔤', name: 'Unicode 编解码', group: 'toolbox' }
  ];

  const elements = {
    frame: null,
    navButtons: [],
    toolboxToggle: null,
    toolboxGroup: null,
    collapseBtn: null,
    shell: null
  };

  function init() {
    cacheElements();
    bindEvents();
    initSearch();
    applyInitialRoute();
  }

  function cacheElements() {
    elements.frame = document.getElementById('module-frame');
    elements.navButtons = Array.from(document.querySelectorAll('[data-nav]'));
    elements.toolboxToggle = document.querySelector('[data-toggle="toolbox"]');
    elements.toolboxGroup = document.querySelector('.menu-group');
    elements.collapseBtn = document.getElementById('sidebar-collapse-btn');
    elements.shell = document.querySelector('.shell');
  }

  function bindEvents() {
    elements.navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.nav;
        navigate(key);
      });
    });

    if (elements.toolboxToggle) {
      elements.toolboxToggle.addEventListener('click', () => {
        toggleToolbox();
      });
    }

    if (elements.collapseBtn) {
      elements.collapseBtn.addEventListener('click', () => {
        toggleSidebar();
      });
    }

    window.addEventListener('hashchange', () => {
      const key = getRouteFromHash();
      if (key) navigate(key, { updateHash: false });
    });
  }

  function toggleToolbox() {
    if (!elements.toolboxGroup || !elements.toolboxToggle) return;
    const collapsed = elements.toolboxGroup.classList.toggle('is-collapsed');
    elements.toolboxToggle.setAttribute('aria-expanded', String(!collapsed));
  }

  function toggleSidebar() {
    if (!elements.shell || !elements.collapseBtn) return;
    const collapsed = elements.shell.classList.toggle('is-sidebar-collapsed');
    elements.collapseBtn.textContent = collapsed ? '▸' : '◂';
    elements.collapseBtn.title = collapsed ? '展开侧边栏' : '收起侧边栏';
  }

  function applyInitialRoute() {
    const key = getRouteFromHash() || 'links';
    navigate(key, { updateHash: false });
    setHash(key);
  }

  function getRouteFromHash() {
    const raw = (location.hash || '').replace(/^#/, '').trim();
    return ROUTES[raw] ? raw : null;
  }

  function setHash(key) {
    if (location.hash === `#${key}`) return;
    history.replaceState(null, '', `#${key}`);
  }

  function navigate(key, opts = {}) {
    const { updateHash = true } = opts;
    const src = ROUTES[key];
    if (!src || !elements.frame) return;

    elements.frame.src = src;
    setActiveNav(key);

    // 当切到工具箱内的子工具时，自动展开工具箱
    const ROOT_LEVEL_MODULES = new Set(['links', 'notepad', 'workflow']);
    const toolboxKeys = Object.keys(ROUTES).filter(k => !ROOT_LEVEL_MODULES.has(k));
    if (toolboxKeys.includes(key) && elements.toolboxGroup && elements.toolboxToggle) {
      elements.toolboxGroup.classList.remove('is-collapsed');
      elements.toolboxToggle.setAttribute('aria-expanded', 'true');
    }

    if (updateHash) setHash(key);
  }

  function setActiveNav(key) {
    elements.navButtons.forEach(btn => {
      const isActive = btn.dataset.nav === key;
      btn.classList.toggle('is-active', isActive);
    });
  }

  // ── 全局搜索 ──

  let searchResultsData = [];
  let searchActiveIndex = -1;

  function initSearch() {
    elements.searchInput = document.getElementById('global-search-input');
    elements.searchClear = document.getElementById('global-search-clear');
    elements.searchResults = document.getElementById('global-search-results');
    elements.searchKbd = document.getElementById('global-search-kbd');
    elements.globalSearch = document.getElementById('global-search');

    if (!elements.searchInput) return;

    elements.searchInput.addEventListener('input', debounce(handleSearch, 200));
    elements.searchInput.addEventListener('focus', () => {
      if (elements.searchInput.value.trim()) handleSearch();
    });
    elements.searchClear.addEventListener('click', clearSearch);

    elements.searchInput.addEventListener('keydown', handleSearchKeydown);

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#global-search')) {
        closeSearchResults();
      }
    });

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        elements.searchInput.focus();
      }
      if (e.key === 'Escape' && elements.searchResults.classList.contains('is-visible')) {
        closeSearchResults();
        elements.searchInput.blur();
      }
    });
  }

  function handleSearchKeydown(e) {
    if (!elements.searchResults.classList.contains('is-visible')) return;
    const items = elements.searchResults.querySelectorAll('.global-search-item');
    if (items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      searchActiveIndex = searchActiveIndex < items.length - 1 ? searchActiveIndex + 1 : 0;
      updateSearchFocus(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      searchActiveIndex = searchActiveIndex > 0 ? searchActiveIndex - 1 : items.length - 1;
      updateSearchFocus(items);
    } else if (e.key === 'Enter' && searchActiveIndex >= 0 && searchActiveIndex < items.length) {
      e.preventDefault();
      items[searchActiveIndex].click();
    }
  }

  function updateSearchFocus(items) {
    items.forEach((item, i) => item.classList.toggle('is-focused', i === searchActiveIndex));
    if (searchActiveIndex >= 0 && items[searchActiveIndex]) {
      items[searchActiveIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  function handleSearch() {
    const query = elements.searchInput.value.trim().toLowerCase();
    elements.searchClear.style.display = query.length > 0 ? 'flex' : 'none';
    if (elements.searchKbd) elements.searchKbd.style.display = query.length > 0 ? 'none' : '';
    searchActiveIndex = -1;

    if (!query) {
      closeSearchResults();
      return;
    }

    const results = [];

    NAV_ITEMS.forEach(item => {
      if (item.name.toLowerCase().includes(query) || item.id.toLowerCase().includes(query)) {
        results.push({
          type: 'nav',
          icon: item.icon,
          name: item.name,
          meta: item.group === 'module' ? '模块' : '工具',
          action: () => { navigate(item.id); closeSearchResults(); clearSearch(); }
        });
      }
    });

    try {
      const allLinks = JSON.parse(localStorage.getItem('tools_home_links') || '[]');
      allLinks.forEach(link => {
        const text = (link.name + ' ' + (link.url || '') + ' ' + (link.category || '')).toLowerCase();
        if (text.includes(query)) {
          results.push({
            type: 'link',
            icon: link.icon || '🔗',
            name: link.name,
            meta: link.url || '',
            action: () => { window.open(link.url, '_blank'); closeSearchResults(); clearSearch(); }
          });
        }
      });
    } catch (_) {}

    try {
      const notesData = JSON.parse(localStorage.getItem('tools_notepad_notes') || '[]');
      notesData.forEach(note => {
        const text = ((note.title || '') + ' ' + (note.content || '') + ' ' + (note.category || '')).toLowerCase();
        if (text.includes(query)) {
          results.push({
            type: 'note',
            icon: '📒',
            name: note.title || '无标题',
            meta: note.category || '备忘',
            action: () => { navigate('notepad'); closeSearchResults(); clearSearch(); }
          });
        }
      });
    } catch (_) {}

    renderSearchResults(results, query);
  }

  function renderSearchResults(results, query) {
    if (results.length === 0) {
      elements.searchResults.innerHTML = '<div class="global-search-empty">未找到匹配结果</div>';
      elements.searchResults.classList.add('is-visible');
      return;
    }

    const grouped = {};
    const groupOrder = ['nav', 'link', 'note'];
    const groupLabels = { nav: '工具与模块（跳转）', link: '常用链接（新标签打开）', note: '备忘录（跳转）' };

    results.forEach(r => {
      const g = r.type;
      if (!grouped[g]) grouped[g] = [];
      grouped[g].push(r);
    });

    let html = '';
    groupOrder.forEach(g => {
      if (!grouped[g]) return;
      html += `<div class="global-search-group"><div class="global-search-group-title">${groupLabels[g]}</div>`;
      grouped[g].slice(0, 10).forEach(r => {
        html += `<div class="global-search-item" data-search-type="${r.type}">
          <span class="global-search-item-icon">${r.icon}</span>
          <span class="global-search-item-text">${highlightMatch(r.name, query)}</span>
          <span class="global-search-item-meta">${escapeSearchHtml(r.meta)}</span>
        </div>`;
      });
      html += '</div>';
    });

    elements.searchResults.innerHTML = html;
    elements.searchResults.classList.add('is-visible');

    elements.searchResults.querySelectorAll('.global-search-item').forEach(item => {
      item.addEventListener('click', () => {
        const type = item.dataset.searchType;
        const idx = Array.from(item.parentNode.querySelectorAll('.global-search-item')).indexOf(item);
        const matchingResults = results.filter(r => r.type === type);
        if (matchingResults[idx]) matchingResults[idx].action();
      });
    });
  }

  function highlightMatch(text, query) {
    if (!query) return escapeSearchHtml(text);
    const escaped = escapeSearchHtml(text);
    const regex = new RegExp(`(${escapeSearchRegex(query)})`, 'gi');
    return escaped.replace(regex, '<mark>$1</mark>');
  }

  function escapeSearchHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeSearchRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function closeSearchResults() {
    elements.searchResults.classList.remove('is-visible');
    searchActiveIndex = -1;
  }

  function clearSearch() {
    elements.searchInput.value = '';
    elements.searchClear.style.display = 'none';
    if (elements.searchKbd) elements.searchKbd.style.display = '';
    closeSearchResults();
  }

  init();

})();
