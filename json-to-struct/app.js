/**
 * JSON 转 Struct - 核心逻辑
 */

(function() {
  'use strict';

  const el = {};
  let mode = 'java';
  let lastOutput = '';

  const SAMPLE_JSON = JSON.stringify({
    id: 10001,
    name: "张三",
    email: "zhangsan@example.com",
    age: 28,
    score: 95.5,
    isVip: true,
    tags: ["developer", "backend"],
    address: {
      city: "北京",
      zipCode: "100000",
      location: {
        lat: 39.9042,
        lng: 116.4074
      }
    },
    createdAt: "2026-05-01T12:00:00Z",
    metadata: null
  }, null, 2);

  function init() {
    cacheElements();
    bindEvents();
  }

  function cacheElements() {
    el.jsonInput = document.getElementById('json-input');
    el.result    = document.getElementById('struct-result');
    el.status    = document.getElementById('struct-status');
    el.outputLabel = document.getElementById('output-label');
    el.javaOnly  = document.querySelectorAll('.js-java-only');
    el.goOnly    = document.querySelectorAll('.js-go-only');
    el.useLombok = document.getElementById('use-lombok');
    el.javaPkg   = document.getElementById('java-package');
    el.javaClass = document.getElementById('java-class');
    el.goPkg     = document.getElementById('go-package');
    el.goStruct  = document.getElementById('go-struct');
  }

  function bindEvents() {
    document.addEventListener('click', (e) => {
      const modeBtn = e.target.closest('[data-mode]');
      if (modeBtn) { setMode(modeBtn.dataset.mode); return; }

      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const handler = ACTIONS[btn.dataset.action];
      if (handler) handler();
    });

    el.useLombok.addEventListener('change', () => { if (el.jsonInput.value) doConvert(); });
    [el.javaPkg, el.javaClass, el.goPkg, el.goStruct].forEach(input => {
      input.addEventListener('input', debounce(() => { if (el.jsonInput.value) doConvert(); }, 300));
    });
  }

  function setMode(m) {
    mode = m;
    document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('is-active', b.dataset.mode === m));
    el.javaOnly.forEach(n => n.classList.toggle('u-hidden', mode !== 'java'));
    el.goOnly.forEach(n => n.classList.toggle('u-hidden', mode !== 'go'));
    el.outputLabel.textContent = mode === 'java' ? 'Java 类' : 'Go Struct';
    if (el.jsonInput.value) doConvert();
  }

  // ── 转换 ──
  function doConvert() {
    const raw = el.jsonInput.value.trim();
    if (!raw) { resetResult(); return; }

    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      el.status.textContent = 'JSON 语法错误';
      el.status.style.color = 'var(--color-danger)';
      el.result.innerHTML = `<div class="struct-error">${escapeHtml(err.message)}</div>`;
      return;
    }

    let code;
    try {
      if (mode === 'java') {
        code = toJava(data, el.javaClass.value.trim() || 'Root', {
          package: el.javaPkg.value.trim(),
          lombok: el.useLombok.checked
        });
      } else {
        code = toGo(data, el.goStruct.value.trim() || 'Root', {
          package: el.goPkg.value.trim()
        });
      }
    } catch (err) {
      el.status.textContent = '转换失败';
      el.status.style.color = 'var(--color-danger)';
      el.result.innerHTML = `<div class="struct-error">${escapeHtml(err.message)}</div>`;
      return;
    }

    lastOutput = code;
    el.status.textContent = '转换成功';
    el.status.style.color = 'var(--color-success)';
    el.result.innerHTML = `<pre class="struct-code"><code>${escapeHtml(code)}</code></pre>`;
  }

  function resetResult() {
    el.status.textContent = '等待输入';
    el.status.style.color = '';
    el.result.innerHTML = '<div class="placeholder">粘贴 JSON 并点击「转换」…</div>';
    lastOutput = '';
  }

  // ── Java 生成 ──
  function toJava(data, rootClass, opts) {
    const classes = [];
    const { package: pkg, lombok } = opts;

    function inferType(val, suggestedName) {
      if (val === null) return 'Object';
      if (typeof val === 'boolean') return 'Boolean';
      if (typeof val === 'number') {
        return Number.isInteger(val) ? 'Integer' : 'Double';
      }
      if (typeof val === 'string') return 'String';
      if (Array.isArray(val)) {
        if (val.length === 0) return 'List&lt;Object&gt;';
        const itemType = inferType(val[0], suggestedName);
        return `List&lt;${itemType}&gt;`;
      }
      if (typeof val === 'object') {
        const name = toClassName(suggestedName);
        collectClass(val, name);
        return name;
      }
      return 'Object';
    }

    function collectClass(obj, className) {
      if (classes.some(c => c.name === className)) return;
      const fields = [];
      for (const [key, val] of Object.entries(obj)) {
        const fieldName = toJavaField(key);
        const type = inferType(val, key);
        fields.push({ type, name: fieldName, jsonKey: key });
      }
      classes.push({ name: className, fields });
    }

    collectClass(data, toClassName(rootClass));

    let out = '';
    if (pkg) out += `package ${pkg};\n\n`;
    if (lombok) {
      out += 'import lombok.Data;\n';
      out += 'import java.util.List;\n\n';
    } else {
      out += 'import java.util.List;\n\n';
    }

    classes.forEach((cls, idx) => {
      if (idx > 0) out += '\n';
      if (lombok) out += `@Data\n`;
      out += `public class ${cls.name} {\n`;
      cls.fields.forEach(f => {
        out += `    private ${f.type} ${f.name};\n`;
      });

      if (!lombok) {
        // 生成 getter / setter
        cls.fields.forEach(f => {
          const getter = 'get' + f.name.charAt(0).toUpperCase() + f.name.slice(1);
          const setter = 'set' + f.name.charAt(0).toUpperCase() + f.name.slice(1);
          out += `\n    public ${f.type} ${getter}() {\n        return ${f.name};\n    }\n`;
          out += `\n    public void ${setter}(${f.type} ${f.name}) {\n        this.${f.name} = ${f.name};\n    }\n`;
        });
      }

      out += '}\n';
    });

    return out.trim();
  }

  // ── Go 生成 ──
  function toGo(data, rootName, opts) {
    const structs = [];
    const { package: pkg } = opts;

    function inferType(val, suggestedName) {
      if (val === null) return 'interface{}';
      if (typeof val === 'boolean') return 'bool';
      if (typeof val === 'number') {
        return Number.isInteger(val) ? 'int' : 'float64';
      }
      if (typeof val === 'string') return 'string';
      if (Array.isArray(val)) {
        if (val.length === 0) return '[]interface{}';
        const itemType = inferType(val[0], suggestedName);
        return `[]${itemType}`;
      }
      if (typeof val === 'object') {
        const name = toClassName(suggestedName);
        collectStruct(val, name);
        return name;
      }
      return 'interface{}';
    }

    function collectStruct(obj, structName) {
      if (structs.some(s => s.name === structName)) return;
      const fields = [];
      for (const [key, val] of Object.entries(obj)) {
        const goField = toGoField(key);
        const type = inferType(val, key);
        fields.push({ type, name: goField, jsonTag: key });
      }
      structs.push({ name: structName, fields });
    }

    collectStruct(data, toClassName(rootName));

    let out = '';
    if (pkg) out += `package ${pkg}\n\n`;

    structs.forEach((st, idx) => {
      if (idx > 0) out += '\n';
      out += `type ${st.name} struct {\n`;
      st.fields.forEach(f => {
        const tag = ` \`json:"${f.jsonTag}"\``;
        out += `    ${f.name} ${f.type}${tag}\n`;
      });
      out += '}\n';
    });

    return out.trim();
  }

  // ── 辅助 ──
  function toClassName(str) {
    return str.replace(/[_-](.)/g, (_, c) => c.toUpperCase())
              .replace(/^[a-z]/, c => c.toUpperCase())
              .replace(/[^a-zA-Z0-9]/g, '');
  }

  function toJavaField(str) {
    return str.replace(/[_-](.)/g, (_, c) => c.toUpperCase())
              .replace(/^[A-Z]/, c => c.toLowerCase());
  }

  function toGoField(str) {
    const name = toClassName(str);
    return name;
  }

  // ── 操作 ──
  function doCopy() {
    if (!lastOutput) { showToast('没有可复制的内容', 'warning'); return; }
    copyToClipboard(lastOutput).then(ok => showToast(ok ? '已复制' : '复制失败', ok ? 'success' : 'error'));
  }

  function doClear() {
    el.jsonInput.value = '';
    resetResult();
    showToast('已清空', 'success');
  }

  function doSample() {
    el.jsonInput.value = SAMPLE_JSON;
    doConvert();
    showToast('已填入示例', 'success');
  }

  const ACTIONS = {
    convert: doConvert,
    copy: doCopy,
    clear: doClear,
    sample: doSample
  };

  init();

})();
