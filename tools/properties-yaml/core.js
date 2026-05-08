/**
 * Properties ↔ YAML — 核心逻辑（纯函数，不操作 DOM）
 */

(function() {
  'use strict';

  window.TOOL_PROPERTIES_YAML_CORE = {
    /**
     * Properties 与 YAML 互转
     * @param {Object} options — { input: { text }, params: { mode, preserveStrings, sortKeys } }
     * @returns {Promise<{ output: { text }, error }>}
     */
    async run({ input, params }) {
      const text = input.text ?? '';
      const mode = params.mode || 'toYaml';
      const preserveStrings = params.preserveStrings || false;
      const sortKeys = params.sortKeys || false;

      if (!text.trim()) {
        return { output: { text: '' }, error: null };
      }

      try {
        let obj = parseInputAuto(text);

        if (mode === 'toYaml') {
          if (typeof jsyaml === 'undefined' || typeof jsyaml.dump !== 'function') {
            return { output: null, error: 'YAML 生成库未加载（js-yaml）' };
          }
          if (!preserveStrings) {
            obj = walkAndMaybeParseScalar(obj);
          } else {
            obj = convertAllStrings(obj);
          }
          const yaml = jsyaml.dump(obj, { noRefs: true, lineWidth: 120, sortKeys: !!sortKeys });
          return { output: { text: yaml }, error: null };
        } else {
          if (preserveStrings) {
            obj = convertAllStrings(obj);
          }
          const props = dumpProperties(obj, !!sortKeys);
          return { output: { text: props }, error: null };
        }
      } catch (err) {
        return { output: null, error: err.message };
      }
    }
  };

  // ── 内部函数 ──

  function isLikelyYaml(input) {
    const t = (input || '').trim();
    if (!t) return false;
    if (t.startsWith('---')) return true;
    if (/^\s*-\s+/.test(t)) return true;
    if (/^[^=\n]+\s*:\s*.*$/m.test(t)) return true;
    return false;
  }

  function parseInputAuto(input) {
    if (isLikelyYaml(input)) {
      if (typeof jsyaml === 'undefined' || typeof jsyaml.load !== 'function') {
        throw new Error('YAML 解析库未加载（js-yaml）');
      }
      const obj = jsyaml.load(input);
      return obj === undefined ? null : obj;
    }
    return parseProperties(input);
  }

  function unescapePropertiesValue(str) {
    return String(str)
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r')
      .replace(/\\f/g, '\f')
      .replace(/\\\\/g, '\\')
      .replace(/\\:/g, ':')
      .replace(/\\=/g, '=');
  }

  function escapePropertiesValue(str) {
    return String(str)
      .replace(/\\/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t')
      .replace(/\r/g, '\\r')
      .replace(/\f/g, '\\f')
      .replace(/:/g, '\\:')
      .replace(/=/g, '\\=');
  }

  function splitKeyValue(line) {
    let sepIndex = -1;
    let escaped = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '=' || ch === ':') { sepIndex = i; break; }
    }
    if (sepIndex === -1) return [line.trim(), ''];
    return [line.slice(0, sepIndex).trim(), line.slice(sepIndex + 1).trim()];
  }

  function parseProperties(input) {
    const lines = String(input || '').split(/\r?\n/);
    const kv = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith('#') || line.startsWith('!')) continue;
      const [k, v] = splitKeyValue(raw);
      if (!k) continue;
      kv.push([k.trim(), unescapePropertiesValue(v)]);
    }
    return unflattenToObject(kv);
  }

  function unflattenToObject(pairs) {
    const root = {};
    for (const [rawKey, rawValue] of pairs) {
      const tokens = tokenizeKey(rawKey);
      setDeep(root, tokens, rawValue);
    }
    return root;
  }

  function tokenizeKey(key) {
    const tokens = [];
    const parts = String(key).split('.');
    for (const part of parts) {
      const re = /([^\[\]]+)|\[(\d+)\]/g;
      let m;
      while ((m = re.exec(part)) !== null) {
        if (m[1]) tokens.push(m[1]);
        else tokens.push(Number.parseInt(m[2], 10));
      }
    }
    return tokens.filter(t => t !== '');
  }

  function setDeep(obj, tokens, value) {
    let cur = obj;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      const isLast = i === tokens.length - 1;
      const next = tokens[i + 1];

      if (isLast) {
        if (typeof t === 'number') {
          if (!Array.isArray(cur)) { cur[String(t)] = value; }
          else { cur[t] = value; }
        } else {
          cur[t] = value;
        }
        return;
      }

      const shouldBeArray = typeof next === 'number';
      if (typeof t === 'number') {
        if (!Array.isArray(cur)) {
          const k = String(t);
          if (cur[k] == null) cur[k] = shouldBeArray ? [] : {};
          cur = cur[k];
        } else {
          if (cur[t] == null) cur[t] = shouldBeArray ? [] : {};
          cur = cur[t];
        }
      } else {
        if (cur[t] == null) cur[t] = shouldBeArray ? [] : {};
        cur = cur[t];
      }
    }
  }

  function maybeParseScalar(value) {
    const v = String(value);
    if (v === 'true') return true;
    if (v === 'false') return false;
    if (v === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    return v;
  }

  function walkAndMaybeParseScalar(obj) {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map(walkAndMaybeParseScalar);
    if (typeof obj === 'object') {
      const out = {};
      Object.keys(obj).forEach(k => { out[k] = walkAndMaybeParseScalar(obj[k]); });
      return out;
    }
    return maybeParseScalar(obj);
  }

  function convertAllStrings(obj) {
    if (obj === null) return 'null';
    if (Array.isArray(obj)) return obj.map(convertAllStrings);
    if (typeof obj === 'object') {
      const out = {};
      Object.keys(obj).forEach(k => { out[k] = convertAllStrings(obj[k]); });
      return out;
    }
    return String(obj);
  }

  function flattenToPairs(obj, prefix) {
    const pairs = [];
    const p = prefix || '';
    if (obj === null || obj === undefined) { pairs.push([p, 'null']); return pairs; }
    if (Array.isArray(obj)) {
      obj.forEach((item, idx) => {
        const key = p ? `${p}[${idx}]` : `[${idx}]`;
        pairs.push(...flattenToPairs(item, key));
      });
      return pairs;
    }
    if (typeof obj === 'object') {
      Object.keys(obj).forEach(k => {
        const key = p ? `${p}.${k}` : k;
        pairs.push(...flattenToPairs(obj[k], key));
      });
      return pairs;
    }
    pairs.push([p, String(obj)]);
    return pairs;
  }

  function dumpProperties(obj, sortKeys) {
    const pairs = flattenToPairs(obj, '');
    const filtered = pairs.filter(([k]) => k);
    if (sortKeys) filtered.sort((a, b) => a[0].localeCompare(b[0]));
    return filtered.map(([k, v]) => `${k}=${escapePropertiesValue(v)}`).join('\n');
  }

})();
