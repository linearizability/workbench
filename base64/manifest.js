/**
 * Base64 工具 — 元数据注册
 */

(function() {
  'use strict';

  if (typeof window.TOOL_REGISTRY === 'undefined') {
    console.warn('TOOL_REGISTRY not loaded, cannot register base64 tool');
    return;
  }

  window.TOOL_REGISTRY.register({
    id: 'base64',
    name: 'Base64',
    icon: '🔐',
    description: 'Base64 编码与解码，支持 URL Safe 模式',

    inputs: [
      { name: 'text', type: 'string', label: '输入文本' }
    ],

    outputs: [
      { name: 'text', type: 'string', label: '处理结果' }
    ],

    params: [
      {
        name: 'mode',
        type: 'select',
        label: '模式',
        options: ['encode', 'decode'],
        default: 'encode'
      },
      {
        name: 'urlSafe',
        type: 'checkbox',
        label: 'URL Safe',
        default: false
      }
    ],

    batchable: false
  });

})();
