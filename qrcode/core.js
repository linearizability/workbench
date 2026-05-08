/**
 * 二维码工具 — 核心逻辑（纯函数，不操作 DOM）
 */

(function() {
  'use strict';

  window.TOOL_QRCODE_CORE = {
    /**
     * 生成二维码 SVG
     * @param {Object} options — { input: { text }, params: { size, ecLevel, fgColor, bgColor, margin } }
     * @returns {Promise<{ output: { svg, text }, error }>}
     */
    async run({ input, params }) {
      const text = (input.text ?? '').trim();
      if (!text) {
        return { output: null, error: '请输入二维码内容' };
      }

      if (typeof qrcode === 'undefined') {
        return { output: null, error: '二维码生成库未加载' };
      }

      const size = clamp(parseInt(params.size) || 256, 64, 1024);
      const ecLevel = params.ecLevel || 'M';
      const fgColor = params.fgColor || '#000000';
      const bgColor = params.bgColor || '#ffffff';
      const margin = clamp(parseInt(params.margin) || 4, 0, 10);

      try {
        const qr = qrcode(0, ecLevel);
        qr.addData(text);
        qr.make();

        const moduleCount = qr.getModuleCount();
        const totalModules = moduleCount + margin * 2;
        const cellSize = Math.max(1, Math.floor(size / totalModules));
        const actualSize = cellSize * totalModules;

        let rects = '';
        for (let row = 0; row < moduleCount; row++) {
          for (let col = 0; col < moduleCount; col++) {
            if (qr.isDark(row, col)) {
              const x = (col + margin) * cellSize;
              const y = (row + margin) * cellSize;
              rects += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${escapeXml(fgColor)}"/>`;
            }
          }
        }

        const svg = [
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${actualSize} ${actualSize}" width="${actualSize}" height="${actualSize}">`,
          `<rect width="${actualSize}" height="${actualSize}" fill="${escapeXml(bgColor)}"/>`,
          rects,
          '</svg>'
        ].join('');

        return { output: { svg, text }, error: null };
      } catch (err) {
        return { output: null, error: '生成失败：' + err.message };
      }
    }
  };

  // ── 内部函数 ──

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function escapeXml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

})();
