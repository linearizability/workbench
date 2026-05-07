/**
 * 文本对比 - UI 层
 */

(function() {
  'use strict';

  const el = {};
  let mode = 'lines';

  const SAMPLE_OLD = `function greet(name) {
  console.log('Hello, ' + name);
}

greet('World');`;

  const SAMPLE_NEW = `function greet(name, lang) {
  const msg = lang === 'zh' ? '你好' : 'Hello';
  console.log(msg + ', ' + name);
}

greet('张三', 'zh');
greet('World', 'en');`;

  function init() {
    cacheElements();
    bindEvents();
  }

  function cacheElements() {
    el.oldText = document.getElementById('diff-old');
    el.newText = document.getElementById('diff-new');
    el.result  = document.getElementById('diff-result');
    el.info    = document.getElementById('diff-info');
  }

  function bindEvents() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (btn) {
        const handler = ACTIONS[btn.dataset.action];
        if (handler) handler();
        return;
      }

      const modeBtn = e.target.closest('[data-mode]');
      if (modeBtn) {
        setMode(modeBtn.dataset.mode);
      }
    });
  }

  function setMode(m) {
    mode = m;
    document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('is-active', b.dataset.mode === m));
    if (el.oldText.value || el.newText.value) {
      doCompare();
    }
  }

  // ── 比较 ──
  async function doCompare() {
    if (!window.TOOL_DIFF_CORE) {
      showToast('Diff 核心模块未加载', 'error');
      return;
    }

    const result = await window.TOOL_DIFF_CORE.run({
      input: { oldText: el.oldText.value, newText: el.newText.value },
      params: { mode }
    });

    if (result.error) {
      el.info.textContent = '对比失败';
      el.result.innerHTML = `<div class="placeholder" style="color: var(--color-danger);">${escapeHtml(result.error)}</div>`;
      return;
    }

    if (mode === 'lines') {
      renderLineDiff(result.output.changes);
    } else {
      renderInlineDiff(result.output.changes);
    }
  }

  function renderLineDiff(changes) {
    let html = '<div class="diff-line-list">';
    let oldNum = 1;
    let newNum = 1;
    let addedCount = 0;
    let removedCount = 0;

    changes.forEach(part => {
      const lines = part.value.split('\n');
      if (lines[lines.length - 1] === '') lines.pop();

      lines.forEach(line => {
        const cls = part.added ? 'diff-added' : part.removed ? 'diff-removed' : 'diff-normal';
        const oNum = part.added ? '' : oldNum++;
        const nNum = part.removed ? '' : newNum++;
        if (part.added) addedCount++;
        if (part.removed) removedCount++;

        html += `<div class="diff-line ${cls}">
          <span class="diff-line-num diff-line-num-old">${oNum}</span>
          <span class="diff-line-num diff-line-num-new">${nNum}</span>
          <span class="diff-line-marker">${part.added ? '+' : part.removed ? '-' : ' '}</span>
          <span class="diff-line-text">${escapeHtml(line)}</span>
        </div>`;
      });
    });

    html += '</div>';
    el.result.innerHTML = html;

    const parts = [];
    if (addedCount) parts.push(`+${addedCount}`);
    if (removedCount) parts.push(`-${removedCount}`);
    el.info.textContent = parts.length ? parts.join(' ') : '无差异';
    el.info.style.color = parts.length ? 'var(--color-success)' : '';
  }

  function renderInlineDiff(changes) {
    let html = '<pre class="diff-inline">';
    let addedCount = 0;
    let removedCount = 0;

    changes.forEach(part => {
      const text = escapeHtml(part.value);
      if (part.added) {
        addedCount++;
        html += `<ins class="diff-ins">${text}</ins>`;
      } else if (part.removed) {
        removedCount++;
        html += `<del class="diff-del">${text}</del>`;
      } else {
        html += text;
      }
    });

    html += '</pre>';
    el.result.innerHTML = html;

    const parts = [];
    if (addedCount) parts.push(`+${addedCount} 处`);
    if (removedCount) parts.push(`-${removedCount} 处`);
    el.info.textContent = parts.length ? parts.join('，') : '无差异';
    el.info.style.color = parts.length ? 'var(--color-success)' : '';
  }

  function resetResult() {
    el.info.textContent = '点击「比较」查看差异';
    el.info.style.color = '';
    el.result.innerHTML = '<div class="placeholder">输入两侧文本并点击「比较」…</div>';
  }

  // ── 操作 ──
  function doSwap() {
    const tmp = el.oldText.value;
    el.oldText.value = el.newText.value;
    el.newText.value = tmp;
    if (el.oldText.value || el.newText.value) {
      doCompare();
    }
    showToast('已交换', 'success');
  }

  function doClear() {
    el.oldText.value = '';
    el.newText.value = '';
    resetResult();
    showToast('已清空', 'success');
  }

  function doSample() {
    el.oldText.value = SAMPLE_OLD;
    el.newText.value = SAMPLE_NEW;
    doCompare();
    showToast('已填入示例', 'success');
  }

  function doCopyOld() {
    const text = el.oldText.value;
    if (!text) { showToast('没有可复制的内容', 'warning'); return; }
    copyToClipboard(text).then(ok => showToast(ok ? '已复制' : '复制失败', ok ? 'success' : 'error'));
  }

  function doCopyNew() {
    const text = el.newText.value;
    if (!text) { showToast('没有可复制的内容', 'warning'); return; }
    copyToClipboard(text).then(ok => showToast(ok ? '已复制' : '复制失败', ok ? 'success' : 'error'));
  }

  const ACTIONS = {
    compare: doCompare,
    swap: doSwap,
    clear: doClear,
    sample: doSample,
    'copy-old': doCopyOld,
    'copy-new': doCopyNew
  };

  init();

})();
