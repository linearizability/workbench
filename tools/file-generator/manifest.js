/**
 * 文件生成器 — 元数据注册
 */

(function() {
  'use strict';

  if (typeof window.TOOL_REGISTRY === 'undefined') {
    console.warn('TOOL_REGISTRY not loaded, cannot register file-generator tool');
    return;
  }

  window.TOOL_REGISTRY.register({
    id: 'file-generator',
    name: '文件生成',
    icon: '📄',
    description: '生成常用文件内容，支持模板和自定义内容',

    inputs: [
      { name: 'content', type: 'string', label: '文件内容' },
      { name: 'filename', type: 'string', label: '文件名' }
    ],

    outputs: [
      { name: 'content', type: 'string', label: '文件内容' },
      { name: 'filename', type: 'string', label: '文件名' },
      { name: 'mime', type: 'string', label: 'MIME 类型' },
      { name: 'text', type: 'string', label: '文本内容' }
    ],

    params: [
      {
        name: 'template',
        type: 'select',
        label: '模板',
        options: [
          { value: 'blank', label: '空白' },
          { value: 'json-config', label: 'JSON 配置' },
          { value: 'csv-sample', label: 'CSV 示例' },
          { value: 'readme', label: 'README' },
          { value: 'gitignore', label: '.gitignore' },
          { value: 'env', label: '.env' }
        ],
        default: 'blank'
      }
    ],

    batchable: false
  });

})();
