/**
 * 正则工具 — 核心逻辑（纯函数，不操作 DOM）
 */

(function() {
  'use strict';

  window.TOOL_REGEX_CORE = {
    /**
     * 执行正则匹配
     * @param {Object} options — { input: { pattern, text }, params: { flags } }
     * @returns {Promise<{ output: { matches, count, text }, error }>}
     */
    async run({ input, params }) {
      const pattern = input.pattern ?? '';
      const text = input.text ?? '';
      const flags = params.flags ?? 'g';

      if (!pattern || !text) {
        return { output: { matches: [], count: 0, text: '' }, error: null };
      }

      let regex;
      try {
        regex = new RegExp(pattern, flags);
      } catch (err) {
        return { output: null, error: '正则语法错误: ' + err.message };
      }

      const matches = execAll(regex, text);

      return {
        output: {
          matches,
          count: matches.length,
          text: matches.map(m => m.text).join('\n')
        },
        error: null
      };
    }
  };

  // ── 内部函数 ──

  function execAll(regex, text) {
    const matches = [];
    const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
    let m;
    while ((m = re.exec(text)) !== null) {
      matches.push({ index: m.index, text: m[0], groups: m.slice(1) });
      if (m[0].length === 0) re.lastIndex++;
    }
    return matches;
  }

})();
