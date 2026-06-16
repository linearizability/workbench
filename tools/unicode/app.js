/**
 * Unicode 编解码工具 - UI 层
 */

(function() {
  'use strict';

  function escapeAttr(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  let mode = 'encode';
  let format = '\\uXXXX';

  const el = {};

  function init() {
    cacheElements();
    bindEvents();
  }

  function cacheElements() {
    el.inputEditor   = document.getElementById('input-editor');
    el.outputEditor  = document.getElementById('output-editor');
    el.inputLabel    = document.getElementById('input-label');
    el.outputLabel   = document.getElementById('output-label');
    el.inputInfo     = document.getElementById('input-info');
    el.outputInfo    = document.getElementById('output-info');
    el.formatSelect  = document.getElementById('format-select');
    el.infoGrid      = document.getElementById('info-grid');
    el.charDetail     = document.getElementById('char-detail');
    el.inputDropZone = document.getElementById('input-drop-zone');
    el.dropOverlay   = document.getElementById('drop-overlay');
    el.fileInput     = document.getElementById('file-input');
  }

  function bindEvents() {
    document.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const handler = ACTIONS[btn.dataset.action];
      if (handler) handler();
    });

    el.inputEditor.addEventListener('input', debounce(doConvert, 150));
    el.formatSelect.addEventListener('change', () => {
      format = el.formatSelect.value;
      doConvert();
    });

    el.infoGrid.addEventListener('click', handleInfoCardClick);

    el.inputEditor.addEventListener('click', handleInputClick);

    setupFileDropzone(el.inputDropZone, handleFileDrop);
    el.fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) handleFileDrop(file);
      e.target.value = '';
    });
  }

  function setMode(newMode) {
    mode = newMode;
    document.querySelectorAll('[data-mode]').forEach(btn => {
      const active = btn.dataset.mode === newMode;
      btn.classList.toggle('btn-primary', active);
      btn.classList.toggle('btn-secondary', !active);
    });
    el.inputLabel.textContent  = mode === 'encode' ? '输入文本' : '输入 Unicode 编码';
    el.outputLabel.textContent = mode === 'encode' ? '编码结果' : '解码结果';
    el.inputEditor.placeholder = mode === 'encode'
      ? '输入中文或特殊字符，如：你好世界'
      : '输入 Unicode 编码，如：\\u4F60\\u597D';
    el.formatSelect.parentElement.style.display = mode === 'encode' ? '' : 'none';
    doConvert();
  }

  function doConvert() {
    const input = el.inputEditor.value;
    el.inputInfo.textContent = `${input.length} 字符`;

    if (!input.trim()) {
      resetOutput();
      el.infoGrid.innerHTML = '';
      el.charDetail.classList.add('u-hidden');
      return;
    }

    try {
      let result;
      if (mode === 'encode') {
        result = unicodeEncode(input, format);
      } else {
        result = unicodeDecode(input);
      }
      showTextOutput(result);

      if (mode === 'encode') {
        showCharInfo(input);
      } else {
        el.infoGrid.innerHTML = '';
        el.charDetail.classList.add('u-hidden');
      }
    } catch (err) {
      el.outputEditor.innerHTML = `<div class="placeholder" style="color: var(--color-danger);">转换失败: ${escapeHtml(err.message)}</div>`;
      el.outputInfo.textContent = '-';
      el.infoGrid.innerHTML = '';
      el.charDetail.classList.add('u-hidden');
    }
  }

  function unicodeEncode(text, fmt) {
    if (!text) return '';
    let result = '';
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code > 127) {
        if (code >= 0xD800 && code <= 0xDBFF) {
          const cp = text.codePointAt(i);
          result += fmt === 'u+' ? 'U+' + cp.toString(16).toUpperCase().padStart(4, '0')
                   : fmt === '0x' ? '0x' + cp.toString(16).toUpperCase().padStart(4, '0')
                   : fmt === '&#x;' ? '&#x' + cp.toString(16).toUpperCase() + ';'
                   : fmt === '%u'  ? '%u' + cp.toString(16).toUpperCase().padStart(4, '0')
                   : '\\u{' + cp.toString(16).toUpperCase() + '}';
          i++;
        } else {
          const hex = code.toString(16).toUpperCase().padStart(4, '0');
          result += fmt === 'u+' ? 'U+' + hex
                   : fmt === '0x' ? '0x' + hex
                   : fmt === '&#x;' ? '&#x' + hex + ';'
                   : fmt === '%u'  ? '%u' + hex
                   : '\\u' + hex;
        }
      } else {
        result += text[i];
      }
    }
    return result;
  }

  function unicodeDecode(text) {
    if (!text) return '';
    let result = text;

    result = result.replace(/\\u\{([0-9A-Fa-f]{1,6})\}/g, (_, hex) => {
      return String.fromCodePoint(parseInt(hex, 16));
    });

    result = result.replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });

    result = result.replace(/&#x([0-9A-Fa-f]{1,6});/gi, (_, hex) => {
      return String.fromCodePoint(parseInt(hex, 16));
    });

    result = result.replace(/%u([0-9A-Fa-f]{4})/gi, (_, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });

    result = result.replace(/U\+([0-9A-Fa-f]{4,6})/gi, (_, hex) => {
      return String.fromCodePoint(parseInt(hex, 16));
    });

    result = result.replace(/0x([0-9A-Fa-f]{4,6})/gi, (match, hex, offset) => {
      if (offset > 0 && /[a-zA-Z0-9]/.test(text[offset - 1])) return match;
      return String.fromCodePoint(parseInt(hex, 16));
    });

    return result;
  }

  function showCharInfo(text) {
    const chars = [...new Set([...text].filter(c => c.charCodeAt(0) > 127))];
    if (chars.length === 0) {
      el.infoGrid.innerHTML = '<div class="unicode-info-card"><div class="unicode-info-card-label">提示</div><div class="unicode-info-card-value">未检测到非 ASCII 字符</div></div>';
      el.charDetail.classList.add('u-hidden');
      return;
    }

    let html = '';
    let isFirst = true;
    for (const ch of chars.slice(0, 20)) {
      const cp = ch.codePointAt(0);
      const hex = cp.toString(16).toUpperCase().padStart(4, '0');
      const activeClass = isFirst ? ' is-active' : '';
      html += `<div class="unicode-info-card${activeClass}" data-char="${escapeAttr(ch)}">
        <div class="unicode-info-card-label">${escapeHtml(ch)}</div>
        <div class="unicode-info-card-value">\\u${hex} · U+${hex} · &#x${hex}; · ${cp}</div>
      </div>`;
      isFirst = false;
    }
    if (chars.length > 20) {
      html += `<div class="unicode-info-card"><div class="unicode-info-card-label">…</div><div class="unicode-info-card-value">还有 ${chars.length - 20} 个字符</div></div>`;
    }
    el.infoGrid.innerHTML = html;

    const first = chars[0];
    const cp = first.codePointAt(0);
    updateCharDetail(first, cp);
  }

  function updateCharDetail(ch, cp) {
    const hex = cp.toString(16).toUpperCase().padStart(Math.max(4, cp.toString(16).length), '0');
    el.charDetail.classList.remove('u-hidden');
    const preview = el.charDetail.querySelector('.unicode-char-preview');
    const info = el.charDetail.querySelector('.unicode-char-detail-info');
    if (preview) preview.textContent = ch;
    if (info) {
      info.innerHTML = `
        <div>字符：<strong>${escapeHtml(ch)}</strong></div>
        <div>Unicode：<strong>U+${hex}</strong></div>
        <div>十进制：<strong>${cp}</strong></div>
        <div>UTF-8：<strong>${escapeHtml(utf8Hex(ch))}</strong></div>
        <div>HTML 实体：<strong>${escapeHtml('&#' + cp + ';')}</strong></div>
        <div>HTML 十六进制：<strong>${escapeHtml('&#x' + hex + ';')}</strong></div>
      `;
    }
  }

  function utf8Hex(ch) {
    const bytes = new TextEncoder().encode(ch);
    return Array.from(bytes).map(b => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
  }

  function handleInfoCardClick(e) {
    const card = e.target.closest('.unicode-info-card[data-char]');
    if (!card) return;
    const ch = card.dataset.char;
    if (!ch) return;
    el.infoGrid.querySelectorAll('.unicode-info-card').forEach(c => c.classList.remove('is-active'));
    card.classList.add('is-active');
    const cp = ch.codePointAt(0);
    updateCharDetail(ch, cp);
  }

  function handleInputClick() {
    if (mode !== 'encode') return;
    const text = el.inputEditor.value;
    const start = el.inputEditor.selectionStart;
    if (start >= text.length) return;
    const ch = [...text][[...text].findIndex((_, i) => {
      let pos = 0;
      for (let j = 0; j < i; j++) pos += [...text][j].length;
      return pos >= start;
    })];
    if (ch && ch.charCodeAt(0) > 127) {
      const cp = ch.codePointAt(0);
      updateCharDetail(ch, cp);
      el.infoGrid.querySelectorAll('.unicode-info-card').forEach(c => {
        c.classList.toggle('is-active', c.dataset.char === ch);
      });
    }
  }

  function showTextOutput(text) {
    el.outputEditor.className = 'editor-body editor-output';
    el.outputEditor.textContent = text;
    el.outputInfo.textContent = `${text.length} 字符`;
  }

  function resetOutput() {
    el.outputEditor.className = 'editor-body editor-output';
    el.outputEditor.innerHTML = '<div class="placeholder">结果将显示在这里…</div>';
    el.outputInfo.textContent = '0 字符';
  }

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

  function doSwap() {
    const output = el.outputEditor.textContent;
    if (!output || el.outputEditor.querySelector('.placeholder')) return;
    setMode(mode === 'encode' ? 'decode' : 'encode');
    el.inputEditor.value = output;
    el.inputInfo.textContent = `${output.length} 字符`;
    doConvert();
    showToast('已互换', 'success');
  }

  function doClear() {
    el.inputEditor.value = '';
    el.inputInfo.textContent = '0 字符';
    resetOutput();
    el.infoGrid.innerHTML = '';
    el.charDetail.classList.add('u-hidden');
    showToast('已清空', 'success');
  }

  function handleFileDrop(file) {
    if (file.size > 5 * 1024 * 1024) {
      showToast('文件过大，请选择 5MB 以内的文本文件', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      el.inputEditor.value = text;
      el.inputInfo.textContent = `${file.name} (${text.length} 字符)`;
      doConvert();
      showToast(`已导入文件：${file.name}`, 'success');
    };
    reader.onerror = () => showToast('文件读取失败', 'error');
    reader.readAsText(file);
  }

  const ACTIONS = {
    'copy': doCopy,
    'swap': doSwap,
    'clear': doClear,
    'select-file': () => el.fileInput.click()
  };

  init();
})();