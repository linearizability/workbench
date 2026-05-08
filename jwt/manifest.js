/**
 * JWT 工具 — 元数据注册
 */

(function() {
  'use strict';

  if (typeof window.TOOL_REGISTRY === 'undefined') {
    console.warn('TOOL_REGISTRY not loaded, cannot register jwt tool');
    return;
  }

  window.TOOL_REGISTRY.register({
    id: 'jwt',
    name: 'JWT',
    icon: '🔑',
    description: '解析 JWT Token，提取 Header、Payload 和 Signature',

    inputs: [
      { name: 'token', type: 'string', label: 'JWT Token' }
    ],

    outputs: [
      { name: 'header', type: 'object', label: 'Header' },
      { name: 'payload', type: 'object', label: 'Payload' },
      { name: 'signature', type: 'string', label: 'Signature' },
      { name: 'text', type: 'string', label: '格式化文本' }
    ],

    params: [],

    batchable: false
  });

})();
