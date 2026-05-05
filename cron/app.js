/**
 * Cron 表达式工具 - 核心逻辑
 */

(function() {
  'use strict';

  // ── 状态 ──
  let mode = 'parse';

  // ── DOM ──
  const el = {};

  // ── 初始化 ──
  function init() {
    cacheElements();
    bindEvents();
    updateGenerate();
  }

  function cacheElements() {
    el.panelParse    = document.getElementById('panel-parse');
    el.panelGenerate = document.getElementById('panel-generate');
    el.parseInput    = document.getElementById('parse-input');
    el.cronDesc      = document.getElementById('cron-desc');
    el.nextRunsList  = document.getElementById('next-runs-list');
    el.genExpr       = document.getElementById('gen-expr');
    el.genDesc       = document.getElementById('gen-desc');
    el.genNextRuns   = document.getElementById('gen-next-runs');

    // 字段显示
    el.fMin  = document.getElementById('f-min');
    el.fHour = document.getElementById('f-hour');
    el.fDom  = document.getElementById('f-dom');
    el.fMon  = document.getElementById('f-mon');
    el.fDow  = document.getElementById('f-dow');

    // 生成器输入框
    el.genMin  = document.getElementById('gen-min');
    el.genHour = document.getElementById('gen-hour');
    el.genDom  = document.getElementById('gen-dom');
    el.genMon  = document.getElementById('gen-mon');
    el.genDow  = document.getElementById('gen-dow');
  }

  function bindEvents() {
    // 模式切换
    document.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });

    // 常用模板
    document.querySelectorAll('[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        el.parseInput.value = preset;
        setMode('parse');
        doParse();
      });
    });

    // 解析输入
    el.parseInput.addEventListener('input', debounce(doParse, 200));

    // 生成器输入框变化
    [el.genMin, el.genHour, el.genDom, el.genMon, el.genDow].forEach(input => {
      input.addEventListener('input', debounce(updateGenerate, 150));
    });

    // 生成器快捷标签 + 操作按钮（事件委托）
    document.addEventListener('click', (e) => {
      const tag = e.target.closest('.cron-tag');
      if (tag) {
        const fieldEl = tag.closest('.cron-gen-field');
        const input = fieldEl.querySelector('.cron-gen-input');
        if (input) {
          input.value = tag.dataset.val;
          updateGenerate();
        }
        return;
      }

      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const handler = ACTIONS[btn.dataset.action];
      if (handler) handler();
    });
  }

  function setMode(newMode) {
    mode = newMode;
    document.querySelectorAll('[data-mode]').forEach(btn => {
      const active = btn.dataset.mode === newMode;
      btn.classList.toggle('btn-primary', active);
      btn.classList.toggle('btn-secondary', !active);
    });
    el.panelParse.classList.toggle('u-hidden', newMode !== 'parse');
    el.panelGenerate.classList.toggle('u-hidden', newMode !== 'generate');
  }

  // ── 解析 ──
  function doParse() {
    const expr = el.parseInput.value.trim();
    if (!expr) {
      el.cronDesc.textContent = '输入表达式以查看解析结果…';
      el.cronDesc.className = 'cron-desc placeholder';
      el.nextRunsList.innerHTML = '<li class="placeholder">-</li>';
      resetFields();
      return;
    }

    // 字段分解
    const parts = expr.split(/\s+/);
    if (parts.length >= 5) {
      el.fMin.textContent  = parts[0];
      el.fHour.textContent = parts[1];
      el.fDom.textContent  = parts[2];
      el.fMon.textContent  = parts[3];
      el.fDow.textContent  = parts[4];
    }

    // 自然语言描述
    let desc = '';
    try {
      if (typeof cronstrue !== 'undefined' && cronstrue.toString) {
        desc = cronstrue.toString(expr, { locale: 'zh_CN', use24HourTimeFormat: true });
      } else {
        desc = 'cronstrue 库未加载';
      }
    } catch (err) {
      desc = '无效的 Cron 表达式';
    }
    el.cronDesc.textContent = desc;
    el.cronDesc.className = 'cron-desc' + (desc === '无效的 Cron 表达式' ? ' is-error' : '');

    // 未来执行时间
    updateNextRuns(expr, el.nextRunsList);
  }

  // ── 生成 ──
  function updateGenerate() {
    const expr = `${el.genMin.value || '*'} ${el.genHour.value || '*'} ${el.genDom.value || '*'} ${el.genMon.value || '*'} ${el.genDow.value || '*'}`;
    el.genExpr.textContent = expr;

    try {
      if (typeof cronstrue !== 'undefined' && cronstrue.toString) {
        el.genDesc.textContent = cronstrue.toString(expr, { locale: 'zh_CN', use24HourTimeFormat: true });
      } else {
        el.genDesc.textContent = '-';
      }
    } catch {
      el.genDesc.textContent = '无效的表达式';
    }

    updateNextRuns(expr, el.genNextRuns);
  }

  // ── 计算未来执行时间 ──
  function updateNextRuns(expr, listEl) {
    if (typeof Cron === 'undefined') {
      listEl.innerHTML = '<li class="placeholder">Croner 库未加载</li>';
      return;
    }
    try {
      const job = new Cron(expr);
      const runs = job.nextRuns(10);
      if (!runs || runs.length === 0) {
        listEl.innerHTML = '<li class="placeholder">无未来执行时间</li>';
        return;
      }
      listEl.innerHTML = runs.map(dt => {
        const s = formatDate(dt, 'YYYY-MM-DD HH:mm:ss');
        const rel = relativeTime(dt);
        return `<li><span class="run-time">${s}</span><span class="run-rel">${rel}</span></li>`;
      }).join('');
    } catch (err) {
      listEl.innerHTML = `<li class="placeholder">无法计算：${escapeHtml(err.message)}</li>`;
    }
  }

  function resetFields() {
    el.fMin.textContent  = '-';
    el.fHour.textContent = '-';
    el.fDom.textContent  = '-';
    el.fMon.textContent  = '-';
    el.fDow.textContent  = '-';
  }


  function relativeTime(date) {
    const diff = date.getTime() - Date.now();
    const abs = Math.abs(diff);
    if (diff < 0) return '已过期';
    if (abs < 60 * 1000) return '即将执行';
    if (abs < 60 * 60 * 1000) return Math.floor(abs / 60000) + ' 分钟后';
    if (abs < 24 * 60 * 60 * 1000) return Math.floor(abs / 3600000) + ' 小时后';
    if (abs < 30 * 24 * 60 * 60 * 1000) return Math.floor(abs / 86400000) + ' 天后';
    return Math.floor(abs / (30 * 86400000)) + ' 个月后';
  }

  // ── 操作 ──
  function doCopyInput() {
    const text = el.parseInput.value;
    if (!text) { showToast('没有可复制的内容', 'warning'); return; }
    copyToClipboard(text).then(ok => showToast(ok ? '已复制' : '复制失败', ok ? 'success' : 'error'));
  }

  function doCopyDesc() {
    const text = el.cronDesc.textContent;
    if (!text || text === '输入表达式以查看解析结果…') { showToast('没有可复制的内容', 'warning'); return; }
    copyToClipboard(text).then(ok => showToast(ok ? '已复制' : '复制失败', ok ? 'success' : 'error'));
  }

  function doCopyExpr() {
    const text = el.genExpr.textContent;
    copyToClipboard(text).then(ok => showToast(ok ? '已复制' : '复制失败', ok ? 'success' : 'error'));
  }

  function doClear() {
    el.parseInput.value = '';
    doParse();
    showToast('已清空', 'success');
  }

  function doResetGen() {
    el.genMin.value  = '0';
    el.genHour.value = '*';
    el.genDom.value  = '*';
    el.genMon.value  = '*';
    el.genDow.value  = '*';
    updateGenerate();
    showToast('已重置', 'success');
  }

  // ── 动作映射 ──
  const ACTIONS = {
    'copy-input': doCopyInput,
    'copy-desc': doCopyDesc,
    'copy-expr': doCopyExpr,
    'clear': doClear,
    'reset-gen': doResetGen
  };

  init();

})();
