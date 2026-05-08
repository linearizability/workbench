/**
 * 聚合页（壳页面）- 导航与模块装载
 */

(function() {
  'use strict';

  const ROUTES = {
    links: './links/index.html',
    notepad: './notepad/index.html',
    json: './json/index.html',
    'file-generator': './file-generator/index.html',
    'image-generator': './image-generator/index.html',
    'properties-yaml': './properties-yaml/index.html',
    'svg-editor': './svg-editor/index.html',
    'md5': './md5/index.html',
    'base64': './base64/index.html',
    'qrcode': './qrcode/index.html',
    'timestamp': './timestamp/index.html',
    'cron': './cron/index.html',
    'url': './url/index.html',
    'jwt': './jwt/index.html',
    'uuid': './uuid/index.html',
    'regex': './regex/index.html',
    'diff': './diff/index.html',
    'json-to-struct': './json-to-struct/index.html',
    'http-request': './http-request/index.html',
    'workflow': './workflow/index.html'
  };

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
    const toolboxKeys = ['json','file-generator','image-generator','properties-yaml','svg-editor','md5','base64','qrcode','timestamp','cron','url','jwt','uuid','regex','diff','json-to-struct','http-request'];
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

  init();

})();
