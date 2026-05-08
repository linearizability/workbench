/**
 * 正则工具 — 元数据注册
 */

(function() {
  'use strict';

  if (typeof window.TOOL_REGISTRY === 'undefined') {
    console.warn('TOOL_REGISTRY not loaded, cannot register regex tool');
    return;
  }

  window.TOOL_REGISTRY.register({
    id: 'regex',
    name: '正则',
    icon: '🔢',
    description: '正则表达式匹配，返回匹配结果列表',

    inputs: [
      { name: 'pattern', type: 'string', label: '正则表达式' },
      { name: 'text', type: 'string', label: '测试文本' }
    ],

    outputs: [
      { name: 'matches', type: 'array', label: '匹配结果' },
      { name: 'count', type: 'number', label: '匹配数量' },
      { name: 'text', type: 'string', label: '匹配文本' }
    ],

    params: [
      {
        name: 'flags',
        type: 'text',
        label: '标志',
        default: 'g'
      }
    ],

    batchable: false
  });

})();
