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
    'cron': './cron/index.html'
  };

  const elements = {
    frame: null,
    navButtons: [],
    toolboxToggle: null,
    toolboxGroup: null
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

    // 当切到 json 时，确保“工具箱”展开
    if (key === 'json' && elements.toolboxGroup && elements.toolboxToggle) {
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
