/**
 * 二维码工具 - 核心逻辑
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'qrcode_tool_options';
  const DEFAULT_OPTIONS = {
    size: 256,
    ecLevel: 'M',
    fgColor: '#000000',
    bgColor: '#ffffff',
    margin: 4
  };

  let activeTab = 'generate';

  const elements = {};

  function init() {
    cacheElements();
    loadSavedOptions();
    bindEvents();
  }

  function cacheElements() {
    elements.tabButtons = document.querySelectorAll('[data-tab]');
    elements.panelGenerate = document.getElementById('panel-generate');
    elements.panelParse = document.getElementById('panel-parse');

    // 生成面板
    elements.qrInput = document.getElementById('qr-input');
    elements.qrSize = document.getElementById('qr-size');
    elements.qrEcLevel = document.getElementById('qr-ec-level');
    elements.qrFgColor = document.getElementById('qr-fg-color');
    elements.qrBgColor = document.getElementById('qr-bg-color');
    elements.qrMargin = document.getElementById('qr-margin');
    elements.qrCanvas = document.getElementById('qr-canvas');
    elements.qrMeta = document.getElementById('qr-meta');
    elements.charCount = document.getElementById('char-count');

    // 解析面板
    elements.parseDropZone = document.getElementById('parse-drop-zone');
    elements.parseFileInput = document.getElementById('parse-file-input');
    elements.parsePreviewWrap = document.getElementById('parse-preview-wrap');
    elements.parsePreview = document.getElementById('parse-preview');
    elements.parseResult = document.getElementById('parse-result');
    elements.parseResultType = document.getElementById('parse-result-type');
  }

  function bindEvents() {
    // Tab 切换
    elements.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // 操作按钮（data-action 委托）
    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      const action = target.dataset.action;
      const handler = ACTIONS[action];
      if (!handler) return;
      e.preventDefault();
      handler(e, target);
    });

    // 生成：输入变化时 debounce 自动生成
    elements.qrInput.addEventListener('input', debounce(() => {
      updateCharCount();
      handleGenerateIfActive();
    }, 300));

    // Ctrl+Enter 生成
    elements.qrInput.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleGenerate();
      }
    });

    // 选项变化时自动重新生成
    const optionEls = [elements.qrSize, elements.qrEcLevel, elements.qrFgColor, elements.qrBgColor, elements.qrMargin];
    optionEls.forEach(el => {
      el.addEventListener('input', debounce(handleGenerateIfActive, 300));
      el.addEventListener('change', debounce(handleGenerateIfActive, 300));
    });

    // 解析：文件拖放
    elements.parseDropZone.addEventListener('click', () => {
      elements.parseFileInput.click();
    });

    elements.parseFileInput.addEventListener('change', handleFileSelect);

    elements.parseDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      elements.parseDropZone.classList.add('is-dragover');
    });

    elements.parseDropZone.addEventListener('dragleave', () => {
      elements.parseDropZone.classList.remove('is-dragover');
    });

    elements.parseDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      elements.parseDropZone.classList.remove('is-dragover');
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        loadImageForParsing(file);
      } else {
        showToast('请拖放图片文件', 'warning');
      }
    });

    // 全局 Ctrl+V 粘贴图片（仅解析 Tab 激活时）
    document.addEventListener('paste', handleGlobalPaste);

    // 字符计数
    updateCharCount();
  }

  // ===== Tab 切换 =====
  function switchTab(tab) {
    activeTab = tab;
    elements.tabButtons.forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.tab === tab);
    });
    elements.panelGenerate.classList.toggle('is-active', tab === 'generate');
    elements.panelParse.classList.toggle('is-active', tab === 'parse');
  }

  // ===== 生成逻辑 =====
  function handleGenerateIfActive() {
    if (activeTab === 'generate') handleGenerate();
  }

  function handleGenerate() {
    const text = elements.qrInput.value.trim();
    if (!text) {
      clearCanvas();
      return;
    }

    if (typeof qrcode === 'undefined') {
      showToast('二维码生成库加载失败，请刷新重试', 'error');
      return;
    }

    const options = getOptions();

    try {
      const qr = qrcode(0, options.ecLevel);
      qr.addData(text);
      qr.make();
      drawQrToCanvas(qr, options);
      saveOptions(options);
    } catch (err) {
      showToast('生成失败：内容过长或包含不支持的字符', 'error');
    }
  }

  function drawQrToCanvas(qr, options) {
    const moduleCount = qr.getModuleCount();
    const totalModules = moduleCount + options.margin * 2;
    const cellSize = Math.max(1, Math.floor(options.size / totalModules));
    const actualSize = cellSize * totalModules;

    const canvas = elements.qrCanvas;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = actualSize * dpr;
    canvas.height = actualSize * dpr;
    canvas.style.width = actualSize + 'px';
    canvas.style.height = actualSize + 'px';

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 背景
    ctx.fillStyle = options.bgColor;
    ctx.fillRect(0, 0, actualSize, actualSize);

    // 前景模块
    ctx.fillStyle = options.fgColor;
    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (qr.isDark(row, col)) {
          ctx.fillRect(
            (col + options.margin) * cellSize,
            (row + options.margin) * cellSize,
            cellSize,
            cellSize
          );
        }
      }
    }

    // 元信息
    elements.qrMeta.textContent =
      `${actualSize}×${actualSize}px · 纠错 ${options.ecLevel} · 前景 ${options.fgColor} · 背景 ${options.bgColor}`;
  }

  function clearCanvas() {
    const canvas = elements.qrCanvas;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.style.width = '';
    canvas.style.height = '';
    elements.qrMeta.textContent = '';
  }

  // ===== 下载 =====
  function downloadPng() {
    const canvas = elements.qrCanvas;
    if (!canvas.width) {
      showToast('请先生成二维码', 'warning');
      return;
    }
    canvas.toBlob((blob) => {
      if (!blob) {
        showToast('导出失败', 'error');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'qrcode.png';
      a.click();
      URL.revokeObjectURL(url);
      showToast('PNG 已下载', 'success');
    }, 'image/png');
  }

  function downloadSvg() {
    const text = elements.qrInput.value.trim();
    if (!text) {
      showToast('请先生成二维码', 'warning');
      return;
    }
    if (typeof qrcode === 'undefined') {
      showToast('二维码生成库加载失败', 'error');
      return;
    }

    const options = getOptions();

    try {
      const qr = qrcode(0, options.ecLevel);
      qr.addData(text);
      qr.make();

      const moduleCount = qr.getModuleCount();
      const totalModules = moduleCount + options.margin * 2;
      const cellSize = Math.max(1, Math.floor(options.size / totalModules));
      const actualSize = cellSize * totalModules;

      let rects = '';
      for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
          if (qr.isDark(row, col)) {
            rects += `<rect x="${(col + options.margin) * cellSize}" y="${(row + options.margin) * cellSize}" width="${cellSize}" height="${cellSize}" fill="${escapeHtml(options.fgColor)}"/>`;
          }
        }
      }

      const svg = [
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${actualSize} ${actualSize}" width="${actualSize}" height="${actualSize}">`,
        `<rect width="${actualSize}" height="${actualSize}" fill="${escapeHtml(options.bgColor)}"/>`,
        rects,
        '</svg>'
      ].join('');

      downloadFile(svg, 'qrcode.svg', 'image/svg+xml');
      showToast('SVG 已下载', 'success');
    } catch (err) {
      showToast('SVG 生成失败', 'error');
    }
  }

  async function copyImage() {
    const canvas = elements.qrCanvas;
    if (!canvas.width) {
      showToast('请先生成二维码', 'warning');
      return;
    }

    try {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('toBlob failed');

      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      showToast('图片已复制到剪贴板', 'success');
    } catch (err) {
      showToast('复制失败（浏览器可能不支持图片复制）', 'error');
    }
  }

  // ===== 解析逻辑 =====
  function handleFileSelect(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('请选择图片文件', 'warning');
      return;
    }
    loadImageForParsing(file);
    e.target.value = '';
  }

  function handleGlobalPaste(e) {
    if (activeTab !== 'parse') return;
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (blob) loadImageForParsing(blob);
        return;
      }
    }
  }

  async function handleClipboardImage() {
    if (!navigator.clipboard || !navigator.clipboard.read) {
      showToast('当前浏览器不支持剪贴板图片读取，请使用 Ctrl+V 粘贴', 'warning');
      return;
    }
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            loadImageForParsing(blob);
            showToast('已从剪贴板读取图片', 'success');
            return;
          }
        }
      }
      showToast('剪贴板中未找到图片', 'warning');
    } catch {
      showToast('读取剪贴板失败（可能需要 HTTPS 环境）', 'error');
    }
  }

  function loadImageForParsing(source) {
    const url = URL.createObjectURL(source);
    elements.parsePreview.src = url;
    elements.parsePreview.onload = () => {
      elements.parsePreviewWrap.classList.remove('u-hidden');
      handleParse();
    };
  }

  function handleParse() {
    if (typeof jsQR === 'undefined') {
      showToast('二维码解析库加载失败，请刷新重试', 'error');
      return;
    }

    const img = elements.parsePreview;
    if (!img.naturalWidth) {
      showToast('请先上传或粘贴图片', 'warning');
      return;
    }

    // 绘制到离屏 canvas 获取 ImageData
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code) {
      elements.parseResult.value = code.data;
      updateResultType(code.data);
      showToast('二维码解析成功', 'success');
    } else {
      elements.parseResult.value = '';
      elements.parseResultType.innerHTML = '';
      showToast('未检测到二维码，请确认图片包含有效的二维码', 'warning');
    }
  }

  function updateResultType(data) {
    if (/^https?:\/\//i.test(data)) {
      elements.parseResultType.innerHTML = '<span class="result-badge result-badge-url">URL</span>';
    } else {
      elements.parseResultType.innerHTML = '<span class="result-badge result-badge-text">文本</span>';
    }
  }

  function copyResult() {
    const text = elements.parseResult.value;
    if (!text) {
      showToast('没有可复制的内容', 'warning');
      return;
    }
    copyToClipboard(text);
    showToast('已复制到剪贴板', 'success');
  }

  // ===== 清空 =====
  function clearGenerate() {
    elements.qrInput.value = '';
    clearCanvas();
    updateCharCount();
  }

  function clearParse() {
    elements.parsePreviewWrap.classList.add('u-hidden');
    elements.parsePreview.src = '';
    elements.parseResult.value = '';
    elements.parseResultType.innerHTML = '';
    elements.parseFileInput.value = '';
  }

  // ===== 选项持久化 =====
  function getOptions() {
    return {
      size: clamp(parseInt(elements.qrSize.value, 10) || DEFAULT_OPTIONS.size, 64, 1024),
      ecLevel: elements.qrEcLevel.value || DEFAULT_OPTIONS.ecLevel,
      fgColor: elements.qrFgColor.value || DEFAULT_OPTIONS.fgColor,
      bgColor: elements.qrBgColor.value || DEFAULT_OPTIONS.bgColor,
      margin: clamp(parseInt(elements.qrMargin.value, 10) || DEFAULT_OPTIONS.margin, 0, 10)
    };
  }

  function saveOptions(opts) {
    if (typeof storage === 'undefined') return;
    storage.set(STORAGE_KEY, opts);
  }

  function loadSavedOptions() {
    if (typeof storage === 'undefined') return;
    const saved = storage.get(STORAGE_KEY, {});
    const opts = { ...DEFAULT_OPTIONS, ...saved };

    elements.qrSize.value = opts.size;
    elements.qrEcLevel.value = opts.ecLevel;
    elements.qrFgColor.value = opts.fgColor;
    elements.qrBgColor.value = opts.bgColor;
    elements.qrMargin.value = opts.margin;
  }

  // ===== 工具函数 =====
  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function updateCharCount() {
    elements.charCount.textContent = (elements.qrInput.value || '').length;
  }

  // ===== 操作映射 =====
  const ACTIONS = {
    'generate'() { handleGenerate(); },
    'clear-generate'() { clearGenerate(); },
    'download-png'() { downloadPng(); },
    'download-svg'() { downloadSvg(); },
    'copy-image'() { copyImage(); },
    'parse'() { handleParse(); },
    'clipboard-image'() { handleClipboardImage(); },
    'clear-parse'() { clearParse(); },
    'copy-result'() { copyResult(); }
  };

  init();
})();
