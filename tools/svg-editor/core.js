/**
 * SVG 工具 — 核心逻辑（纯函数，不操作 DOM）
 */

(function() {
  'use strict';

  window.TOOL_SVG_EDITOR_CORE = {
    /**
     * SVG 格式化或压缩
     * @param {Object} options — { input: { svg }, params: { mode } }
     * @returns {Promise<{ output: { svg, text }, error }>}
     */
    async run({ input, params }) {
      const svg = (input.svg ?? '').trim();
      const mode = params.mode || 'format';

      if (!svg) {
        return { output: null, error: '请输入 SVG 内容' };
      }

      // 基础验证
      if (!svg.toLowerCase().includes('<svg')) {
        return { output: null, error: '内容不包含 <svg> 标签' };
      }

      try {
        if (mode === 'format') {
          const formatted = formatSvg(svg);
          return { output: { svg: formatted, text: formatted }, error: null };
        } else {
          const minified = minifySvg(svg);
          return { output: { svg: minified, text: minified }, error: null };
        }
      } catch (err) {
        return { output: null, error: err.message };
      }
    }
  };

  // ── 内部函数 ──

  function formatSvg(svg) {
    // 简单的缩进格式化
    let depth = 0;
    const indent = '  ';
    let result = '';
    let inTag = false;
    let inComment = false;
    let buffer = '';

    for (let i = 0; i < svg.length; i++) {
      const ch = svg[i];
      const next = svg[i + 1] || '';

      if (inComment) {
        buffer += ch;
        if (buffer.endsWith('-->')) {
          inComment = false;
          result += buffer + '\n' + indent.repeat(depth);
          buffer = '';
        }
        continue;
      }

      if (ch === '<' && next === '!') {
        inComment = true;
        buffer = ch;
        continue;
      }

      if (ch === '<') {
        if (buffer.trim()) {
          result += buffer.trim();
          buffer = '';
        }
        inTag = true;
        if (next === '/') depth = Math.max(0, depth - 1);
        result += '\n' + indent.repeat(depth) + ch;
        continue;
      }

      if (ch === '>') {
        inTag = false;
        result += ch;
        const tagMatch = result.match(/<([^\/\s>]+)/g);
        const lastTag = tagMatch ? tagMatch[tagMatch.length - 1] : '';
        if (next && next !== '<' && next !== ' ') {
          // 标签后紧跟文本
        }
        if (!result.trimEnd().endsWith('/>') && !result.trimEnd().endsWith('?>')) {
          const tagName = lastTag.replace('<', '');
          const isVoid = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'].includes(tagName);
          if (!isVoid && next !== '/' && next !== '<') {
            depth++;
          }
        }
        continue;
      }

      if (inTag) {
        result += ch;
      } else {
        buffer += ch;
      }
    }

    return result.trim();
  }

  function minifySvg(svg) {
    return svg
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/>\s+</g, '><')
      .replace(/\s{2,}/g, ' ')
      .replace(/\n/g, '')
      .trim();
  }

})();
