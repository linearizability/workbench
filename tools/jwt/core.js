/**
 * JWT 工具 — 核心逻辑（纯函数，不操作 DOM）
 */

(function() {
  'use strict';

  window.TOOL_JWT_CORE = {
    /**
     * 解析 JWT Token
     * @param {Object} options — { input: { token }, params: {} }
     * @returns {Promise<{ output: { header, payload, signature, text }, error }>}
     */
    async run({ input, params }) {
      const token = (input.token ?? '').trim();

      if (!token) {
        return { output: null, error: 'Token 为空' };
      }

      const parts = token.split('.');
      if (parts.length !== 3) {
        return { output: null, error: 'JWT Token 必须由 Header.Payload.Signature 三部分组成' };
      }

      try {
        const header = safeJsonParse(base64UrlDecode(parts[0]));
        const payload = safeJsonParse(base64UrlDecode(parts[1]));

        return {
          output: {
            header,
            payload,
            signature: parts[2],
            text: JSON.stringify({ header, payload }, null, 2)
          },
          error: null
        };
      } catch (err) {
        return { output: null, error: err.message };
      }
    }
  };

  // ── 内部函数 ──

  function base64UrlDecode(str) {
    let input = str.replace(/-/g, '+').replace(/_/g, '/');
    const pad = input.length % 4;
    if (pad === 2) input += '==';
    else if (pad === 3) input += '=';
    return atob(input);
  }

  function safeJsonParse(str) {
    try { return JSON.parse(str); }
    catch { return { _raw: str }; }
  }

})();
