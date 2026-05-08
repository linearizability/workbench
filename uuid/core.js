/**
 * UUID 工具 — 核心逻辑（纯函数，不操作 DOM）
 */

(function() {
  'use strict';

  window.TOOL_UUID_CORE = {
    /**
     * 生成 UUID
     * @param {Object} options — { input: {}, params: { quantity, format, caseType } }
     * @returns {Promise<{ output: { text, list }, error }>}
     */
    async run({ input, params }) {
      const quantity = Math.min(Math.max(parseInt(params.quantity) || 1, 1), 100);
      const format = params.format || 'standard';
      const caseType = params.caseType || 'lower';

      const uuids = [];
      for (let i = 0; i < quantity; i++) {
        uuids.push(formatUuid(uuidv4(), format, caseType));
      }

      return {
        output: {
          text: uuids.join('\n'),
          list: uuids
        },
        error: null
      };
    }
  };

  // ── 内部函数 ──

  function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function formatUuid(raw, format, caseType) {
    let str = raw;
    if (format === 'plain') {
      str = str.replace(/-/g, '');
    }
    if (caseType === 'upper') {
      str = str.toUpperCase();
    }
    return str;
  }

})();
