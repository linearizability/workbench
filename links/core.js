/**
 * 链接工具 — 核心逻辑（纯函数，不操作 DOM）
 */

(function() {
  'use strict';

  window.TOOL_LINKS_CORE = {
    /**
     * URL 解析与格式化
     * @param {Object} options — { input: { url }, params: {} }
     * @returns {Promise<{ output: { name, url, hostname, pathname, text }, error }>}
     */
    async run({ input, params }) {
      const raw = (input.url ?? '').trim();
      if (!raw) {
        return { output: null, error: '请输入 URL' };
      }

      let url;
      try {
        url = new URL(raw);
      } catch (err) {
        return { output: null, error: '无效的 URL' };
      }

      const name = url.hostname.replace(/^www\./, '');

      return {
        output: {
          name,
          url: raw,
          hostname: url.hostname,
          pathname: url.pathname,
          text: raw
        },
        error: null
      };
    }
  };

})();
