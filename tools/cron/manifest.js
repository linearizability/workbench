/**
 * Cron 工具 — 元数据注册
 */

(function() {
  'use strict';

  if (typeof window.TOOL_REGISTRY === 'undefined') {
    console.warn('TOOL_REGISTRY not loaded, cannot register cron tool');
    return;
  }

  window.TOOL_REGISTRY.register({
    id: 'cron',
    name: 'Cron',
    icon: '⏰',
    description: '解析和生成 Cron 表达式，查看自然语言描述和下次执行时间',

    inputs: [
      { name: 'expression', type: 'string', label: 'Cron 表达式' }
    ],

    outputs: [
      { name: 'description', type: 'string', label: '自然语言描述' },
      { name: 'expression', type: 'string', label: '表达式' },
      { name: 'nextRuns', type: 'array', label: '未来执行时间' },
      { name: 'text', type: 'string', label: '描述文本' }
    ],

    params: [
      {
        name: 'mode',
        type: 'select',
        label: '模式',
        options: ['parse', 'generate'],
        default: 'parse'
      }
    ],

    batchable: false
  });

})();
