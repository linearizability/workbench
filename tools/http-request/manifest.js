/**
 * HTTP 请求 — 元数据注册
 */

(function() {
  'use strict';

  if (typeof window.TOOL_REGISTRY === 'undefined') {
    console.warn('TOOL_REGISTRY not loaded, cannot register http-request tool');
    return;
  }

  window.TOOL_REGISTRY.register({
    id: 'http-request',
    name: 'HTTP 请求',
    icon: '🌐',
    description: '发送 HTTP 请求并获取响应结果',

    inputs: [
      { name: 'url', type: 'string', label: '请求 URL' },
      { name: 'body', type: 'string', label: '请求体' }
    ],

    outputs: [
      { name: 'body', type: 'string', label: '响应体' },
      { name: 'status', type: 'number', label: '状态码' },
      { name: 'statusText', type: 'string', label: '状态文本' },
      { name: 'ok', type: 'boolean', label: '是否成功' },
      { name: 'headers', type: 'object', label: '响应头' },
      { name: 'duration', type: 'number', label: '耗时(ms)' }
    ],

    params: [
      {
        name: 'method',
        type: 'select',
        label: '请求方法',
        options: [
          { value: 'GET', label: 'GET' },
          { value: 'POST', label: 'POST' },
          { value: 'PUT', label: 'PUT' },
          { value: 'DELETE', label: 'DELETE' },
          { value: 'PATCH', label: 'PATCH' },
          { value: 'HEAD', label: 'HEAD' },
          { value: 'OPTIONS', label: 'OPTIONS' }
        ],
        default: 'GET'
      },
      {
        name: 'url',
        type: 'text',
        label: 'URL',
        default: ''
      },
      {
        name: 'bodyType',
        type: 'select',
        label: 'Body 类型',
        options: [
          { value: 'none', label: '无' },
          { value: 'raw', label: '原始文本' },
          { value: 'form', label: '表单' }
        ],
        default: 'none'
      },
      {
        name: 'body',
        type: 'text',
        label: 'Body 内容',
        default: ''
      },
      {
        name: 'headers',
        type: 'text',
        label: 'Headers (JSON)',
        default: '{}'
      },
      {
        name: 'timeout',
        type: 'number',
        label: '超时(ms)',
        default: '30000'
      }
    ],

    batchable: true
  });

})();
