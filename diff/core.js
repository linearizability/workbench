/**
 * 文本对比 — 核心逻辑（纯函数，不操作 DOM）
 */

(function() {
  'use strict';

  window.TOOL_DIFF_CORE = {
    /**
     * 执行文本对比
     * @param {Object} options — { input: { oldText, newText }, params: { mode } }
     * @returns {Promise<{ output: { text, changes, stats, oldText, newText }, error }>}
     */
    async run({ input, params }) {
      let oldStr = input.oldText ?? '';
      let newStr = input.newText ?? '';
      const mode = params.mode || 'lines';

      // 防御：将非字符串输入转为 JSON 字符串
      if (typeof oldStr !== 'string') {
        try { oldStr = JSON.stringify(oldStr, null, 2); } catch { oldStr = String(oldStr); }
      }
      if (typeof newStr !== 'string') {
        try { newStr = JSON.stringify(newStr, null, 2); } catch { newStr = String(newStr); }
      }

      if (!window.Diff) {
        return { output: null, error: 'Diff 库未加载' };
      }

      let changes;
      switch (mode) {
        case 'lines':
          changes = window.Diff.diffLines(oldStr, newStr);
          break;
        case 'words':
          changes = window.Diff.diffWords(oldStr, newStr);
          break;
        case 'chars':
          changes = window.Diff.diffChars(oldStr, newStr);
          break;
        default:
          changes = window.Diff.diffLines(oldStr, newStr);
      }

      // 统计差异
      let addedCount = 0;
      let removedCount = 0;

      if (mode === 'lines') {
        changes.forEach(part => {
          const lines = part.value.split('\n');
          if (lines[lines.length - 1] === '') lines.pop();
          lines.forEach(() => {
            if (part.added) addedCount++;
            if (part.removed) removedCount++;
          });
        });
      } else {
        changes.forEach(part => {
          if (part.added) addedCount++;
          if (part.removed) removedCount++;
        });
      }

      const stats = {
        mode,
        added: addedCount,
        removed: removedCount,
        hasChanges: addedCount > 0 || removedCount > 0
      };

      // 生成易读的纯文本 diff
      const text = mode === 'lines'
        ? formatLineDiffText(changes)
        : formatInlineDiffText(changes);

      return {
        output: { text, changes, stats, oldText: oldStr, newText: newStr },
        error: null
      };
    }
  };

  // ── 纯文本格式化（行级） ──
  function formatLineDiffText(changes) {
    if (!changes || !changes.length) return '';

    let result = [];
    let oldNum = 1;
    let newNum = 1;

    changes.forEach(part => {
      const lines = part.value.split('\n');
      if (lines[lines.length - 1] === '') lines.pop();

      lines.forEach(line => {
        const marker = part.added ? '+' : part.removed ? '-' : ' ';
        const oNum = part.added ? '' : String(oldNum++);
        const nNum = part.removed ? '' : String(newNum++);
        const oNumStr = oNum.padStart(4, ' ');
        const nNumStr = nNum.padStart(4, ' ');
        result.push(`${marker} ${oNumStr} ${nNumStr}  ${line}`);
      });
    });

    return result.join('\n');
  }

  // ── 纯文本格式化（词/字符级） ──
  function formatInlineDiffText(changes) {
    if (!changes || !changes.length) return '';

    return changes.map(part => {
      if (part.added) return `{+${part.value}+}`;
      if (part.removed) return `[-${part.value}-]`;
      return part.value;
    }).join('');
  }

})();
