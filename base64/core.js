/**
 * Base64 工具 — 核心逻辑（纯函数，不操作 DOM）
 */

(function() {
  'use strict';

  window.TOOL_BASE64_CORE = {
    /**
     * 执行 Base64 编解码
     * @param {Object} options — { input: { text }, params: { mode, urlSafe } }
     * @returns {Promise<{ output: { text }, error }>}
     */
    async run({ input, params }) {
      const text = input.text ?? '';
      const mode = params.mode || 'encode';
      const urlSafe = params.urlSafe || false;

      try {
        if (mode === 'encode') {
          const result = base64Encode(text, urlSafe);
          return { output: { text: result }, error: null };
        } else {
          const result = base64Decode(text, urlSafe);
          return { output: { text: result }, error: null };
        }
      } catch (err) {
        return { output: null, error: err.message };
      }
    }
  };

  // ── 内部函数 ──

  function base64Encode(text, urlSafe) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    let encoded = btoa(binary);
    if (urlSafe) {
      encoded = encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    return encoded;
  }

  function base64Decode(str, urlSafe) {
    let input = str.trim();
    if (urlSafe) {
      input = input.replace(/-/g, '+').replace(/_/g, '/');
      const pad = input.length % 4;
      if (pad === 2) input += '==';
      else if (pad === 3) input += '=';
    }
    const binary = atob(input);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

})();
