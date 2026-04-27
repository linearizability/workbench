/**
 * 图片生成器 - 核心逻辑
 */

(function() {
  'use strict';

  const elements = {};

  function init() {
    cacheElements();
    bindEvents();
    refresh();
  }

  function cacheElements() {
    elements.w = document.getElementById('w');
    elements.h = document.getElementById('h');
    elements.unit = document.getElementById('unit');
    elements.dpi = document.getElementById('dpi');
    elements.bg = document.getElementById('bg');
    elements.fg = document.getElementById('fg');
    elements.grid = document.getElementById('grid');
    elements.fmt = document.getElementById('fmt');
    elements.text = document.getElementById('text');
    elements.filename = document.getElementById('filename');
    elements.canvas = document.getElementById('canvas');
    elements.meta = document.getElementById('meta');
    elements.buttons = document.querySelectorAll('[data-action]');
  }

  function bindEvents() {
    elements.buttons.forEach(btn => btn.addEventListener('click', handleButtonClick));

    const onChange = debounce(() => refresh(), 150);
    [elements.w, elements.h, elements.bg, elements.fg, elements.fmt, elements.text, elements.dpi].forEach(el => {
      el.addEventListener('input', onChange);
    });
    elements.grid.addEventListener('change', onChange);

    // 单位切换：保持像素尺寸不变，只转换输入值显示
    elements.unit.addEventListener('change', () => {
      convertInputsToNewUnit();
      refresh();
    });
  }

  function handleButtonClick(e) {
    const action = e.currentTarget.dataset.action;
    const handler = ACTIONS[action];
    if (handler) handler();
  }

  function clampNumber(v, min, max, fallback) {
    const n = Number.parseFloat(v);
    if (Number.isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function clampInt(v, min, max, fallback) {
    const n = Number.parseInt(v, 10);
    if (Number.isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function getDpi() {
    return clampInt(elements.dpi.value, 36, 600, 96);
  }

  function unitToPxFactor(unit, dpi) {
    // px: 1
    // in: dpi px/in
    // cm: dpi/2.54 px/cm
    // mm: dpi/25.4 px/mm
    if (unit === 'in') return dpi;
    if (unit === 'cm') return dpi / 2.54;
    if (unit === 'mm') return dpi / 25.4;
    return 1;
  }

  function toPx(value, unit, dpi) {
    return value * unitToPxFactor(unit, dpi);
  }

  function fromPx(px, unit, dpi) {
    return px / unitToPxFactor(unit, dpi);
  }

  function formatDisplayNumber(n) {
    // 物理单位保留 2 位小数，px 保留整数（由调用方决定）
    return Number.isFinite(n) ? String(n) : '';
  }

  function getConfig() {
    const unit = elements.unit.value || 'px';
    const dpi = getDpi();

    const wVal = clampNumber(elements.w.value, 0.01, 999999, 800);
    const hVal = clampNumber(elements.h.value, 0.01, 999999, 450);

    const width = clampInt(toPx(wVal, unit, dpi), 1, 4096, 800);
    const height = clampInt(toPx(hVal, unit, dpi), 1, 4096, 450);
    const bg = elements.bg.value || '#1d4ed8';
    const fg = elements.fg.value || '#ffffff';
    const fmt = elements.fmt.value || 'image/png';
    const text = (elements.text.value || '').trim();
    const showGrid = !!elements.grid.checked;
    return { width, height, bg, fg, fmt, text, unit, dpi, showGrid };
  }

  function getCurrentPxSize() {
    // 用当前输入（含单位）推导像素尺寸
    const { width, height } = getConfig();
    return { width, height };
  }

  function convertInputsToNewUnit() {
    // 切换单位时：读取切换前的像素尺寸，再按新单位回填输入框
    // 为了拿到“切换前”的单位，我们在 change 事件触发时 unit 已变更，
    // 所以这里改用缓存方式：从 canvas 当前 style 尺寸读取像素值（更稳定）
    const canvas = elements.canvas;
    const pxW = clampInt(parseFloat(canvas.style.width) || canvas.width, 1, 4096, 800);
    const pxH = clampInt(parseFloat(canvas.style.height) || canvas.height, 1, 4096, 450);

    const unit = elements.unit.value || 'px';
    const dpi = getDpi();

    if (unit === 'px') {
      elements.w.value = String(pxW);
      elements.h.value = String(pxH);
      return;
    }

    const w = fromPx(pxW, unit, dpi);
    const h = fromPx(pxH, unit, dpi);
    elements.w.value = (Math.round(w * 100) / 100).toString();
    elements.h.value = (Math.round(h * 100) / 100).toString();
  }

  function refresh() {
    const { width, height, bg, fg, text, unit, dpi, showGrid } = getConfig();

    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const canvas = elements.canvas;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // subtle grid (optional)
    if (showGrid) {
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      const step = Math.max(20, Math.floor(Math.min(width, height) / 12));
      for (let x = 0; x <= width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // text
    const label = text || `${width}×${height}`;
    const fontSize = Math.max(16, Math.floor(Math.min(width, height) / 10));
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${fontSize}px ${getComputedStyle(document.body).fontFamily}`;
    ctx.fillText(label, width / 2, height / 2);

    // meta
    const unitText = unit === 'px' ? 'px' : `${unit} @ ${dpi}dpi`;
    elements.meta.textContent = `${width}×${height}px（${unitText}），背景 ${bg}，文字 ${fg}`;

    // filename default
    if (!elements.filename.value.trim()) {
      elements.filename.value = `placeholder-${width}x${height}`;
    }
  }

  function mimeToExt(mime) {
    if (mime === 'image/jpeg') return 'jpg';
    if (mime === 'image/webp') return 'webp';
    return 'png';
  }

  function normalizeFilename(name, mime) {
    const ext = mimeToExt(mime);
    const raw = (name || '').trim() || 'placeholder';

    // 需求：文件名不包含格式名（扩展名由上方格式选择决定）
    // 如果用户输入了扩展名，这里会去掉，再按当前格式补齐
    const base = raw.replace(/\.[a-z0-9]+$/i, '');
    return `${base}.${ext}`;
  }

  async function downloadImage() {
    const { fmt } = getConfig();
    const filename = normalizeFilename(elements.filename.value, fmt);

    const canvas = elements.canvas;
    const quality = fmt === 'image/jpeg' ? 0.92 : undefined;

    const blob = await new Promise(resolve => {
      canvas.toBlob(resolve, fmt, quality);
    });

    if (!blob) {
      showToast('导出失败（浏览器不支持该格式）', 'error');
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('下载已开始', 'success');
  }

  const ACTIONS = {
    refresh() {
      refresh();
      showToast('预览已刷新', 'success');
    },

    download() {
      downloadImage();
    }
  };

  init();
})();

