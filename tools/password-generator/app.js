/**
 * 密码生成器 - UI 层
 */

(function() {
  'use strict';

  var CHARSETS = {
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lower: 'abcdefghijklmnopqrstuvwxyz',
    digits: '0123456789',
    symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?/~`'
  };

  var AMBIGUOUS = 'OoIl1';

  var el = {};
  var config = {
    length: 16,
    useUpper: true,
    useLower: true,
    useDigits: true,
    useSymbols: true,
    excludeAmbiguous: false,
    excludeChars: '',
    quantity: 1
  };

  function init() {
    cacheElements();
    bindEvents();
  }

  function cacheElements() {
    el.result = document.getElementById('pwd-result');
    el.count = document.getElementById('pwd-count');
    el.qtyOptions = document.getElementById('quantity-options');
    el.lengthSlider = document.getElementById('pwd-length');
    el.lengthValue = document.getElementById('pwd-length-value');
    el.chkUpper = document.getElementById('chk-upper');
    el.chkLower = document.getElementById('chk-lower');
    el.chkDigits = document.getElementById('chk-digits');
    el.chkSymbols = document.getElementById('chk-symbols');
    el.chkExcludeAmbiguous = document.getElementById('chk-exclude-ambiguous');
    el.excludeCharsInput = document.getElementById('pwd-exclude-chars');
  }

  function bindEvents() {
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-action]');
      if (btn) {
        var handler = ACTIONS[btn.dataset.action];
        if (handler) handler();
        return;
      }

      var qty = e.target.closest('[data-qty]');
      if (qty) {
        setQuantity(qty.dataset.qty);
        return;
      }
    });

    el.lengthSlider.addEventListener('input', function() {
      config.length = parseInt(this.value);
      el.lengthValue.textContent = config.length;
    });

    el.chkUpper.addEventListener('change', function() { config.useUpper = this.checked; });
    el.chkLower.addEventListener('change', function() { config.useLower = this.checked; });
    el.chkDigits.addEventListener('change', function() { config.useDigits = this.checked; });
    el.chkSymbols.addEventListener('change', function() { config.useSymbols = this.checked; });
    el.chkExcludeAmbiguous.addEventListener('change', function() { config.excludeAmbiguous = this.checked; });
    el.excludeCharsInput.addEventListener('input', function() { config.excludeChars = this.value; });
  }

  function setQuantity(value) {
    config.quantity = Number(value) || 1;
    el.qtyOptions.querySelectorAll('button').forEach(function(b) {
      b.classList.toggle('is-active', b.dataset.qty === String(value));
    });
  }

  function buildPool() {
    var chars = '';
    if (config.useUpper) chars += CHARSETS.upper;
    if (config.useLower) chars += CHARSETS.lower;
    if (config.useDigits) chars += CHARSETS.digits;
    if (config.useSymbols) chars += CHARSETS.symbols;
    if (config.excludeAmbiguous) {
      for (var i = 0; i < AMBIGUOUS.length; i++) {
        chars = chars.split(AMBIGUOUS[i]).join('');
      }
    }
    if (config.excludeChars) {
      for (var j = 0; j < config.excludeChars.length; j++) {
        chars = chars.split(config.excludeChars[j]).join('');
      }
    }
    return chars;
  }

  function buildRequired() {
    var sets = [];
    var filter = function(s) {
      var r = s;
      if (config.excludeAmbiguous) {
        for (var i = 0; i < AMBIGUOUS.length; i++) r = r.split(AMBIGUOUS[i]).join('');
      }
      if (config.excludeChars) {
        for (var j = 0; j < config.excludeChars.length; j++) r = r.split(config.excludeChars[j]).join('');
      }
      return r;
    };
    if (config.useUpper) sets.push(filter(CHARSETS.upper));
    if (config.useLower) sets.push(filter(CHARSETS.lower));
    if (config.useDigits) sets.push(filter(CHARSETS.digits));
    if (config.useSymbols) sets.push(filter(CHARSETS.symbols));
    return sets.filter(function(s) { return s.length > 0; });
  }

  function generateOne(pool, required) {
    var length = config.length;
    var arr = [];
    for (var i = 0; i < required.length && i < length; i++) {
      var charset = required[i];
      arr.push(charset[Math.floor(Math.random() * charset.length)]);
    }
    while (arr.length < length) {
      arr.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    for (var j = arr.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var tmp = arr[j];
      arr[j] = arr[k];
      arr[k] = tmp;
    }
    return arr.join('');
  }

  function calcStrength(poolSize) {
    var entropy = config.length * Math.log2(Math.max(poolSize, 2));
    if (entropy < 40) return { level: 'weak', label: '弱', entropy: Math.round(entropy) };
    if (entropy < 60) return { level: 'fair', label: '一般', entropy: Math.round(entropy) };
    if (entropy < 80) return { level: 'good', label: '良好', entropy: Math.round(entropy) };
    return { level: 'strong', label: '强', entropy: Math.round(entropy) };
  }

  function doGenerate() {
    if (!config.useUpper && !config.useLower && !config.useDigits && !config.useSymbols) {
      showToast('请至少选择一种字符集', 'warning');
      return;
    }

    var pool = buildPool();
    if (!pool.length) {
      showToast('排除字符过多，可用字符集为空', 'error');
      return;
    }

    var required = buildRequired();
    var passwords = [];
    for (var i = 0; i < config.quantity; i++) {
      passwords.push(generateOne(pool, required));
    }

    var strength = calcStrength(pool.length);
    renderResult(passwords, strength);
    el.count.textContent = passwords.length + ' 条';
  }

  function renderResult(list, strength) {
    if (!list.length) {
      el.result.innerHTML = '<div class="placeholder">点击「生成」按钮创建密码</div>';
      return;
    }

    var html = '<div class="pwd-strength-bar-wrap">'
      + '<div class="pwd-strength-badge" data-level="' + strength.level + '">'
      + strength.label + ' · ' + strength.entropy + ' bits'
      + '</div>'
      + '<div class="pwd-strength-bar">'
      + '<div class="pwd-strength-bar-fill" data-level="' + strength.level + '"></div>'
      + '</div>'
      + '</div>';

    html += '<ul class="pwd-result-list">';
    list.forEach(function(item, idx) {
      html += '<li class="pwd-result-item">'
        + '<code class="pwd-result-code">' + escapeHtml(item) + '</code>'
        + '<button class="btn btn-sm btn-secondary" data-copy-index="' + idx + '">复制</button>'
        + '</li>';
    });
    html += '</ul>';
    el.result.innerHTML = html;

    el.result.querySelectorAll('[data-copy-index]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var i = Number(btn.dataset.copyIndex);
        copyToClipboard(list[i]).then(function(ok) {
          showToast(ok ? '已复制' : '复制失败', ok ? 'success' : 'error');
        });
      });
    });
  }

  function doClear() {
    renderResult([], null);
    el.count.textContent = '0 条';
    showToast('已清空', 'success');
  }

  function doCopyAll() {
    var items = el.result.querySelectorAll('.pwd-result-code');
    if (!items.length) { showToast('没有可复制的内容', 'warning'); return; }
    var text = Array.from(items).map(function(c) { return c.textContent; }).join('\n');
    copyToClipboard(text).then(function(ok) {
      showToast(ok ? '全部已复制' : '复制失败', ok ? 'success' : 'error');
    });
  }

  var ACTIONS = {
    generate: doGenerate,
    clear: doClear,
    'copy-all': doCopyAll
  };

  init();

})();
