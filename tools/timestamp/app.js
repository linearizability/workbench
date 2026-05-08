/**
 * 时间戳转换工具
 */
(function() {
  'use strict';

  // ── 状态 ──
  let livePaused = false;
  let liveTimer = null;

  // ── DOM ──
  const el = {};

  // ── 初始化 ──
  function init() {
    cacheElements();
    startLive();
    bindEvents();
  }

  function cacheElements() {
    // 实时时间戳
    el.liveSeconds = document.getElementById('live-seconds');
    el.liveMillis  = document.getElementById('live-millis');
    el.liveDate    = document.getElementById('live-date');
    el.btnPause    = document.getElementById('btn-pause');

    // 时间戳 → 日期
    el.tsInput     = document.getElementById('ts-input');
    el.tsUnit      = document.getElementById('ts-unit');
    el.btnTsToDate = document.getElementById('btn-ts-to-date');
    el.tsResult    = document.getElementById('ts-result');
    el.tsResultLocal    = document.getElementById('ts-result-local');
    el.tsResultUtc      = document.getElementById('ts-result-utc');
    el.tsResultIso      = document.getElementById('ts-result-iso');
    el.tsResultRelative = document.getElementById('ts-result-relative');

    // 日期 → 时间戳
    el.dateInput     = document.getElementById('date-input');
    el.btnDateToTs   = document.getElementById('btn-date-to-ts');
    el.dateResult    = document.getElementById('date-result');
    el.dateResultSeconds = document.getElementById('date-result-seconds');
    el.dateResultMillis  = document.getElementById('date-result-millis');
  }

  // ── 实时时间戳 ──
  function startLive() {
    updateLive();
    liveTimer = setInterval(updateLive, 1000);
  }

  function updateLive() {
    if (livePaused) return;
    const now = Date.now();
    el.liveSeconds.textContent = Math.floor(now / 1000);
    el.liveMillis.textContent  = now;
    el.liveDate.textContent    = formatDate(new Date(now), 'YYYY-MM-DD HH:mm:ss');
  }

  function togglePause() {
    livePaused = !livePaused;
    el.btnPause.textContent = livePaused ? '继续' : '暂停';
    if (!livePaused) updateLive();
  }

  // ── 时间戳 → 日期 ──
  function tsToDate() {
    const raw = el.tsInput.value.trim();
    if (!raw) {
      showToast('请输入时间戳', 'warning');
      return;
    }

    const num = Number(raw);
    if (isNaN(num) || num < 0) {
      showToast('请输入有效的时间戳', 'error');
      return;
    }

    // 判断秒/毫秒
    let millis;
    const unit = el.tsUnit.value;
    if (unit === 'seconds') {
      millis = num * 1000;
    } else if (unit === 'millis') {
      millis = num;
    } else {
      // 自动识别：13位视为毫秒，10位及以下视为秒
      millis = raw.length <= 10 ? num * 1000 : num;
    }

    const date = new Date(millis);
    if (isNaN(date.getTime())) {
      showToast('无法解析该时间戳', 'error');
      return;
    }

    el.tsResultLocal.textContent    = formatDate(date, 'YYYY-MM-DD HH:mm:ss');
    el.tsResultUtc.textContent      = date.toUTCString();
    el.tsResultIso.textContent      = date.toISOString();
    el.tsResultRelative.textContent = relativeTime(date);
    el.tsResult.style.display       = '';
  }

  // ── 日期 → 时间戳 ──
  function dateToTs() {
    const val = el.dateInput.value;
    if (!val) {
      showToast('请选择或输入日期', 'warning');
      return;
    }

    const date = new Date(val);
    if (isNaN(date.getTime())) {
      showToast('无效的日期', 'error');
      return;
    }

    const millis  = date.getTime();
    const seconds = Math.floor(millis / 1000);

    el.dateResultSeconds.textContent = seconds;
    el.dateResultMillis.textContent  = millis;
    el.dateResult.style.display      = '';
  }

  function fillNow() {
    const now = new Date();
    // datetime-local 格式：YYYY-MM-DDTHH:mm:ss
    const pad = (n) => String(n).padStart(2, '0');
    const str = now.getFullYear() + '-' +
      pad(now.getMonth() + 1) + '-' +
      pad(now.getDate()) + 'T' +
      pad(now.getHours()) + ':' +
      pad(now.getMinutes()) + ':' +
      pad(now.getSeconds());
    el.dateInput.value = str;
  }

  // ── 相对时间 ──
  function relativeTime(date) {
    const now = Date.now();
    const diff = now - date.getTime();
    const abs = Math.abs(diff);
    const suffix = diff > 0 ? '前' : '后';

    if (abs < 1000) return abs + ' 毫秒' + suffix;
    if (abs < 60 * 1000) return Math.floor(abs / 1000) + ' 秒' + suffix;
    if (abs < 60 * 60 * 1000) return Math.floor(abs / 60000) + ' 分钟' + suffix;
    if (abs < 24 * 60 * 60 * 1000) return Math.floor(abs / 3600000) + ' 小时' + suffix;
    if (abs < 30 * 24 * 60 * 60 * 1000) return Math.floor(abs / 86400000) + ' 天' + suffix;
    if (abs < 365 * 24 * 60 * 60 * 1000) return Math.floor(abs / (30 * 86400000)) + ' 个月' + suffix;
    return Math.floor(abs / (365 * 86400000)) + ' 年' + suffix;
  }

  // ── 事件绑定 ──
  function bindEvents() {
    // 暂停/继续
    el.btnPause.addEventListener('click', togglePause);

    // 时间戳 → 日期
    el.btnTsToDate.addEventListener('click', tsToDate);
    el.tsInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') tsToDate();
    });

    // 日期 → 时间戳
    el.btnDateToTs.addEventListener('click', dateToTs);

    // 事件委托：复制、填入当前时间
    document.addEventListener('click', function(e) {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;

      switch (action) {
        case 'copy-seconds': copyText(el.liveSeconds.textContent); break;
        case 'copy-millis':  copyText(el.liveMillis.textContent); break;
        case 'copy-date-seconds': copyText(el.dateResultSeconds.textContent); break;
        case 'copy-date-millis':  copyText(el.dateResultMillis.textContent); break;
        case 'fill-now': fillNow(); break;
        case 'pause': break; // 已由 btnPause 单独处理
      }
    });
  }

  function copyText(text) {
    copyToClipboard(text).then(ok => {
      showToast(ok ? '已复制' : '复制失败', ok ? 'success' : 'error');
    });
  }

  // ── 启动 ──
  init();
})();
