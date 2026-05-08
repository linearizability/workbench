/**
 * UUID 工具 — 元数据注册
 */

(function() {
  'use strict';

  if (typeof window.TOOL_REGISTRY === 'undefined') {
    console.warn('TOOL_REGISTRY not loaded, cannot register uuid tool');
    return;
  }

  window.TOOL_REGISTRY.register({
    id: 'uuid',
    name: 'UUID',
    icon: '🆔',
    description: '生成 UUID v4，支持批量生成、格式切换、大小写切换',

    inputs: [],

    outputs: [
      { name: 'text', type: 'string', label: 'UUID 文本' },
      { name: 'list', type: 'array', label: 'UUID 列表' }
    ],

    params: [
      {
        name: 'quantity',
        type: 'number',
        label: '生成数量',
        default: 1,
        min: 1,
        max: 100
      },
      {
        name: 'format',
        type: 'select',
        label: '格式',
        options: ['standard', 'plain'],
        default: 'standard'
      },
      {
        name: 'caseType',
        type: 'select',
        label: '大小写',
        options: ['lower', 'upper'],
        default: 'lower'
      }
    ],

    batchable: false
  });

})();
