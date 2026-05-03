/**
 * JWT 解码工具 - 核心逻辑
 */

(function() {
  'use strict';

  // ── DOM ──
  const el = {};

  // ── 初始化 ──
  function init() {
    cacheElements();
    bindEvents();
  }

  function cacheElements() {
    el.jwtInput   = document.getElementById('jwt-input');
    el.jwtResult  = document.getElementById('jwt-result');
    el.jwtStatus  = document.getElementById('jwt-status');
  }

  function bindEvents() {
    el.jwtInput.addEventListener('input', debounce(doDecode, 200));

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const handler = ACTIONS[btn.dataset.action];
      if (handler) handler();
    });
  }

  // ── 解码 ──
  function doDecode() {
    const token = el.jwtInput.value.trim();
    if (!token) {
      resetResult();
      return;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      el.jwtStatus.textContent = '格式错误';
      el.jwtStatus.style.color = 'var(--color-danger)';
      el.jwtResult.innerHTML = '<div class="placeholder" style="color: var(--color-danger);">JWT Token 必须由 Header.Payload.Signature 三部分组成</div>';
      return;
    }

    let header, payload;
    try {
      header  = safeJsonParse(base64UrlDecode(parts[0]));
      payload = safeJsonParse(base64UrlDecode(parts[1]));
    } catch (err) {
      el.jwtStatus.textContent = '解码失败';
      el.jwtStatus.style.color = 'var(--color-danger)';
      el.jwtResult.innerHTML = `<div class="placeholder" style="color: var(--color-danger);">解码失败: ${escapeHtml(err.message)}</div>`;
      return;
    }

    el.jwtStatus.textContent = '有效';
    el.jwtStatus.style.color = 'var(--color-success)';
    renderResult(header, payload, parts[2]);
  }

  function renderResult(header, payload, signatureB64) {
    const sigShort = signatureB64.substring(0, 16) + '…';

    // 过期时间
    const expInfo = formatClaimTime(payload, 'exp', '过期');
    const iatInfo = formatClaimTime(payload, 'iat', '签发');
    const nbfInfo = formatClaimTime(payload, 'nbf', '生效');

    let html = '<div class="jwt-sections">';

    // Header
    html += `<div class="jwt-section">
      <div class="jwt-section-title">Header (头部)</div>
      <div class="jwt-section-tags">${formatTags(header)}</div>
      <pre class="jwt-json">${escapeHtml(JSON.stringify(header, null, 2))}</pre>
      <button class="btn btn-sm btn-secondary" data-action="copy-header">复制 Header</button>
    </div>`;

    // Payload
    html += `<div class="jwt-section">
      <div class="jwt-section-title">Payload (载荷)</div>
      <div class="jwt-section-tags">${formatTags(payload)}</div>
      <pre class="jwt-json">${escapeHtml(JSON.stringify(payload, null, 2))}</pre>
      <button class="btn btn-sm btn-secondary" data-action="copy-payload">复制 Payload</button>
    </div>`;

    // Signature
    html += `<div class="jwt-section">
      <div class="jwt-section-title">Signature (签名)</div>
      <div class="jwt-sig">${escapeHtml(sigShort)}</div>
    </div>`;

    // 时间信息
    html += '<div class="jwt-times">';
    if (iatInfo) html += `<div class="jwt-time ${iatInfo.cls}"><span class="jwt-time-label">${iatInfo.label}</span><span class="jwt-time-val">${iatInfo.val}</span><span class="jwt-time-rel">${iatInfo.rel}</span></div>`;
    if (expInfo) html += `<div class="jwt-time ${expInfo.cls}"><span class="jwt-time-label">${expInfo.label}</span><span class="jwt-time-val">${expInfo.val}</span><span class="jwt-time-rel">${expInfo.rel}</span></div>`;
    if (nbfInfo) html += `<div class="jwt-time ${nbfInfo.cls}"><span class="jwt-time-label">${nbfInfo.label}</span><span class="jwt-time-val">${nbfInfo.val}</span><span class="jwt-time-rel">${nbfInfo.rel}</span></div>`;
    html += '</div>';

    html += '</div>';

    el.jwtResult.innerHTML = html;
    el.jwtResult.className = 'editor-body editor-output';
  }

  function formatTags(obj) {
    const tags = [];
    if (obj.alg) tags.push(`算法: ${obj.alg}`);
    if (obj.typ) tags.push(`类型: ${obj.typ}`);
    if (obj.iss) tags.push(`签发者: ${obj.iss}`);
    if (obj.aud) tags.push(`受众: ${Array.isArray(obj.aud) ? obj.aud.join(', ') : obj.aud}`);
    if (obj.sub) tags.push(`主题: ${obj.sub}`);
    if (!tags.length) return '';
    return tags.map(t => `<span class="jwt-tag">${escapeHtml(t)}</span>`).join('');
  }

  function formatClaimTime(payload, key, label) {
    const val = payload[key];
    if (typeof val !== 'number') return null;
    const date = new Date(val * 1000);
    const now = Date.now();
    const diff = date.getTime() - now;
    const abs = Math.abs(diff);
    let rel = '';
    let cls = '';

    if (diff > 0) {
      rel = relativeFuture(abs);
      cls = key === 'exp' ? 'is-future' : '';
    } else {
      rel = relativePast(abs);
      cls = key === 'exp' ? 'is-past' : '';
    }

    return {
      label: label,
      val: formatDate(date, 'YYYY-MM-DD HH:mm:ss'),
      rel: rel,
      cls: cls
    };
  }

  function relativeFuture(ms) {
    if (ms < 60 * 1000) return '即将';
    if (ms < 60 * 60 * 1000) return Math.floor(ms / 60000) + ' 分钟后';
    if (ms < 24 * 60 * 60 * 1000) return Math.floor(ms / 3600000) + ' 小时后';
    if (ms < 30 * 24 * 60 * 60 * 1000) return Math.floor(ms / 86400000) + ' 天后';
    return Math.floor(ms / (30 * 86400000)) + ' 个月后';
  }

  function relativePast(ms) {
    if (ms < 60 * 1000) return '刚刚';
    if (ms < 60 * 60 * 1000) return Math.floor(ms / 60000) + ' 分钟前';
    if (ms < 24 * 60 * 60 * 1000) return Math.floor(ms / 3600000) + ' 小时前';
    if (ms < 30 * 24 * 60 * 60 * 1000) return Math.floor(ms / 86400000) + ' 天前';
    return Math.floor(ms / (30 * 86400000)) + ' 个月前';
  }

  // ── 辅助 ──
  function base64UrlDecode(str) {
    let input = str.replace(/-/g, '+').replace(/_/g, '/');
    const pad = input.length % 4;
    if (pad === 2) input += '==';
    else if (pad === 3) input += '=';
    return atob(input);
  }

  function safeJsonParse(str) {
    try { return JSON.parse(str); }
    catch { return { _raw: str }; }
  }

  function resetResult() {
    el.jwtStatus.textContent = '等待输入';
    el.jwtStatus.style.color = '';
    el.jwtResult.innerHTML = '<div class="placeholder">粘贴 Token 以查看解析结果…</div>';
    el.jwtResult.className = 'editor-body editor-output';
  }

  // ── 操作 ──
  function doCopyInput() {
    const text = el.jwtInput.value;
    if (!text) { showToast('没有可复制的内容', 'warning'); return; }
    copyToClipboard(text).then(ok => showToast(ok ? '已复制' : '复制失败', ok ? 'success' : 'error'));
  }

  function doCopyHeader() {
    const pre = el.jwtResult.querySelector('.jwt-section:nth-child(1) pre');
    if (pre) copyToClipboard(pre.textContent).then(ok => showToast(ok ? 'Header 已复制' : '复制失败', ok ? 'success' : 'error'));
  }

  function doCopyPayload() {
    const pre = el.jwtResult.querySelector('.jwt-section:nth-child(2) pre');
    if (pre) copyToClipboard(pre.textContent).then(ok => showToast(ok ? 'Payload 已复制' : '复制失败', ok ? 'success' : 'error'));
  }

  function doClear() {
    el.jwtInput.value = '';
    resetResult();
    showToast('已清空', 'success');
  }

  function doSample() {
    // 生成一个示例 JWT (HS256, payload 包含 exp/iat)
    const header  = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const now = Math.floor(Date.now() / 1000);
    const payload = btoa(JSON.stringify({
      sub: '1234567890',
      name: '张三',
      iat: now,
      exp: now + 3600,
      iss: 'workbench'
    }));
    const token = `${header}.${payload}.fake-signature-for-demo`;
    el.jwtInput.value = token;
    doDecode();
    showToast('已填入示例 Token', 'success');
  }

  // ── 动作映射 ──
  const ACTIONS = {
    'copy-input': doCopyInput,
    'copy-header': doCopyHeader,
    'copy-payload': doCopyPayload,
    'clear': doClear,
    'sample': doSample
  };

  init();

})();
