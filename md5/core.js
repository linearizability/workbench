/**
 * MD5 工具 — 核心逻辑（纯函数，不操作 DOM）
 */

(function() {
  'use strict';

  window.TOOL_MD5_CORE = {
    /**
     * 计算 MD5 哈希
     * @param {Object} options — { input: { text }, params: { uppercase } }
     * @returns {Promise<{ output: { hash, text }, error }>}
     */
    async run({ input, params }) {
      const text = input.text ?? '';
      const uppercase = params.uppercase || false;

      if (!text) {
        return { output: { hash: '', text: '' }, error: null };
      }

      if (typeof SparkMD5 === 'undefined') {
        return { output: null, error: 'MD5 库未加载' };
      }

      let hash = SparkMD5.hash(text);
      if (uppercase) {
        hash = hash.toUpperCase();
      }

      return { output: { hash, text: hash }, error: null };
    }
  };

})();
