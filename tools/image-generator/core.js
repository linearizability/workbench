/**
 * 图片生成器 — 核心逻辑（纯函数，输出 SVG）
 */

(function() {
  'use strict';

  window.TOOL_IMAGE_GENERATOR_CORE = {
    /**
     * 生成占位图片 SVG
     * @param {Object} options — { input: { text }, params: { width, height, bg, fg } }
     * @returns {Promise<{ output: { svg, text }, error }>}
     */
    async run({ input, params }) {
      const width = clamp(parseInt(params.width) || 800, 1, 4096);
      const height = clamp(parseInt(params.height) || 450, 1, 4096);
      const bg = params.bg || '#1d4ed8';
      const fg = params.fg || '#ffffff';
      const label = (input.text ?? '').trim() || `${width}×${height}`;
      const fontSize = Math.max(16, Math.floor(Math.min(width, height) / 10));

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="${escapeXml(bg)}"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="${escapeXml(fg)}" font-size="${fontSize}" font-weight="bold" font-family="system-ui, sans-serif">${escapeXml(label)}</text>
</svg>`;

      return { output: { svg, text: label }, error: null };
    }
  };

  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }

  function escapeXml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

})();
