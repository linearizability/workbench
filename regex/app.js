/**
 * 正则测试 - 核心逻辑
 */

(function() {
  'use strict';

  const el = {};
  let currentRegex = null;

  const PRESETS = {
    email:     { pattern: '[\\w.-]+@[\\w.-]+\\.\\w+', flags: '' },
    'phone-cn':{ pattern: '1[3-9]\\d{9}', flags: '' },
    ipv4:      { pattern: '(?:(?:25[0-5]|2[0-4]\\d|1?\\d{1,2})\\.){3}(?:25[0-5]|2[0-4]\\d|1?\\d{1,2})', flags: '' },
    url:       { pattern: 'https?://[^\\s/$.?#].[^\\s]*', flags: 'i' },
    idcard:    { pattern: '\\d{6}(?:18|19|20)\\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\\d|3[01])\\d{3}[\\dXx]', flags: '' },
    'date-iso':{ pattern: '\\d{4}-\\d{2}-\\d{2}', flags: '' },
    'hex-color':{ pattern: '#(?:[\\da-fA-F]{3}){1,2}', flags: '' },
    digits:    { pattern: '\\d+', flags: '' }
  };

  const SAMPLE_TEXT = `联系邮箱：alice@example.com，backup@test.org
手机号：13800138000、13912345678
网址：https://github.com/zhangsan 和 http://example.com/path?a=1
IP 地址：192.168.1.1、10.0.0.1
颜色：#3b82f6、#fff
日期：2026-05-01、2026-12-31`;

  function init() {
    cacheElements();
    bindEvents();
  }

  function cacheElements() {
    el.pattern = document.getElementById('regex-pattern');
    el.text    = document.getElementById('regex-text');
    el.preset  = document.getElementById('regex-preset');
    el.result  = document.getElementById('regex-result');
    el.status  = document.getElementById('regex-status');
    el.flags   = document.querySelectorAll('[data-flag]');
  }

  function bindEvents() {
    el.pattern.addEventListener('input', debounce(doMatch, 150));
    el.text.addEventListener('input', debounce(doMatch, 150));

    el.flags.forEach(cb => {
      cb.addEventListener('change', doMatch);
    });

    el.preset.addEventListener('change', () => {
      const key = el.preset.value;
      if (PRESETS[key]) {
        el.pattern.value = PRESETS[key].pattern;
        const flags = PRESETS[key].flags;
        el.flags.forEach(cb => {
          cb.checked = flags.includes(cb.dataset.flag);
        });
        doMatch();
      }
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const handler = ACTIONS[btn.dataset.action];
      if (handler) handler();
    });
  }

  // ── 匹配 ──
  function doMatch() {
    const pattern = el.pattern.value;
    const text = el.text.value;

    if (!pattern || !text) {
      resetResult();
      return;
    }

    const flags = getFlags();
    let regex;
    try {
      regex = new RegExp(pattern, flags);
    } catch (err) {
      el.status.textContent = '语法错误';
      el.status.style.color = 'var(--color-danger)';
      el.result.innerHTML = `<div class="regex-error">${escapeHtml(err.message)}</div>`;
      return;
    }

    currentRegex = regex;
    const matches = execAll(regex, text);

    if (!matches.length) {
      el.status.textContent = '无匹配';
      el.status.style.color = 'var(--color-text-muted)';
      el.result.innerHTML = `<div class="regex-no-match">未找到匹配项</div><pre class="regex-plain-text">${escapeHtml(text)}</pre>`;
      return;
    }

    el.status.textContent = matches.length + ' 处匹配';
    el.status.style.color = 'var(--color-success)';
    renderResult(text, matches);
  }

  function getFlags() {
    return Array.from(el.flags)
      .filter(cb => cb.checked)
      .map(cb => cb.dataset.flag)
      .join('');
  }

  function execAll(regex, text) {
    const matches = [];
    const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
    let m;
    while ((m = re.exec(text)) !== null) {
      matches.push({ index: m.index, text: m[0], groups: m.slice(1) });
      if (m[0].length === 0) re.lastIndex++;
    }
    return matches;
  }

  function renderResult(text, matches) {
    let html = '';

    // 高亮文本
    html += '<div class="regex-highlight">';
    let last = 0;
    matches.forEach((mat, idx) => {
      html += escapeHtml(text.slice(last, mat.index));
      html += `<mark class="regex-match" title="Match ${idx + 1} at ${mat.index}">${escapeHtml(mat.text)}</mark>`;
      last = mat.index + mat.text.length;
    });
    html += escapeHtml(text.slice(last));
    html += '</div>';

    // 匹配详情
    html += '<div class="regex-details">';
    html += '<div class="regex-details-title">匹配详情</div>';
    html += '<div class="regex-match-items">';
    matches.forEach((mat, idx) => {
      html += `<div class="regex-match-item">
        <div class="regex-match-header">
          <span class="regex-match-num">#${idx + 1}</span>
          <span class="regex-match-pos">位置 ${mat.index}</span>
          <code class="regex-match-text">${escapeHtml(mat.text)}</code>
        </div>`;
      if (mat.groups.some(g => g !== undefined)) {
        html += '<div class="regex-groups">';
        mat.groups.forEach((g, gidx) => {
          html += `<div class="regex-group"><span class="regex-group-label">Group ${gidx + 1}</span><code>${escapeHtml(g === undefined ? 'undefined' : g)}</code></div>`;
        });
        html += '</div>';
      }
      html += '</div>';
    });
    html += '</div></div>';

    el.result.innerHTML = html;
  }

  function resetResult() {
    el.status.textContent = '0 处匹配';
    el.status.style.color = '';
    el.result.innerHTML = '<div class="placeholder">输入正则和测试文本查看结果…</div>';
  }

  // ── 操作 ──
  function doSample() {
    el.pattern.value = '\\w+@[\\w.-]+\\.\\w+';
    el.flags.forEach(cb => { cb.checked = cb.dataset.flag === 'g'; });
    el.text.value = SAMPLE_TEXT;
    doMatch();
    showToast('已填入示例', 'success');
  }

  function doClear() {
    el.pattern.value = '';
    el.text.value = '';
    el.preset.value = '';
    el.flags.forEach(cb => { cb.checked = cb.dataset.flag === 'g'; });
    resetResult();
    showToast('已清空', 'success');
  }

  function doCopyRegex() {
    const pattern = el.pattern.value;
    if (!pattern) { showToast('没有可复制的内容', 'warning'); return; }
    const flags = getFlags();
    const text = '/' + pattern + '/' + flags;
    copyToClipboard(text).then(ok => showToast(ok ? '正则已复制' : '复制失败', ok ? 'success' : 'error'));
  }

  const ACTIONS = {
    sample: doSample,
    clear: doClear,
    'copy-regex': doCopyRegex
  };

  init();

})();
