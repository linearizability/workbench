/**
 * URL 工具 — 元数据注册
 */

(function() {
  'use strict';

  if (typeof window.TOOL_REGISTRY === 'undefined') {
    console.warn('TOOL_REGISTRY not loaded, cannot register url tool');
    return;
  }

  window.TOOL_REGISTRY.register({
    id: 'url',
    name: 'URL',
    icon: '🔗',
    description: 'URL 编码、解码与 QueryString 解析',

    inputs: [
      { name: 'text', type: 'string', label: '输入文本' }
    ],

    outputs: [
      { name: 'text', type: 'string', label: '处理结果' },
      { name: 'entries', type: 'array', label: 'Query 参数列表' }
    ],

    params: [
      {
        name: 'mode',
        type: 'select',
        label: '模式',
        options: ['encode', 'decode', 'query'],
        default: 'encode'
      }
    ],

    batchable: false
  });

})();
