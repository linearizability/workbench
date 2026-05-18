/**
 * JSON 工具 — 核心逻辑（纯函数，不操作 DOM）
 */

(function() {
  'use strict';

  const INDENT_MAP = {
    '2': 2,
    '4': 4,
    'tab': '\t'
  };

  window.TOOL_JSON_CORE = {
    /**
     * 执行 JSON 处理
     * @param {Object} options — { input: { text }, params: { action, indent } }
     * @returns {Promise<{ output: { text, parsed }, error }>}
     */
    async run({ input, params }) {
      let { text } = input;
      const { action, indent } = params;

      if (text === undefined || text === null) {
        return { output: { text: '', parsed: null }, error: null };
      }

      if (typeof text !== 'string') {
        try {
          text = JSON.stringify(text);
        } catch {
          return { output: null, error: `输入类型错误：期望字符串，得到 ${typeof text}` };
        }
      }

      if (!text.trim()) {
        return { output: { text: '', parsed: null }, error: null };
      }

      // 转义/反转义不需要 JSON.parse
      if (action === 'escape') {
        const escaped = JSON.stringify(text);
        return { output: { text: escaped, parsed: escaped }, error: null };
      }
      if (action === 'unescape') {
        let toParse = text.trim();
        if (!(toParse.startsWith('"') && toParse.endsWith('"'))) {
          toParse = `"${toParse}"`;
        }
        try {
          const unescaped = JSON.parse(toParse);
          const result = typeof unescaped === 'string' ? unescaped : JSON.stringify(unescaped, null, 2);
          return { output: { text: result, parsed: unescaped }, error: null };
        } catch (err) {
          return { output: null, error: '反转义失败: ' + err.message };
        }
      }

      try {
        const parsed = JSON.parse(text);

        switch (action) {
          case 'format': {
            const space = INDENT_MAP[indent] || 2;
            const result = formatJsonText(text, space);
            return { output: { text: result, parsed }, error: null };
          }
          case 'compress': {
            const result = compressJsonText(text);
            return { output: { text: result, parsed }, error: null };
          }
          case 'compressEscape': {
            const compressed = compressJsonText(text);
            const escaped = JSON.stringify(compressed);
            return { output: { text: escaped, parsed: compressed }, error: null };
          }
          case 'validate': {
            return { output: { text: 'JSON 格式正确', parsed }, error: null };
          }
          case 'sortKeys': {
            const sorted = sortObject(parsed);
            const result = JSON.stringify(sorted, null, 2);
            return { output: { text: result, parsed: sorted }, error: null };
          }
          case 'toXml': {
            const xml = jsonToXml(parsed, 'root');
            return { output: { text: xml, parsed }, error: null };
          }
          case 'toYaml': {
            if (typeof jsyaml === 'undefined' || typeof jsyaml.dump !== 'function') {
              return { output: null, error: 'YAML 转换库未加载（js-yaml）' };
            }
            const yaml = jsyaml.dump(parsed, { noRefs: true, lineWidth: 120, sortKeys: false });
            return { output: { text: yaml, parsed }, error: null };
          }
          case 'toCsv': {
            if (!Array.isArray(parsed) || parsed.length === 0) {
              return { output: null, error: 'JSON 必须是数组才能转换为 CSV' };
            }
            const csv = jsonToCsv(parsed);
            return { output: { text: csv, parsed }, error: null };
          }
          default: {
            const space = INDENT_MAP[indent] || 2;
            const result = JSON.stringify(parsed, null, space);
            return { output: { text: result, parsed }, error: null };
          }
        }
      } catch (err) {
        return { output: null, error: err.message };
      }
    }
  };

  // ── 内部函数 ──

  function compressJsonText(text) {
    let result = '';
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      if (escapeNext) {
        result += char;
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        result += char;
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        result += char;
        continue;
      }

      if (inString) {
        result += char;
        continue;
      }

      if (char !== ' ' && char !== '\t' && char !== '\n' && char !== '\r') {
        result += char;
      }
    }

    return result;
  }

  function formatJsonText(text, space) {
    const indentStr = typeof space === 'number' ? ' '.repeat(space) : (space || '  ');
    const compressed = compressJsonText(text);
    let result = '';
    let indent = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < compressed.length; i++) {
      const char = compressed[i];

      if (escapeNext) {
        result += char;
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        result += char;
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        result += char;
        continue;
      }

      if (inString) {
        result += char;
        continue;
      }

      if (char === '{' || char === '[') {
        result += char;
        result += '\n';
        indent++;
        result += indentStr.repeat(indent);
      } else if (char === '}' || char === ']') {
        result += '\n';
        indent = Math.max(0, indent - 1);
        result += indentStr.repeat(indent);
        result += char;
      } else if (char === ',') {
        result += char;
        result += '\n';
        result += indentStr.repeat(indent);
      } else if (char === ':') {
        result += char + ' ';
      } else {
        result += char;
      }
    }

    return result;
  }

  function sortObject(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sortObject);
    const sorted = {};
    Object.keys(obj).sort().forEach(key => {
      sorted[key] = sortObject(obj[key]);
    });
    return sorted;
  }

  function jsonToXml(obj, rootName = 'root') {
    function toXml(value, tagName) {
      if (value === null) return `<${tagName} null="true"/>`;
      const type = typeof value;
      if (type === 'object') {
        if (Array.isArray(value)) {
          return value.map((item, index) => toXml(item, tagName + '_' + index)).join('');
        }
        let str = `<${tagName}>`;
        for (const key in value) str += toXml(value[key], key);
        str += `</${tagName}>`;
        return str;
      }
      return `<${tagName}>${escapeXml(String(value))}</${tagName}>`;
    }
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + toXml(obj, rootName);
  }

  function escapeXml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function jsonToCsv(data) {
    const keys = Object.keys(data[0]);
    let csv = keys.join(',') + '\n';
    for (const row of data) {
      const values = keys.map(key => {
        const value = row[key];
        if (value === null || value === undefined) return '';
        const s = String(value);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      });
      csv += values.join(',') + '\n';
    }
    return csv;
  }

})();
