/**
 * UUID 生成器 - 核心逻辑
 */

(function() {
  'use strict';

  const el = {};
  const config = {
    quantity: 1,
    format: 'standard',
    caseType: 'lower'
  };

  function init() {
    cacheElements();
    bindEvents();
  }

  function cacheElements() {
    el.result = document.getElementById('uuid-result');
    el.count = document.getElementById('uuid-count');
    el.qtyOptions = document.getElementById('quantity-options');
    el.fmtOptions = document.getElementById('format-options');
    el.caseOptions = document.getElementById('case-options');
  }

  function bindEvents() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn) {
        const handler = ACTIONS[btn.dataset.action];
        if (handler) handler();
        return;
      }

      const qty = e.target.closest('[data-qty]');
      if (qty) { setOption('quantity', qty.dataset.qty, el.qtyOptions); return; }

      const fmt = e.target.closest('[data-format]');
      if (fmt) { setOption('format', fmt.dataset.format, el.fmtOptions); return; }

      const c = e.target.closest('[data-case]');
      if (c) { setOption('caseType', c.dataset.case, el.caseOptions); return; }
    });
  }

  function setOption(key, value, container) {
    config[key] = Number(value) || value;
    container.querySelectorAll('button').forEach(b => b.classList.toggle('is-active', b.dataset[key === 'caseType' ? 'case' : key === 'quantity' ? 'qty' : 'format'] === value));
  }

  // ── 生成 ──
  function doGenerate() {
    const uuids = [];
    for (let i = 0; i < config.quantity; i++) {
      uuids.push(formatUuid(uuidv4()));
    }
    renderResult(uuids);
    el.count.textContent = uuids.length + ' 条';
  }

  function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function formatUuid(raw) {
    let str = raw;
    if (config.format === 'plain') {
      str = str.replace(/-/g, '');
    }
    if (config.caseType === 'upper') {
      str = str.toUpperCase();
    }
    return str;
  }

  function renderResult(list) {
    if (!list.length) {
      el.result.innerHTML = '<div class="placeholder">点击「生成」按钮创建 UUID</div>';
      return;
    }

    let html = '<ul class="uuid-result-list">';
    list.forEach((item, idx) => {
      html += `<li class="uuid-result-item">
        <code class="uuid-result-code">${escapeHtml(item)}</code>
        <button class="btn btn-sm btn-secondary" data-copy-index="${idx}">复制</button>
      </li>`;
    });
    html += '</ul>';
    el.result.innerHTML = html;

    el.result.querySelectorAll('[data-copy-index]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.copyIndex);
        copyToClipboard(list[idx]).then(ok => showToast(ok ? '已复制' : '复制失败', ok ? 'success' : 'error'));
      });
    });
  }

  function doClear() {
    renderResult([]);
    el.count.textContent = '0 条';
    showToast('已清空', 'success');
  }

  function doCopyAll() {
    const items = el.result.querySelectorAll('.uuid-result-code');
    if (!items.length) { showToast('没有可复制的内容', 'warning'); return; }
    const text = Array.from(items).map(c => c.textContent).join('\n');
    copyToClipboard(text).then(ok => showToast(ok ? '全部已复制' : '复制失败', ok ? 'success' : 'error'));
  }

  // ── 动作映射 ──
  const ACTIONS = {
    generate: doGenerate,
    clear: doClear,
    'copy-all': doCopyAll
  };

  init();

})();
