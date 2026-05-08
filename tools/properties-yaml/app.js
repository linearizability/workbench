/**
 * Properties ↔ YAML - 核心逻辑
 */

(function() {
  'use strict';

  const elements = {};
  const state = {
    output: ''
  };

  function init() {
    cacheElements();
    bindEvents();
    reset();
  }

  function cacheElements() {
    elements.inputEditor = document.getElementById('input-editor');
    elements.outputEditor = document.getElementById('output-editor');
    elements.inputInfo = document.getElementById('input-info');
    elements.outputInfo = document.getElementById('output-info');
    elements.preserveStrings = document.getElementById('preserve-strings');
    elements.sortKeys = document.getElementById('sort-keys');
    elements.buttons = document.querySelectorAll('button[data-action]');
  }

  function bindEvents() {
    elements.inputEditor.addEventListener('input', debounce(updateInputInfo, 100));
    elements.buttons.forEach(btn => btn.addEventListener('click', handleButtonClick));
  }

  function handleButtonClick(e) {
    const action = e.currentTarget.dataset.action;
    const handler = ACTIONS[action];
    if (handler) handler();
  }

  function updateInputInfo() {
    const input = elements.inputEditor.value || '';
    elements.inputInfo.textContent = `${input.length} 字符`;
  }

  function updateOutputInfo(value) {
    elements.outputInfo.textContent = `${(value || '').length} 字符`;
  }

  function clearOutput() {
    elements.outputEditor.innerHTML = '<div class="placeholder">结果将显示在这里...</div>';
    state.output = '';
    updateOutputInfo('');
  }

  function showOutput(text) {
    state.output = text || '';
    elements.outputEditor.textContent = state.output;
    updateOutputInfo(state.output);
  }

  function reset() {
    elements.inputEditor.value = '';
    updateInputInfo();
    clearOutput();
  }

  function isLikelyYaml(input) {
    const text = (input || '').trim();
    if (!text) return false;
    // 很粗略的判断：YAML 常见的 ":"、"- "、"---"
    if (text.startsWith('---')) return true;
    if (/^\s*-\s+/.test(text)) return true;
    if (/^[^=\n]+\s*:\s*.*$/m.test(text)) return true;
    return false;
  }

  function parseInputAuto(input) {
    if (isLikelyYaml(input)) {
      return parseYaml(input);
    }
    return parseProperties(input);
  }

  function parseYaml(input) {
    if (typeof jsyaml === 'undefined' || typeof jsyaml.load !== 'function') {
      throw new Error('YAML 解析库未加载（js-yaml）');
    }
    const obj = jsyaml.load(input);
    if (obj === undefined) return null;
    return obj;
  }

  function dumpYaml(obj, sortKeys) {
    if (typeof jsyaml === 'undefined' || typeof jsyaml.dump !== 'function') {
      throw new Error('YAML 生成库未加载（js-yaml）');
    }
    return jsyaml.dump(obj, {
      noRefs: true,
      lineWidth: 120,
      sortKeys: !!sortKeys
    });
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
    // 支持 key=value 或 key: value，且允许 \= \: 转义
    let sepIndex = -1;
    let escaped = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '=' || ch === ':') {
        sepIndex = i;
        break;
      }
    }
    if (sepIndex === -1) return [line.trim(), ''];
    const key = line.slice(0, sepIndex).trim();
    const value = line.slice(sepIndex + 1).trim();
    return [key, value];
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
    // 支持 a.b.c 和 arr[0].name
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
          if (!Array.isArray(cur)) {
            // 无法安全写入数字索引：退化为对象键
            cur[String(t)] = value;
          } else {
            cur[t] = value;
          }
        } else {
          cur[t] = value;
        }
        return;
      }

      // 中间节点创建容器
      const shouldBeArray = typeof next === 'number';
      if (typeof t === 'number') {
        if (!Array.isArray(cur)) {
          // 退化为对象键
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

  function convertAllStrings(obj) {
    if (obj === null) return 'null';
    if (Array.isArray(obj)) return obj.map(convertAllStrings);
    if (typeof obj === 'object') {
      const out = {};
      Object.keys(obj).forEach(k => {
        out[k] = convertAllStrings(obj[k]);
      });
      return out;
    }
    return String(obj);
  }

  function flattenToPairs(obj, prefix = '') {
    const pairs = [];

    if (obj === null || obj === undefined) {
      pairs.push([prefix, 'null']);
      return pairs;
    }

    if (Array.isArray(obj)) {
      obj.forEach((item, idx) => {
        const key = prefix ? `${prefix}[${idx}]` : `[${idx}]`;
        pairs.push(...flattenToPairs(item, key));
      });
      return pairs;
    }

    if (typeof obj === 'object') {
      Object.keys(obj).forEach(k => {
        const key = prefix ? `${prefix}.${k}` : k;
        pairs.push(...flattenToPairs(obj[k], key));
      });
      return pairs;
    }

    pairs.push([prefix, String(obj)]);
    return pairs;
  }

  function dumpProperties(obj, sortKeys) {
    const pairs = flattenToPairs(obj, '');
    const filtered = pairs.filter(([k]) => k);
    if (sortKeys) filtered.sort((a, b) => a[0].localeCompare(b[0]));
    return filtered
      .map(([k, v]) => `${k}=${escapePropertiesValue(v)}`)
      .join('\n');
  }

  function getOptions() {
    return {
      preserveStrings: !!elements.preserveStrings.checked,
      sortKeys: !!elements.sortKeys.checked
    };
  }

  function toYaml() {
    const input = elements.inputEditor.value || '';
    if (!input.trim()) {
      showToast('请输入内容', 'warning');
      return;
    }

    const opts = getOptions();
    try {
      let obj = parseInputAuto(input);
      if (!opts.preserveStrings) {
        // 从 properties 来的值默认为字符串；这里仅在用户选择“非全字符串”时尝试做基础类型推断
        obj = walkAndMaybeParseScalar(obj);
      } else {
        obj = convertAllStrings(obj);
      }

      const yaml = dumpYaml(obj, opts.sortKeys);
      showOutput(yaml);
      showToast('转换为 YAML 成功', 'success');
    } catch (err) {
      showToast('转换失败: ' + err.message, 'error');
    }
  }

  function walkAndMaybeParseScalar(obj) {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map(walkAndMaybeParseScalar);
    if (typeof obj === 'object') {
      const out = {};
      Object.keys(obj).forEach(k => {
        out[k] = walkAndMaybeParseScalar(obj[k]);
      });
      return out;
    }
    return maybeParseScalar(obj);
  }

  function toProperties() {
    const input = elements.inputEditor.value || '';
    if (!input.trim()) {
      showToast('请输入内容', 'warning');
      return;
    }

    const opts = getOptions();
    try {
      let obj = parseInputAuto(input);
      if (opts.preserveStrings) {
        obj = convertAllStrings(obj);
      }
      const props = dumpProperties(obj, opts.sortKeys);
      showOutput(props);
      showToast('转换为 Properties 成功', 'success');
    } catch (err) {
      showToast('转换失败: ' + err.message, 'error');
    }
  }

  function download() {
    if (!state.output) {
      showToast('没有可下载的内容', 'warning');
      return;
    }
    const isYaml = isLikelyYaml(state.output);
    const filename = isYaml ? `output-${Date.now()}.yaml` : `output-${Date.now()}.properties`;
    downloadFile(state.output, filename, 'text/plain');
    showToast('下载已开始', 'success');
  }

  function copy() {
    if (!state.output) {
      showToast('没有可复制的内容', 'warning');
      return;
    }
    copyToClipboard(state.output).then(ok => {
      showToast(ok ? '复制成功' : '复制失败', ok ? 'success' : 'error');
    });
  }

  const ACTIONS = {
    'to-yaml'() { toYaml(); },
    'to-properties'() { toProperties(); },
    copy() { copy(); },
    download() { download(); },
    clear() {
      reset();
      showToast('已清空', 'success');
    }
  };

  init();
})();

