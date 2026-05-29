/**
 * SVG 工具 — 元数据注册
 */

(function() {
  'use strict';

  if (typeof window.TOOL_REGISTRY === 'undefined') {
    console.warn('TOOL_REGISTRY not loaded, cannot register svg-editor tool');
    return;
  }

  window.TOOL_REGISTRY.register({
    id: 'svg-editor',
    name: 'SVG',
    icon: '🎨',
    description: 'SVG 格式化与压缩',

    inputs: [
      { name: 'svg', type: 'string', label: 'SVG 内容' }
    ],

    outputs: [
      { name: 'svg', type: 'string', label: 'SVG 结果' },
      { name: 'text', type: 'string', label: '文本结果' }
    ],

    params: [
      {
        name: 'mode',
        type: 'select',
        label: '模式',
        options: [
          { value: 'format', label: '格式化' },
          { value: 'minify', label: '压缩' }
        ],
        default: 'format'
      }
    ],

    batchable: false
  });

})();
