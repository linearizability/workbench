/**
 * Unicode 编解码工具 — 核心逻辑（纯函数，不操作 DOM）
 */

(function() {
  'use strict';

  window.TOOL_UNICODE_CORE = {
    /**
     * 执行 Unicode 编解码
     * @param {Object} options — { input: { text }, params: { mode, format } }
     * @returns {Promise<{ output: { text }, error }>}
     */
    async run({ input, params }) {
      const text = input.text ?? '';
      const mode = params.mode || 'encode';
      const format = params.format || '\\uXXXX';

      try {
        if (mode === 'encode') {
          const result = unicodeEncode(text, format);
          return { output: { text: result }, error: null };
        } else {
          const result = unicodeDecode(text);
          return { output: { text: result }, error: null };
        }
      } catch (err) {
        return { output: null, error: err.message };
      }
    }
  };

  function unicodeEncode(text, format) {
    if (!text) return '';
    let result = '';
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code > 127) {
        if (code >= 0x10000) {
          const cp = text.codePointAt(i);
          result += format === 'u+' ? 'U+' + cp.toString(16).toUpperCase().padStart(4, '0')
                   : format === '0x' ? '0x' + cp.toString(16).toUpperCase().padStart(4, '0')
                   : format === '&#x;' ? '&#x' + cp.toString(16).toUpperCase() + ';'
                   : format === '%u'  ? '%u' + cp.toString(16).toUpperCase().padStart(4, '0')
                   : '\\u{' + cp.toString(16).toUpperCase() + '}';
          if (code >= 0xD800 && code <= 0xDBFF) i++;
        } else {
          const hex = code.toString(16).toUpperCase().padStart(4, '0');
          result += format === 'u+' ? 'U+' + hex
                   : format === '0x' ? '0x' + hex
                   : format === '&#x;' ? '&#x' + hex + ';'
                   : format === '%u'  ? '%u' + hex
                   : '\\u' + hex;
        }
      } else {
        result += text[i];
      }
    }
    return result;
  }

  function unicodeDecode(text) {
    if (!text) return '';
    let result = text;

    result = result.replace(/\\u\{([0-9A-Fa-f]{1,6})\}/g, (_, hex) => {
      return String.fromCodePoint(parseInt(hex, 16));
    });

    result = result.replace(/\\u([0-9A-Fa-f]{4})/g, (_, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });

    result = result.replace(/&#x([0-9A-Fa-f]{1,6});/gi, (_, hex) => {
      return String.fromCodePoint(parseInt(hex, 16));
    });

    result = result.replace(/%u([0-9A-Fa-f]{4})/gi, (_, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });

    result = result.replace(/U\+([0-9A-Fa-f]{4,6})/gi, (_, hex) => {
      return String.fromCodePoint(parseInt(hex, 16));
    });

    result = result.replace(/0x([0-9A-Fa-f]{4,6})/gi, (match, hex, offset) => {
      if (offset > 0 && /[a-zA-Z0-9]/.test(text[offset - 1])) return match;
      return String.fromCodePoint(parseInt(hex, 16));
    });

    return result;
  }

})();