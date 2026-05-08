/**
 * MD5 工具 — 元数据注册
 */

(function() {
  'use strict';

  if (typeof window.TOOL_REGISTRY === 'undefined') {
    console.warn('TOOL_REGISTRY not loaded, cannot register md5 tool');
    return;
  }

  window.TOOL_REGISTRY.register({
    id: 'md5',
    name: 'MD5',
    icon: '#️⃣',
    description: '计算文本的 MD5 哈希值',

    inputs: [
      { name: 'text', type: 'string', label: '输入文本' }
    ],

    outputs: [
      { name: 'hash', type: 'string', label: 'MD5 哈希值' },
      { name: 'text', type: 'string', label: '结果文本' }
    ],

    params: [
      {
        name: 'uppercase',
        type: 'checkbox',
        label: '大写输出',
        default: false
      }
    ],

    batchable: false
  });

})();
