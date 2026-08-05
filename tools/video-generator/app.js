/**
 * 视频生成器 — UI 逻辑 + Canvas 绘制 + MediaRecorder 录制
 */

(function() {
  'use strict';

  const el = {};
  let isRecording = false;
  let isPreviewing = false;
  let previewRAF = null;
  let lastBlob = null;
  let lastFilename = 'test-video';
  let colorMode = 'random';          // 'random' | 'custom'
  const COLOR_CYCLE_SEC = 2;        // 纯色/棋盘格颜色交替周期（秒）

  // ── 初始化 ──
  function init() {
    cacheElements();
    populateFormats();
    generateRandomColors();
    bindEvents();
    applyColorMode();
    updateConfigVisibility();
    drawPreviewFrame();
    updateMeta();
  }

  function cacheElements() {
    el.width = document.getElementById('width');
    el.height = document.getElementById('height');
    el.duration = document.getElementById('duration');
    el.fps = document.getElementById('fps');
    el.contentType = document.getElementById('contentType');
    el.format = document.getElementById('format');
    el.color1 = document.getElementById('color1');
    el.color2 = document.getElementById('color2');
    el.squareSize = document.getElementById('squareSize');
    el.filename = document.getElementById('filename');
    el.canvas = document.getElementById('canvas');
    el.meta = document.getElementById('meta');
    el.progress = document.getElementById('progress');
    el.progressFill = document.getElementById('progressFill');
    el.progressText = document.getElementById('progressText');
    el.result = document.getElementById('result');
    el.videoPlayer = document.getElementById('videoPlayer');
    el.previewBtn = document.getElementById('previewBtn');
    el.generateBtn = document.getElementById('generateBtn');
    el.downloadBtn = document.getElementById('downloadBtn');
    el.color1Label = document.getElementById('color1Label');
    el.buttons = document.querySelectorAll('[data-action]');
    el.colorModeToggle = document.getElementById('colorModeToggle');
    el.randomBtn = document.getElementById('randomBtn');
  }

  // ── 格式探测 ──
  function getSupportedFormats() {
    if (typeof MediaRecorder === 'undefined') return [];
    const candidates = [
      { mime: 'video/webm;codecs=vp9', label: 'WebM (VP9)', ext: 'webm' },
      { mime: 'video/webm;codecs=vp8', label: 'WebM (VP8)', ext: 'webm' },
      { mime: 'video/webm',            label: 'WebM',       ext: 'webm' },
      { mime: 'video/mp4',             label: 'MP4',        ext: 'mp4' },
    ];
    return candidates.filter(f => MediaRecorder.isTypeSupported(f.mime));
  }

  function populateFormats() {
    const formats = getSupportedFormats();
    el.format.innerHTML = '';
    if (!formats.length) {
      el.format.innerHTML = '<option value="">不支持</option>';
      el.format.disabled = true;
      el.generateBtn.disabled = true;
      el.generateBtn.textContent = '浏览器不支持视频录制';
      showToast('当前浏览器不支持 MediaRecorder API', 'error');
      return;
    }
    formats.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.mime;
      opt.textContent = f.label;
      opt.dataset.ext = f.ext;
      el.format.appendChild(opt);
    });
    el.format.disabled = false;
  }

  // ── 事件绑定 ──
  function bindEvents() {
    el.buttons.forEach(btn => btn.addEventListener('click', handleAction));

    // 颜色模式切换
    el.colorModeToggle.querySelectorAll('.vg-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (isPreviewing) stopPreview();
        colorMode = btn.dataset.mode;
        el.colorModeToggle.querySelectorAll('.vg-mode-btn').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        applyColorMode();
        drawPreviewFrame();
        updateMeta();
      });
    });

    // 换一组随机颜色
    el.randomBtn.addEventListener('click', () => {
      if (isPreviewing) stopPreview();
      if (colorMode === 'random') {
        generateRandomColors();
        drawPreviewFrame();
        updateMeta();
      }
    });

    const onChange = debounce(() => {
      if (isPreviewing) stopPreview();
      updateConfigVisibility();
      drawPreviewFrame();
      updateMeta();
    }, 150);
    [el.width, el.height, el.color1, el.color2, el.squareSize].forEach(input => {
      input.addEventListener('input', onChange);
    });
    [el.contentType, el.fps, el.format].forEach(input => {
      input.addEventListener('change', onChange);
    });
  }

  function handleAction(e) {
    const action = e.currentTarget.dataset.action;
    if (action === 'preview') togglePreview();
    else if (action === 'generate') generateVideo();
    else if (action === 'download') downloadVideo();
  }

  // ── 配置 ──
  function getConfig() {
    const clampInt = (v, min, max, fallback) => {
      const n = parseInt(v, 10);
      if (isNaN(n)) return fallback;
      return Math.max(min, Math.min(max, n));
    };
    return {
      width: clampInt(el.width.value, 16, 1920, 640),
      height: clampInt(el.height.value, 16, 1080, 360),
      duration: clampInt(el.duration.value, 1, 60, 5),
      fps: clampInt(el.fps.value, 1, 60, 30),
      contentType: el.contentType.value,
      color1: el.color1.value,
      color2: el.color2.value,
      squareSize: clampInt(el.squareSize.value, 4, 200, 40),
      format: el.format.value,
      formatExt: el.format.selectedOptions[0]?.dataset.ext || 'webm',
    };
  }

  function updateConfigVisibility() {
    const type = el.contentType.value;
    const color2Field = document.querySelector('.vg-color2');
    const squareField = document.querySelector('.vg-square');

    // 颜色2对所有模式都可见
    color2Field.style.display = '';
    el.color1Label.textContent = '颜色 1';

    if (type === 'checkerboard') {
      squareField.style.display = '';
    } else {
      squareField.style.display = 'none';
    }
  }

  // ── 随机颜色 & 模式 ──
  function generateRandomColors() {
    el.color1.value = randomHexColor();
    el.color2.value = randomHexColor();
  }

  function randomHexColor() {
    const h = Math.floor(Math.random() * 360);
    const s = 60 + Math.floor(Math.random() * 30);  // 60-90%
    const l = 45 + Math.floor(Math.random() * 20);   // 45-65%
    return hslToHex(h, s, l);
  }

  function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = n => {
      const k = (n + h / 30) % 12;
      const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * c).toString(16).padStart(2, '0');
    };
    return '#' + f(0) + f(8) + f(4);
  }

  function applyColorMode() {
    const isRandom = colorMode === 'random';
    el.color1.readOnly = isRandom;
    el.color2.readOnly = isRandom;
    if (isRandom) {
      el.color1.style.cursor = 'not-allowed';
      el.color2.style.cursor = 'not-allowed';
      el.randomBtn.style.display = '';
    } else {
      el.color1.style.cursor = '';
      el.color2.style.cursor = '';
      el.randomBtn.style.display = 'none';
    }
  }

  function updateMeta() {
    const cfg = getConfig();
    const totalFrames = cfg.fps * cfg.duration;
    const aspectRatio = simplifyRatio(cfg.width, cfg.height);
    el.meta.textContent = `${cfg.width}x${cfg.height} (${aspectRatio}) | ${cfg.duration}s @ ${cfg.fps}fps | ${totalFrames} 帧 | ${cfg.formatExt.toUpperCase()}`;
  }

  function simplifyRatio(w, h) {
    const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
    const g = gcd(w, h);
    return `${w / g}:${h / g}`;
  }

  // ── Canvas 绘制 ──
  function setupCanvas(width, height) {
    el.canvas.width = width;
    el.canvas.height = height;
    return el.canvas.getContext('2d');
  }

  function drawFrame(ctx, w, h, progress, cfg) {
    switch (cfg.contentType) {
      case 'gradient':    drawGradient(ctx, w, h, progress, cfg); break;
      case 'checkerboard': drawCheckerboard(ctx, w, h, progress, cfg); break;
      case 'solid':       drawSolid(ctx, w, h, progress, cfg); break;
    }
  }

  function drawGradient(ctx, w, h, progress, cfg) {
    // 旋转渐变角度，一周期正好循环
    const angle = progress * Math.PI * 2;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.sqrt(w * w + h * h) / 2;
    const x1 = cx + Math.cos(angle) * r;
    const y1 = cy + Math.sin(angle) * r;
    const x2 = cx - Math.cos(angle) * r;
    const y2 = cy - Math.sin(angle) * r;

    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, cfg.color1);
    grad.addColorStop(0.5, cfg.color2);
    grad.addColorStop(1, cfg.color1);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  function drawCheckerboard(ctx, w, h, progress, cfg) {
    const s = cfg.squareSize;
    const offset = (progress * s * 2) % (s * 2);

    // 根据周期交替两个颜色
    const phase = Math.floor(progress * cfg.duration / COLOR_CYCLE_SEC) % 2;
    const c1 = phase === 0 ? cfg.color1 : cfg.color2;
    const c2 = phase === 0 ? cfg.color2 : cfg.color1;

    for (let y = 0; y < h; y += s) {
      for (let x = 0; x < w; x += s) {
        const idx = (Math.floor((x + offset) / s) + Math.floor((y + offset) / s)) % 2;
        ctx.fillStyle = idx === 0 ? c1 : c2;
        ctx.fillRect(x, y, s, s);
      }
    }
  }

  function drawSolid(ctx, w, h, progress, cfg) {
    // 两个颜色周期性交替闪烁
    const phase = Math.floor(progress * cfg.duration / COLOR_CYCLE_SEC) % 2;
    ctx.fillStyle = phase === 0 ? cfg.color1 : cfg.color2;
    ctx.fillRect(0, 0, w, h);
  }

  function drawPreviewFrame() {
    if (isRecording) return;
    const cfg = getConfig();
    const ctx = setupCanvas(cfg.width, cfg.height);
    drawFrame(ctx, cfg.width, cfg.height, 0, cfg);
  }

  // ── 预览动画 ──
  function togglePreview() {
    if (isRecording) return;
    if (isPreviewing) {
      stopPreview();
    } else {
      startPreview();
    }
  }

  function startPreview() {
    isPreviewing = true;
    el.previewBtn.textContent = '停止预览';
    el.generateBtn.disabled = true;

    const cfg = getConfig();
    const ctx = setupCanvas(cfg.width, cfg.height);
    const startTime = performance.now();
    const durationMs = 3000; // 预览循环 3 秒

    function loop() {
      if (!isPreviewing) return;
      const elapsed = performance.now() - startTime;
      const progress = (elapsed % durationMs) / durationMs;
      drawFrame(ctx, cfg.width, cfg.height, progress, cfg);
      previewRAF = requestAnimationFrame(loop);
    }
    loop();
  }

  function stopPreview() {
    isPreviewing = false;
    el.previewBtn.textContent = '预览动画';
    el.generateBtn.disabled = false;
    if (previewRAF) cancelAnimationFrame(previewRAF);
    drawPreviewFrame();
  }

  // ── 视频录制 ──
  async function generateVideo() {
    if (isRecording) return;
    stopPreview();

    const cfg = getConfig();
    if (!cfg.format) {
      showToast('没有可用的视频格式', 'error');
      return;
    }

    // 检查 MediaRecorder
    if (typeof MediaRecorder === 'undefined') {
      showToast('浏览器不支持 MediaRecorder', 'error');
      return;
    }

    isRecording = true;
    el.generateBtn.disabled = true;
    el.previewBtn.disabled = true;
    el.generateBtn.textContent = '录制中...';
    el.progress.hidden = false;
    el.result.hidden = true;

    // 设置 canvas 到目标分辨率
    const ctx = setupCanvas(cfg.width, cfg.height);

    // 创建视频流
    const stream = el.canvas.captureStream(cfg.fps);
    const recorder = new MediaRecorder(stream, {
      mimeType: cfg.format,
      videoBitsPerSecond: estimateBitrate(cfg.width, cfg.height, cfg.fps),
    });

    const chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    const durationMs = cfg.duration * 1000;
    const startTime = performance.now();

    // 绘制第一帧
    drawFrame(ctx, cfg.width, cfg.height, 0, cfg);

    recorder.start();

    function recordLoop() {
      const elapsed = performance.now() - startTime;
      if (elapsed >= durationMs) {
        recorder.stop();
        return;
      }
      const progress = elapsed / durationMs;
      drawFrame(ctx, cfg.width, cfg.height, progress, cfg);
      updateProgress(progress, cfg.duration);
      requestAnimationFrame(recordLoop);
    }
    requestAnimationFrame(recordLoop);

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: cfg.format });
      lastBlob = blob;
      lastFilename = (el.filename.value.trim() || 'test-video') + '.' + cfg.formatExt;

      // 显示结果
      const url = URL.createObjectURL(blob);
      el.videoPlayer.src = url;
      el.result.hidden = false;

      // 重置 UI
      isRecording = false;
      el.generateBtn.disabled = false;
      el.previewBtn.disabled = false;
      el.generateBtn.textContent = '生成视频';
      el.progress.hidden = true;

      const sizeKB = (blob.size / 1024).toFixed(1);
      const sizeText = blob.size > 1024 * 1024
        ? `${(blob.size / 1024 / 1024).toFixed(2)} MB`
        : `${sizeKB} KB`;
      showToast(`视频已生成（${sizeText}）`, 'success');

      // 更新 meta
      el.meta.textContent += ` | ${sizeText}`;
    };
  }

  function estimateBitrate(w, h, fps) {
    // 粗略估算：每像素每秒约 0.1 bit，保底 1Mbps，上限 20Mbps
    const pixels = w * h;
    const bitrate = pixels * fps * 0.1;
    return Math.max(1_000_000, Math.min(20_000_000, Math.round(bitrate)));
  }

  function updateProgress(progress, totalDuration) {
    const percent = Math.min(100, progress * 100);
    el.progressFill.style.width = percent + '%';
    el.progressText.textContent = `${(progress * totalDuration).toFixed(1)}s / ${totalDuration.toFixed(1)}s`;
  }

  // ── 下载 ──
  function downloadVideo() {
    if (!lastBlob) {
      showToast('请先生成视频', 'error');
      return;
    }
    const url = URL.createObjectURL(lastBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = lastFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('下载已开始', 'success');
  }

  init();
})();
