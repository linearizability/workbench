/**
 * Base64 编解码工具 - 核心逻辑
 */

(function() {
  'use strict';

  // ── 状态 ──
  let mode = 'encode';
  let lastFileMime = '';
  let lastFileName = '';
  let outputType = 'text'; // 'text' | 'image'

  // ── DOM ──
  const el = {};

  // ── 初始化 ──
  function init() {
    cacheElements();
    bindEvents();
  }

  function cacheElements() {
    el.inputEditor    = document.getElementById('input-editor');
    el.outputEditor   = document.getElementById('output-editor');
    el.inputLabel     = document.getElementById('input-label');
    el.outputLabel    = document.getElementById('output-label');
    el.inputInfo      = document.getElementById('input-info');
    el.outputInfo     = document.getElementById('output-info');
    el.urlSafe        = document.getElementById('url-safe');
    el.inputDropZone  = document.getElementById('input-drop-zone');
    el.dropOverlay    = document.getElementById('drop-overlay');
    el.fileInput      = document.getElementById('file-input');
    el.btnCopyDataUri = document.getElementById('btn-copy-datauri');
    el.btnDownload    = document.getElementById('btn-download');
  }

  function bindEvents() {
    // 模式切换
    document.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });

    // 事件委托
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const handler = ACTIONS[btn.dataset.action];
      if (handler) handler();
    });

    // 实时转换
    el.inputEditor.addEventListener('input', debounce(doConvert, 200));

    // Tab 键
    el.inputEditor.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const s = el.inputEditor.selectionStart;
        const end = el.inputEditor.selectionEnd;
        const val = el.inputEditor.value;
        el.inputEditor.value = val.substring(0, s) + '  ' + val.substring(end);
        el.inputEditor.selectionStart = el.inputEditor.selectionEnd = s + 2;
      }
    });

    // URL Safe
    el.urlSafe.addEventListener('change', doConvert);

    // 拖拽文件
    setupFileDropzone(el.inputDropZone, handleFileDrop);
    el.fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) handleFileDrop(file);
      e.target.value = '';
    });
  }

  // ── 模式切换 ──
  function setMode(newMode) {
    mode = newMode;
    document.querySelectorAll('[data-mode]').forEach(btn => {
      const active = btn.dataset.mode === newMode;
      btn.classList.toggle('btn-primary', active);
      btn.classList.toggle('btn-secondary', !active);
    });
    el.inputLabel.textContent  = mode === 'encode' ? '输入文本' : '输入 Base64';
    el.outputLabel.textContent = mode === 'encode' ? 'Base64 结果' : '解码结果';
    el.inputEditor.placeholder = mode === 'encode'
      ? '输入文本，也可拖拽文件到此处…'
      : '粘贴 Base64 字符串，也可拖拽文件到此处…';
    doConvert();
  }

  // ── 核心转换 ──
  function doConvert() {
    const input = el.inputEditor.value;
    el.inputInfo.textContent = `${input.length} 字符`;

    if (!input.trim()) {
      resetOutput();
      return;
    }

    try {
      if (mode === 'encode') {
        const result = base64Encode(input);
        showTextOutput(result);
      } else {
        const trimmed = input.trim();
        const imageMime = guessImageMime(trimmed);
        if (imageMime) {
          const raw = trimmed.replace(/^data:image\/[a-z+.-]+;base64,/i, '');
          const dataUri = trimmed.startsWith('data:') ? trimmed : `data:${imageMime};base64,${raw}`;
          showImageOutput(dataUri);
        } else {
          showTextOutput(base64Decode(trimmed));
        }
      }
    } catch (err) {
      el.outputEditor.innerHTML = `<div class="placeholder" style="color: var(--color-danger);">转换失败: ${escapeHtml(err.message)}</div>`;
      el.outputInfo.textContent = '-';
      setOutputButtons('text');
    }
  }

  function showTextOutput(text) {
    outputType = 'text';
    el.outputEditor.className = 'editor-body editor-output';
    el.outputEditor.textContent = text;
    el.outputInfo.textContent = `${text.length} 字符`;
    setOutputButtons('text');
  }

  function showImageOutput(dataUri) {
    outputType = 'image';
    lastFileMime = (dataUri.match(/^data:(image\/[a-z+.-]+);/i) || [])[1] || 'image/png';
    lastFileName = 'decoded-image.' + (lastFileMime.split('/')[1] || 'png').replace('+xml', '');

    const img = document.createElement('img');
    img.src = dataUri;
    img.alt = 'Base64 图片预览';
    img.className = 'b64-output-image';
    img.onload = () => {
      el.outputInfo.textContent = `${img.naturalWidth} × ${img.naturalHeight}`;
    };
    img.onerror = () => {
      // 降级为文本
      showTextOutput(base64Decode(el.inputEditor.value.trim()));
    };
    el.outputEditor.innerHTML = '';
    el.outputEditor.className = 'editor-body editor-output b64-output-image-wrapper';
    el.outputEditor.appendChild(img);
    setOutputButtons('image');
  }

  function resetOutput() {
    el.outputEditor.className = 'editor-body editor-output';
    el.outputEditor.innerHTML = '<div class="placeholder">结果将显示在这里…</div>';
    el.outputInfo.textContent = '0 字符';
    setOutputButtons('text');
    outputType = 'text';
  }

  // ── 输出区按钮状态 ──
  function setOutputButtons(type) {
    if (type === 'image') {
      el.btnCopyDataUri.classList.remove('u-hidden');
      el.btnDownload.classList.remove('u-hidden');
    } else {
      el.btnCopyDataUri.classList.add('u-hidden');
      el.btnDownload.classList.add('u-hidden');
    }
  }

  // ── 编解码算法 ──
  function base64Encode(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    let encoded = btoa(binary);
    if (el.urlSafe.checked) {
      encoded = encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    return encoded;
  }

  function base64Decode(str) {
    let input = str.trim();
    if (el.urlSafe.checked) {
      input = input.replace(/-/g, '+').replace(/_/g, '/');
      const pad = input.length % 4;
      if (pad === 2) input += '==';
      else if (pad === 3) input += '=';
    }
    const binary = atob(input);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  // ── 文件处理（统一入口）──
  function handleFileDrop(file) {
    if (file.size > 10 * 1024 * 1024) {
      showToast('文件过大，请选择 10MB 以内的文件', 'warning');
      return;
    }

    lastFileName = file.name;
    lastFileMime = file.type || 'application/octet-stream';

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUri = e.target.result;
      const base64 = dataUri.split(',')[1] || '';

      if (mode === 'encode') {
        // 编码模式：文件 → Base64 输出
        el.inputEditor.value = '';
        el.inputInfo.textContent = `${file.name} (${formatFileSize(file.size)})`;
        showTextOutput(base64);
      } else {
        // 解码模式：文件内容填入输入区（当作 Base64 字符串解码）
        el.inputEditor.value = base64;
        doConvert();
      }
      showToast(`已导入文件：${file.name}`, 'success');
    };
    reader.onerror = () => showToast('文件读取失败', 'error');
    reader.readAsDataURL(file);
  }

  // ── 操作 ──
  function doCopy() {
    if (outputType === 'image') {
      const img = el.outputEditor.querySelector('.b64-output-image');
      if (img && img.src) {
        copyToClipboard(img.src).then(ok => {
          showToast(ok ? '已复制 Data URI' : '复制失败', ok ? 'success' : 'error');
        });
        return;
      }
    }
    const text = el.outputEditor.textContent;
    if (!text || el.outputEditor.querySelector('.placeholder')) {
      showToast('没有可复制的内容', 'warning');
      return;
    }
    copyToClipboard(text).then(ok => {
      showToast(ok ? '复制成功' : '复制失败', ok ? 'success' : 'error');
    });
  }

  function doCopyDataUri() {
    const img = el.outputEditor.querySelector('.b64-output-image');
    if (img && img.src) {
      copyToClipboard(img.src).then(ok => {
        showToast(ok ? 'Data URI 已复制' : '复制失败', ok ? 'success' : 'error');
      });
    }
  }

  function doDownload() {
    const img = el.outputEditor.querySelector('.b64-output-image');
    if (!img || !img.src) {
      showToast('没有可下载的内容', 'warning');
      return;
    }
    const dataUri = img.src;
    const link = document.createElement('a');
    link.href = dataUri;
    link.download = lastFileName || 'decoded-image.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('下载已开始', 'success');
  }

  function doSwap() {
    let output;
    if (outputType === 'image') {
      const img = el.outputEditor.querySelector('.b64-output-image');
      output = img && img.src ? img.src.replace(/^data:image\/[a-z+.-]+;base64,/i, '') : '';
    } else {
      output = el.outputEditor.textContent;
    }
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
    lastFileMime = '';
    lastFileName = '';
    showToast('已清空', 'success');
  }

  // ── 图片检测 ──
  function guessImageMime(base64) {
    const m = base64.match(/^data:(image\/[a-z+.-]+);base64,/i);
    if (m) return m[1];
    if (base64.startsWith('/9j/')) return 'image/jpeg';
    if (base64.startsWith('iVBOR')) return 'image/png';
    if (base64.startsWith('R0lGOD')) return 'image/gif';
    if (base64.startsWith('UklGR')) return 'image/webp';
    if (base64.startsWith('PHN2Zy')) return 'image/svg+xml';
    return null;
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  // ── 动作映射 ──
  const ACTIONS = {
    'convert': doConvert,
    'copy': doCopy,
    'copy-data-uri': doCopyDataUri,
    'download': doDownload,
    'swap': doSwap,
    'clear': doClear,
    'select-file': () => el.fileInput.click()
  };

  init();

})();
