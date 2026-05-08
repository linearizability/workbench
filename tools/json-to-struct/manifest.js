/**
 * JSON 转 Struct — 元数据注册
 */

(function() {
  'use strict';

  if (typeof window.TOOL_REGISTRY === 'undefined') {
    console.warn('TOOL_REGISTRY not loaded, cannot register json-to-struct tool');
    return;
  }

  window.TOOL_REGISTRY.register({
    id: 'json-to-struct',
    name: 'JSON→Struct',
    icon: '📐',
    description: 'JSON 转 Java / Go 结构体代码',

    inputs: [
      { name: 'json', type: 'string', label: 'JSON 文本' }
    ],

    outputs: [
      { name: 'code', type: 'string', label: '结构体代码' },
      { name: 'text', type: 'string', label: '代码文本' }
    ],

    params: [
      {
        name: 'mode',
        type: 'select',
        label: '目标语言',
        options: ['java', 'go'],
        default: 'java'
      },
      {
        name: 'className',
        type: 'text',
        label: '类名',
        default: 'Root'
      },
      {
        name: 'package',
        type: 'text',
        label: '包名',
        default: ''
      },
      {
        name: 'lombok',
        type: 'checkbox',
        label: '使用 Lombok',
        default: false,
        visibleWhen: { mode: 'java' }
      }
    ],

    batchable: false
  });

})();
