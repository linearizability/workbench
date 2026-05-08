/**
 * 文件生成器 - 核心逻辑
 */

(function() {
  'use strict';

  const templates = {
    blank: {
      filename: 'output.txt',
      mime: 'text/plain',
      content: ''
    },
    'json-config': {
      filename: 'config.json',
      mime: 'application/json',
      content: JSON.stringify({
        name: 'my-app',
        version: '1.0.0',
        env: 'dev',
        features: {
          debug: true,
          telemetry: false
        }
      }, null, 2)
    },
    'csv-sample': {
      filename: 'data.csv',
      mime: 'text/csv',
      content: [
        'id,name,role',
        '1,Alice,Admin',
        '2,Bob,Developer',
        '3,Carol,QA'
      ].join('\n')
    },
    readme: {
      filename: 'README.md',
      mime: 'text/markdown',
      content: [
        '# 项目名称',
        '',
        '## 简介',
        '- 这里写一句话介绍',
        '',
        '## 使用方式',
        '```bash',
        '# 安装依赖',
        '# 运行命令',
        '```',
        '',
        '## 目录结构',
        '- `src/` 源码',
        '- `docs/` 文档'
      ].join('\n')
    },
    gitignore: {
      filename: '.gitignore',
      mime: 'text/plain',
      content: [
        'node_modules/',
        'dist/',
        'build/',
        '.DS_Store',
        '*.log',
        '.env',
        '.env.*',
        '.idea/',
        '.vscode/'
      ].join('\n')
    },
    env: {
      filename: '.env',
      mime: 'text/plain',
      content: [
        '# 示例：本地环境变量',
        'NODE_ENV=development',
        'API_BASE_URL=https://api.example.com',
        'FEATURE_FLAG_EXAMPLE=true'
      ].join('\n')
    }
  };

  const elements = {};

  function init() {
    cacheElements();
    bindEvents();
    applyTemplate('blank', { toast: false });
  }

  function cacheElements() {
    elements.templateSelect = document.getElementById('template-select');
    elements.filename = document.getElementById('filename');
    elements.mime = document.getElementById('mime');
    elements.content = document.getElementById('content');
    elements.contentInfo = document.getElementById('content-info');
    elements.buttons = document.querySelectorAll('[data-action]');
  }

  function bindEvents() {
    elements.buttons.forEach(btn => btn.addEventListener('click', handleButtonClick));
    elements.content.addEventListener('input', debounce(updateContentInfo, 100));
    elements.filename.addEventListener('input', debounce(() => {}, 0));
    elements.mime.addEventListener('input', debounce(() => {}, 0));
  }

  function handleButtonClick(e) {
    const action = e.currentTarget.dataset.action;
    const handler = ACTIONS[action];
    if (handler) handler();
  }

  function updateContentInfo() {
    const value = elements.content.value || '';
    elements.contentInfo.textContent = `${value.length} 字符`;
  }

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

  function applyTemplate(key, opts = {}) {
    const { toast = true } = opts;
    const tpl = templates[key] || templates.blank;

    elements.filename.value = tpl.filename;
    elements.mime.value = tpl.mime;
    elements.content.value = tpl.content;
    updateContentInfo();

    if (toast) showToast('模板已应用', 'success');
  }

  function normalizeFilename(name) {
    const trimmed = (name || '').trim();
    return trimmed || 'output.txt';
  }

  function normalizeMimeType(mime, filename) {
    const trimmed = (mime || '').trim();
    return trimmed || guessMimeByFilename(filename);
  }

  const ACTIONS = {
    'apply-template'() {
      const key = elements.templateSelect.value;
      applyTemplate(key);
    },

    download() {
      const filename = normalizeFilename(elements.filename.value);
      const mime = normalizeMimeType(elements.mime.value, filename);
      const content = elements.content.value || '';

      downloadFile(content, filename, mime);
      showToast('下载已开始', 'success');
    },

    copy() {
      const content = elements.content.value || '';
      if (!content) {
        showToast('没有可复制的内容', 'warning');
        return;
      }

      copyToClipboard(content).then(ok => {
        showToast(ok ? '复制成功' : '复制失败', ok ? 'success' : 'error');
      });
    },

    clear() {
      elements.content.value = '';
      updateContentInfo();
      showToast('已清空', 'success');
    }
  };

  init();
})();

