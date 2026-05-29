/**
 * 密码生成器 — 核心逻辑（纯函数，不操作 DOM）
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

  window.TOOL_PASSWORD_GENERATOR_CORE = {
    async run({ input, params }) {
      var length = Math.min(Math.max(parseInt(params.length) || 16, 4), 128);
      var useUpper = params.useUpper !== false;
      var useLower = params.useLower !== false;
      var useDigits = params.useDigits !== false;
      var useSymbols = params.useSymbols !== false;
      var excludeAmbiguous = !!params.excludeAmbiguous;
      var excludeChars = params.excludeChars || '';

      if (!useUpper && !useLower && !useDigits && !useSymbols) {
        return { output: null, error: '请至少选择一种字符集' };
      }

      var pool = buildPool(useUpper, useLower, useDigits, useSymbols, excludeAmbiguous, excludeChars);
      if (!pool.length) {
        return { output: null, error: '排除字符过多，可用字符集为空' };
      }

      var required = buildRequired(useUpper, useLower, useDigits, useSymbols, excludeAmbiguous, excludeChars);
      var quantity = Math.min(Math.max(parseInt(params.quantity) || 1, 1), 100);
      var passwords = [];

      for (var i = 0; i < quantity; i++) {
        passwords.push(generateOne(length, pool, required));
      }

      var strength = calcStrength(length, pool.length);

      return {
        output: {
          text: passwords.join('\n'),
          list: passwords,
          strength: strength
        },
        error: null
      };
    }
  };

  function buildPool(upper, lower, digits, symbols, excludeAmbiguous, excludeChars) {
    var chars = '';
    if (upper) chars += CHARSETS.upper;
    if (lower) chars += CHARSETS.lower;
    if (digits) chars += CHARSETS.digits;
    if (symbols) chars += CHARSETS.symbols;
    if (excludeAmbiguous) {
      for (var i = 0; i < AMBIGUOUS.length; i++) {
        chars = chars.split(AMBIGUOUS[i]).join('');
      }
    }
    if (excludeChars) {
      for (var j = 0; j < excludeChars.length; j++) {
        chars = chars.split(excludeChars[j]).join('');
      }
    }
    return chars;
  }

  function buildRequired(upper, lower, digits, symbols, excludeAmbiguous, excludeChars) {
    var sets = [];
    var filtered = function(s) {
      var r = s;
      if (excludeAmbiguous) {
        for (var i = 0; i < AMBIGUOUS.length; i++) r = r.split(AMBIGUOUS[i]).join('');
      }
      if (excludeChars) {
        for (var j = 0; j < excludeChars.length; j++) r = r.split(excludeChars[j]).join('');
      }
      return r;
    };
    if (upper) sets.push(filtered(CHARSETS.upper));
    if (lower) sets.push(filtered(CHARSETS.lower));
    if (digits) sets.push(filtered(CHARSETS.digits));
    if (symbols) sets.push(filtered(CHARSETS.symbols));
    return sets.filter(function(s) { return s.length > 0; });
  }

  function generateOne(length, pool, required) {
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

  function calcStrength(length, poolSize) {
    var entropy = length * Math.log2(Math.max(poolSize, 2));
    if (entropy < 40) return { level: 'weak', label: '弱', entropy: Math.round(entropy) };
    if (entropy < 60) return { level: 'fair', label: '一般', entropy: Math.round(entropy) };
    if (entropy < 80) return { level: 'good', label: '良好', entropy: Math.round(entropy) };
    return { level: 'strong', label: '强', entropy: Math.round(entropy) };
  }

})();
