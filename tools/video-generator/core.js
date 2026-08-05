/**
 * 视频生成器 — 核心逻辑（工作流引擎调用）
 * 注意：视频录制依赖浏览器 Canvas + MediaRecorder API，
 * 在工作流中调用时会生成视频并返回元信息。
 */

(function() {
  'use strict';

  window.TOOL_VIDEO_GENERATOR_CORE = {
    /**
     * @param {Object} args — { input: { filename }, params: { width, height, duration, fps, contentType, color1, color2, squareSize } }
     * @returns {Promise<{ output: { filename, format, duration, size }, error }>}
     */
    async run({ input, params }) {
      const clampInt = (v, min, max, fallback) => {
        const n = parseInt(v, 10);
        if (isNaN(n)) return fallback;
        return Math.max(min, Math.min(max, n));
      };

      const width = clampInt(params.width, 16, 1920, 640);
      const height = clampInt(params.height, 16, 1080, 360);
      const duration = clampInt(params.duration, 1, 60, 5);
      const fps = clampInt(params.fps, 1, 60, 30);
      const contentType = params.contentType || 'gradient';
      const color1 = params.color1 || '#3b82f6';
      const color2 = params.color2 || '#ef4444';
      const squareSize = clampInt(params.squareSize, 4, 200, 40);
      const filename = (input.filename || '').trim() || 'test-video';

      // 检测格式
      const formats = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4',
      ];
      const format = formats.find(f => MediaRecorder.isTypeSupported(f)) || 'video/webm';
      const ext = format.includes('mp4') ? 'mp4' : 'webm';

      // 创建离屏 canvas
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      const cfg = { contentType, color1, color2, squareSize };

      // 录制
      const stream = canvas.captureStream(fps);
      const recorder = new MediaRecorder(stream, {
        mimeType: format,
        videoBitsPerSecond: Math.max(1_000_000, Math.min(20_000_000, width * height * fps * 0.1)),
      });

      const chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      const durationMs = duration * 1000;
      const startTime = performance.now();

      drawFrame(ctx, width, height, 0, cfg);
      recorder.start();

      await new Promise((resolve) => {
        function loop() {
          const elapsed = performance.now() - startTime;
          if (elapsed >= durationMs) {
            recorder.stop();
            return;
          }
          drawFrame(ctx, width, height, elapsed / durationMs, cfg);
          requestAnimationFrame(loop);
        }
        requestAnimationFrame(loop);
        recorder.onstop = resolve;
      });

      const blob = new Blob(chunks, { type: format });
      const url = URL.createObjectURL(blob);

      // 触发下载
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // 延迟释放 URL（让下载有时间启动）
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      return {
        output: {
          filename: `${filename}.${ext}`,
          format: ext,
          duration,
          size: `${width}x${height}`,
        },
        error: null,
      };
    }
  };

  // ── 绘制函数（与 app.js 保持一致） ──

  function drawFrame(ctx, w, h, progress, cfg) {
    switch (cfg.contentType) {
      case 'gradient':     drawGradient(ctx, w, h, progress, cfg); break;
      case 'checkerboard': drawCheckerboard(ctx, w, h, progress, cfg); break;
      case 'solid':        drawSolid(ctx, w, h, cfg); break;
    }
  }

  function drawGradient(ctx, w, h, progress, cfg) {
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
    for (let y = 0; y < h; y += s) {
      for (let x = 0; x < w; x += s) {
        const idx = (Math.floor((x + offset) / s) + Math.floor((y + offset) / s)) % 2;
        ctx.fillStyle = idx === 0 ? cfg.color1 : cfg.color2;
        ctx.fillRect(x, y, s, s);
      }
    }
  }

  function drawSolid(ctx, w, h, cfg) {
    ctx.fillStyle = cfg.color1;
    ctx.fillRect(0, 0, w, h);
  }

})();
