/**
 * 文件生成器 — 核心逻辑（纯函数，不操作 DOM）
 */

(function() {
  'use strict';

  const TEMPLATES = {
    blank: { filename: 'output.txt', mime: 'text/plain', content: '' },
    'json-config': {
      filename: 'config.json',
      mime: 'application/json',
      content: JSON.stringify({
        name: 'my-app',
        version: '1.0.0',
        env: 'dev',
        features: { debug: true, telemetry: false }
      }, null, 2)
    },
    'csv-sample': {
      filename: 'data.csv',
      mime: 'text/csv',
      content: 'id,name,role\n1,Alice,Admin\n2,Bob,Developer\n3,Carol,QA'
    },
    readme: {
      filename: 'README.md',
      mime: 'text/markdown',
      content: '# 项目名称\n\n## 简介\n- 这里写一句话介绍\n\n## 使用方式\n```bash\n# 安装依赖\n# 运行命令\n```\n\n## 目录结构\n- `src/` 源码\n- `docs/` 文档'
    },
    gitignore: {
      filename: '.gitignore',
      mime: 'text/plain',
      content: 'node_modules/\ndist/\nbuild/\n.DS_Store\n*.log\n.env\n.env.*\n.idea/\n.vscode/'
    },
    env: {
      filename: '.env',
      mime: 'text/plain',
      content: '# 示例：本地环境变量\nNODE_ENV=development\nAPI_BASE_URL=https://api.example.com\nFEATURE_FLAG_EXAMPLE=true'
    }
  };

  window.TOOL_FILE_GENERATOR_CORE = {
    /**
     * 生成文件内容
     * @param {Object} options — { input: { content, filename }, params: { template } }
     * @returns {Promise<{ output: { content, filename, mime }, error }>}
     */
    async run({ input, params }) {
      const templateKey = params.template || 'blank';
      const tpl = TEMPLATES[templateKey] || TEMPLATES.blank;

      const content = input.content !== undefined ? input.content : tpl.content;
      const filename = (input.filename ?? tpl.filename).trim() || 'output.txt';
      const mime = guessMimeByFilename(filename) || tpl.mime;

      return {
        output: { content, filename, mime, text: content },
        error: null
      };
    }
  };

  // ── 内部函数 ──

  function guessMimeByFilename(filename) {
    const name = (filename || '').toLowerCase();
    if (name.endsWith('.json')) return 'application/json';
    if (name.endsWith('.csv')) return 'text/csv';
    if (name.endsWith('.md')) return 'text/markdown';
    if (name.endsWith('.yaml') || name.endsWith('.yml')) return 'text/yaml';
    if (name.endsWith('.xml')) return 'application/xml';
    if (name.endsWith('.txt') || name.endsWith('.log')) return 'text/plain';
    return 'text/plain';
  }

})();
