/**
 * 备忘录 — 核心逻辑（纯函数，文本分析）
 */

(function() {
  'use strict';

  window.TOOL_NOTEPAD_CORE = {
    /**
     * 文本分析与格式化
     * @param {Object} options — { input: { content }, params: { mode } }
     * @returns {Promise<{ output: { text, wordCount, lineCount, charCount }, error }>}
     */
    async run({ input, params }) {
      const content = input.content ?? '';
      const mode = params.mode || 'analyze';

      if (mode === 'analyze') {
        const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
        const lineCount = content ? content.split(/\r?\n/).length : 0;
        const charCount = content.length;

        const summary = [
          `字符数: ${charCount}`,
          `单词数: ${wordCount}`,
          `行数: ${lineCount}`
        ].join('\n');

        return {
          output: {
            text: summary,
            wordCount,
            lineCount,
            charCount
          },
          error: null
        };
      } else if (mode === 'dedupeLines') {
        const lines = content.split(/\r?\n/);
        const seen = new Set();
        const deduped = [];
        lines.forEach(line => {
          if (!seen.has(line)) {
            seen.add(line);
            deduped.push(line);
          }
        });
        const result = deduped.join('\n');
        return { output: { text: result, wordCount: 0, lineCount: deduped.length, charCount: result.length }, error: null };
      } else if (mode === 'sortLines') {
        const lines = content.split(/\r?\n/);
        lines.sort((a, b) => a.localeCompare(b));
        const result = lines.join('\n');
        return { output: { text: result, wordCount: 0, lineCount: lines.length, charCount: result.length }, error: null };
      }

      return { output: { text: content, wordCount: 0, lineCount: 0, charCount: content.length }, error: null };
    }
  };

})();
