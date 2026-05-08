/**
 * 链接工具 — 元数据注册
 */

(function() {
  'use strict';

  if (typeof window.TOOL_REGISTRY === 'undefined') {
    console.warn('TOOL_REGISTRY not loaded, cannot register links tool');
    return;
  }

  window.TOOL_REGISTRY.register({
    id: 'links',
    name: '链接',
    icon: '🔗',
    description: 'URL 解析与格式化',

    inputs: [
      { name: 'url', type: 'string', label: 'URL' }
    ],

    outputs: [
      { name: 'name', type: 'string', label: '站点名称' },
      { name: 'url', type: 'string', label: 'URL' },
      { name: 'hostname', type: 'string', label: '主机名' },
      { name: 'pathname', type: 'string', label: '路径' },
      { name: 'text', type: 'string', label: '文本' }
    ],

    params: [],

    batchable: false
  });

})();
