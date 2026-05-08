/**
 * SVG 编辑器 - 核心逻辑
 */

(function() {
  'use strict';

  const elements = {};
  const state = {
    svgText: '',
    lastError: ''
  };

  function init() {
    cacheElements();
    bindEvents();
    updateInputInfo();
    renderPreviewDebounced();
  }

  function cacheElements() {
    elements.fileInput = document.getElementById('file-input');
    elements.inputEditor = document.getElementById('input-editor');
    elements.inputInfo = document.getElementById('input-info');
    elements.previewBg = document.getElementById('preview-bg');
    elements.previewFrame = document.getElementById('preview-frame');
    elements.previewPlaceholder = document.getElementById('preview-placeholder');
    elements.status = document.getElementById('status');
    elements.buttons = document.querySelectorAll('button[data-action]');
  }

  function bindEvents() {
    elements.buttons.forEach(btn => btn.addEventListener('click', handleButtonClick));

    elements.fileInput.addEventListener('change', handleFileSelect);

    elements.previewBg.addEventListener('input', debounce(() => {
      renderPreviewDebounced();
    }, 100));

    elements.inputEditor.addEventListener('input', debounce(() => {
      state.svgText = elements.inputEditor.value;
      updateInputInfo();
      renderPreviewDebounced();
    }, 200));

    // 支持 Ctrl+V 粘贴 SVG 文本（优先于“读剪贴板图片”）
    elements.inputEditor.addEventListener('paste', (e) => {
      const text = e.clipboardData && e.clipboardData.getData('text/plain');
      if (text && text.trim().startsWith('<svg')) {
        // 让默认粘贴发生即可（保持用户光标位置）
        setStatus('已粘贴 SVG 文本', 'success');
      }
    });
  }

  function handleButtonClick(e) {
    const action = e.currentTarget.dataset.action;
    const handler = ACTIONS[action];
    if (handler) handler();
  }

  function updateInputInfo() {
    const text = elements.inputEditor.value || '';
    elements.inputInfo.textContent = `${text.length} 字符`;
  }

  function setStatus(text, kind = 'info') {
    elements.status.textContent = text;
    elements.status.classList.remove('is-success', 'is-error', 'is-info');
    if (kind === 'success') elements.status.classList.add('is-success');
    else if (kind === 'error') elements.status.classList.add('is-error');
    else elements.status.classList.add('is-info');
  }

  function clearPreview() {
    elements.previewFrame.srcdoc = '';
    elements.previewPlaceholder.classList.remove('u-hidden');
  }

  function isValidSvg(svgText) {
    const text = (svgText || '').trim();
    if (!text) return { ok: false, error: '内容为空' };

    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'image/svg+xml');
    const err = doc.querySelector('parsererror');
    if (err) {
      return { ok: false, error: 'SVG 解析失败（可能不是合法的 XML/SVG）' };
    }
    if (!doc.documentElement || doc.documentElement.tagName.toLowerCase() !== 'svg') {
      return { ok: false, error: '根节点不是 <svg>' };
    }
    return { ok: true, error: '' };
  }

  function buildSrcdoc(svgText, previewBg) {
    // iframe sandbox 渲染；避免引用外部资源导致隐私泄漏
    // 注意：不做净化，完全依赖 sandbox（不允许脚本执行）
    const bg = (previewBg || '#ffffff').trim();
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    html, body { height: 100%; margin: 0; background: ${bg}; }
    .wrap { height: 100%; display: grid; place-items: center; padding: 12px; box-sizing: border-box; }
    svg { max-width: 100%; max-height: 100%; height: auto; width: auto; }
  </style>
</head>
<body>
  <div class="wrap">
    ${svgText}
  </div>
</body>
</html>`;
  }

  const renderPreviewDebounced = debounce(() => {
    renderPreview();
  }, 200);

  function renderPreview() {
    const svgText = (elements.inputEditor.value || '').trim();
    if (!svgText) {
      setStatus('等待输入', 'info');
      clearPreview();
      return;
    }

    const validation = isValidSvg(svgText);
    if (!validation.ok) {
      setStatus(validation.error, 'error');
      clearPreview();
      return;
    }

    elements.previewPlaceholder.classList.add('u-hidden');
    elements.previewFrame.srcdoc = buildSrcdoc(svgText, elements.previewBg.value);
    setStatus('预览已更新', 'success');
  }

  async function readClipboard() {
    // A: 读剪贴板文本（SVG XML）
    // B: 读剪贴板 items（image/svg+xml）
    if (!navigator.clipboard) {
      showToast('当前浏览器不支持剪贴板 API', 'error');
      return;
    }

    // 先尝试文本
    try {
      if (navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim().startsWith('<svg')) {
          setEditorText(text);
          showToast('已从剪贴板读取 SVG 文本', 'success');
          return;
        }
      }
    } catch (err) {
      // ignore，继续尝试读 items
    }

    // 再尝试 items（部分浏览器需要 https/权限）
    if (!navigator.clipboard.read) {
      showToast('剪贴板图片读取不受支持（可尝试直接粘贴文本）', 'warning');
      return;
    }

    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (type === 'image/svg+xml') {
            const blob = await item.getType(type);
            const text = await blob.text();
            if (text && text.trim()) {
              setEditorText(text);
              showToast('已从剪贴板读取 SVG 图片（image/svg+xml）', 'success');
              return;
            }
          }
        }
      }
      showToast('剪贴板中未找到 SVG（可尝试粘贴 SVG 文本或复制 SVG 文件）', 'warning');
    } catch (err) {
      showToast('读取剪贴板失败（可能需要权限或 HTTPS）', 'error');
    }
  }

  function setEditorText(text) {
    elements.inputEditor.value = text || '';
    state.svgText = elements.inputEditor.value;
    updateInputInfo();
    renderPreview();
  }

  function handleFileSelect(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = String(event.target.result || '');
      setEditorText(text);
      showToast('SVG 已加载', 'success');
    };
    reader.onerror = () => {
      showToast('读取文件失败', 'error');
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function downloadSvg() {
    const svgText = (elements.inputEditor.value || '').trim();
    if (!svgText) {
      showToast('没有可下载的内容', 'warning');
      return;
    }
    const validation = isValidSvg(svgText);
    if (!validation.ok) {
      showToast('SVG 无效，无法下载', 'error');
      return;
    }
    downloadFile(svgText, `svg-${Date.now()}.svg`, 'image/svg+xml');
    showToast('下载已开始', 'success');
  }

  function copySvg() {
    const svgText = (elements.inputEditor.value || '').trim();
    if (!svgText) {
      showToast('没有可复制的内容', 'warning');
      return;
    }
    copyToClipboard(svgText).then(ok => {
      showToast(ok ? '复制成功' : '复制失败', ok ? 'success' : 'error');
    });
  }

  const ACTIONS = {
    upload() {
      elements.fileInput.click();
    },
    paste() {
      readClipboard();
    },
    copy() {
      copySvg();
    },
    download() {
      downloadSvg();
    },
    clear() {
      setEditorText('');
      showToast('已清空', 'success');
    }
  };

  init();
})();

