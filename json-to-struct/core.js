/**
 * JSON 转 Struct — 核心逻辑（纯函数，不操作 DOM）
 */

(function() {
  'use strict';

  window.TOOL_JSON_TO_STRUCT_CORE = {
    /**
     * JSON 转 Java / Go 结构体
     * @param {Object} options — { input: { json }, params: { mode, className, package, lombok } }
     * @returns {Promise<{ output: { code, text }, error }>}
     */
    async run({ input, params }) {
      const raw = (input.json ?? '').trim();
      if (!raw) {
        return { output: null, error: '请输入 JSON' };
      }

      let data;
      try {
        data = JSON.parse(raw);
      } catch (err) {
        return { output: null, error: 'JSON 语法错误: ' + err.message };
      }

      const mode = params.mode || 'java';
      const className = (params.className ?? 'Root').trim() || 'Root';
      const pkg = (params.package ?? '').trim();

      try {
        let code;
        if (mode === 'java') {
          code = toJava(data, className, { package: pkg, lombok: params.lombok || false });
        } else {
          code = toGo(data, className, { package: pkg });
        }
        return { output: { code, text: code }, error: null };
      } catch (err) {
        return { output: null, error: '转换失败: ' + err.message };
      }
    }
  };

  // ── 内部函数 ──

  function toJava(data, rootClass, opts) {
    const classes = [];
    const { package: pkg, lombok } = opts;

    function inferType(val, suggestedName) {
      if (val === null) return 'Object';
      if (typeof val === 'boolean') return 'Boolean';
      if (typeof val === 'number') return Number.isInteger(val) ? 'Integer' : 'Double';
      if (typeof val === 'string') return 'String';
      if (Array.isArray(val)) {
        if (val.length === 0) return 'List<Object>';
        const itemType = inferType(val[0], suggestedName);
        return `List<${itemType}>`;
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
        fields.push({ type, name: fieldName });
      }
      classes.push({ name: className, fields });
    }

    collectClass(data, toClassName(rootClass));

    let out = '';
    if (pkg) out += `package ${pkg};\n\n`;
    out += lombok ? 'import lombok.Data;\nimport java.util.List;\n\n' : 'import java.util.List;\n\n';

    classes.forEach((cls, idx) => {
      if (idx > 0) out += '\n';
      if (lombok) out += `@Data\n`;
      out += `public class ${cls.name} {\n`;
      cls.fields.forEach(f => {
        out += `    private ${f.type} ${f.name};\n`;
      });
      if (!lombok) {
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

  function toGo(data, rootName, opts) {
    const structs = [];
    const { package: pkg } = opts;

    function inferType(val, suggestedName) {
      if (val === null) return 'interface{}';
      if (typeof val === 'boolean') return 'bool';
      if (typeof val === 'number') return Number.isInteger(val) ? 'int' : 'float64';
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
        const goField = toClassName(key);
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
        out += `    ${f.name} ${f.type} \`json:"${f.jsonTag}"\`\n`;
      });
      out += '}\n';
    });

    return out.trim();
  }

  function toClassName(str) {
    return str.replace(/[_-](.)/g, (_, c) => c.toUpperCase())
              .replace(/^[a-z]/, c => c.toUpperCase())
              .replace(/[^a-zA-Z0-9]/g, '');
  }

  function toJavaField(str) {
    return str.replace(/[_-](.)/g, (_, c) => c.toUpperCase())
              .replace(/^[A-Z]/, c => c.toLowerCase());
  }

})();
