/**
 * Unicode 编解码工具 — 元数据注册
 */

(function() {
  'use strict';

  if (typeof window.TOOL_REGISTRY === 'undefined') {
    console.warn('TOOL_REGISTRY not loaded, cannot register unicode tool');
    return;
  }

  window.TOOL_REGISTRY.register({
    id: 'unicode',
    name: 'Unicode',
    icon: '🔤',
    description: 'Unicode 编码与解码，支持多种格式',

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
        options: [
          { value: 'encode', label: '编码' },
          { value: 'decode', label: '解码' }
        ],
        default: 'encode'
      },
      {
        name: 'format',
        type: 'select',
        label: '编码格式',
        options: [
          { value: '\\uXXXX', label: '\\uXXXX' },
          { value: '\\u{X}', label: '\\u{X}' },
          { value: 'U+XXXX', label: 'U+XXXX' },
          { value: '0xXXXX', label: '0xXXXX' },
          { value: '&#x;', label: '&#xXXXX;' },
          { value: '%uXXXX', label: '%uXXXX' }
        ],
        default: '\\uXXXX'
      }
    ],

    batchable: false
  });

})();