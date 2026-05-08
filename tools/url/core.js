/**
 * URL 工具 — 核心逻辑（纯函数，不操作 DOM）
 */

(function() {
  'use strict';

  window.TOOL_URL_CORE = {
    /**
     * 执行 URL 编解码或 QueryString 解析
     * @param {Object} options — { input: { text }, params: { mode } }
     * @returns {Promise<{ output: { text, entries }, error }>}
     */
    async run({ input, params }) {
      const text = input.text ?? '';
      const mode = params.mode || 'encode';

      try {
        if (mode === 'encode') {
          return { output: { text: encodeURIComponent(text), entries: null }, error: null };
        } else if (mode === 'decode') {
          return { output: { text: decodeURIComponent(text), entries: null }, error: null };
        } else if (mode === 'query') {
          let search = '';
          try {
            const u = new URL(text);
            search = u.search;
          } catch {
            search = text.startsWith('?') ? text : '?' + text;
          }
          const params = new URLSearchParams(search);
          const entries = Array.from(params.entries());
          const result = entries.map(([k, v]) => `${k}=${v}`).join('\n');
          return { output: { text: result, entries }, error: null };
        }
        return { output: { text: encodeURIComponent(text), entries: null }, error: null };
      } catch (err) {
        return { output: null, error: err.message };
      }
    }
  };

})();
