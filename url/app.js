/**
 * URL 编解码工具 - 核心逻辑
 */

(function() {
  'use strict';

  // ── 状态 ──
  let mode = 'encode';

  // ── DOM ──
  const el = {};

  // ── 初始化 ──
  function init() {
    cacheElements();
    bindEvents();
  }

  function cacheElements() {
    el.inputEditor  = document.getElementById('input-editor');
    el.outputEditor = document.getElementById('output-editor');
    el.inputLabel   = document.getElementById('input-label');
    el.outputLabel  = document.getElementById('output-label');
    el.inputInfo    = document.getElementById('input-info');
    el.outputInfo   = document.getElementById('output-info');
  }

  function bindEvents() {
    // 模式切换
    document.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });

    // 实时转换
    el.inputEditor.addEventListener('input', debounce(doConvert, 200));

    // 事件委托按钮
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const handler = ACTIONS[btn.dataset.action];
      if (handler) handler();
    });
  }

  function setMode(newMode) {
    mode = newMode;
    document.querySelectorAll('[data-mode]').forEach(btn => {
      const active = btn.dataset.mode === newMode;
      btn.classList.toggle('btn-primary', active);
      btn.classList.toggle('btn-secondary', !active);
    });

    const labels = {
      encode: ['输入文本', '编码结果'],
      decode: ['输入编码文本', '解码结果'],
      query:  ['输入 URL', 'QueryString 解析']
    };
    const [inLabel, outLabel] = labels[newMode] || labels.encode;
    el.inputLabel.textContent = inLabel;
    el.outputLabel.textContent = outLabel;

    el.inputEditor.placeholder = {
      encode: '输入要编码的文本…',
      decode: '输入已编码的文本…',
      query:  '输入 URL，如 https://example.com?name=foo&age=20'
    }[newMode];

    doConvert();
  }

  // ── 核心转换 ──
  function doConvert() {
    const input = el.inputEditor.value;
    el.inputInfo.textContent = `${input.length} 字符`;

    if (!input.trim()) {
      el.outputEditor.innerHTML = '<div class="placeholder">结果将显示在这里…</div>';
      el.outputInfo.textContent = '0 字符';
      return;
    }

    try {
      if (mode === 'encode') {
        const result = encodeURIComponent(input);
        showTextOutput(result);
      } else if (mode === 'decode') {
        const result = decodeURIComponent(input);
        showTextOutput(result);
      } else {
        showQueryTable(input.trim());
      }
    } catch (err) {
      el.outputEditor.innerHTML = `<div class="placeholder" style="color: var(--color-danger);">处理失败: ${escapeHtml(err.message)}</div>`;
      el.outputInfo.textContent = '-';
    }
  }

  function showTextOutput(text) {
    el.outputEditor.className = 'editor-body editor-output';
    el.outputEditor.textContent = text;
    el.outputInfo.textContent = `${text.length} 字符`;
  }

  function showQueryTable(url) {
    let search = '';
    try {
      const u = new URL(url);
      search = u.search;
    } catch {
      // 不是完整 URL，尝试当作纯 query string
      search = url.startsWith('?') ? url : '?' + url;
    }

    const params = new URLSearchParams(search);
    const entries = Array.from(params.entries());

    if (entries.length === 0) {
      el.outputEditor.innerHTML = '<div class="placeholder">未找到 QueryString 参数</div>';
      el.outputInfo.textContent = '0 个参数';
      return;
    }

    let html = '<div class="url-query-table-wrapper"><table class="url-query-table">';
    html += '<thead><tr><th>键</th><th>值</th></tr></thead><tbody>';
    entries.forEach(([key, value]) => {
      html += `<tr><td><code>${escapeHtml(key)}</code></td><td>${escapeHtml(value)}</td></tr>`;
    });
    html += '</tbody></table></div>';

    el.outputEditor.className = 'editor-body editor-output';
    el.outputEditor.innerHTML = html;
    el.outputInfo.textContent = `${entries.length} 个参数`;
  }

  // ── 操作 ──
  function doCopy() {
    const text = el.outputEditor.textContent;
    if (!text || el.outputEditor.querySelector('.placeholder')) {
      showToast('没有可复制的内容', 'warning');
      return;
    }
    copyToClipboard(text).then(ok => {
      showToast(ok ? '复制成功' : '复制失败', ok ? 'success' : 'error');
    });
  }

  function doCopyInput() {
    const text = el.inputEditor.value;
    if (!text) { showToast('没有可复制的内容', 'warning'); return; }
    copyToClipboard(text).then(ok => showToast(ok ? '已复制' : '复制失败', ok ? 'success' : 'error'));
  }

  function doSwap() {
    const output = el.outputEditor.textContent;
    if (!output || el.outputEditor.querySelector('.placeholder')) return;

    // 编码↔解码互换；QueryString 模式不支持互换
    if (mode === 'query') {
      showToast('QueryString 解析模式不支持互换', 'warning');
      return;
    }

    setMode(mode === 'encode' ? 'decode' : 'encode');
    el.inputEditor.value = output;
    el.inputInfo.textContent = `${output.length} 字符`;
    doConvert();
    showToast('已互换', 'success');
  }

  function doClear() {
    el.inputEditor.value = '';
    el.outputEditor.innerHTML = '<div class="placeholder">结果将显示在这里…</div>';
    el.outputEditor.className = 'editor-body editor-output';
    el.inputInfo.textContent = '0 字符';
    el.outputInfo.textContent = '0 字符';
    showToast('已清空', 'success');
  }

  // ── 动作映射 ──
  const ACTIONS = {
    'copy': doCopy,
    'copy-input': doCopyInput,
    'swap': doSwap,
    'clear': doClear
  };

  init();

})();
