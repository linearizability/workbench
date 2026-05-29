/**
 * 时间戳工具 — 元数据注册
 */

(function() {
  'use strict';

  if (typeof window.TOOL_REGISTRY === 'undefined') {
    console.warn('TOOL_REGISTRY not loaded, cannot register timestamp tool');
    return;
  }

  window.TOOL_REGISTRY.register({
    id: 'timestamp',
    name: '时间戳',
    icon: '⏱️',
    description: '时间戳与日期时间互转',

    inputs: [
      { name: 'value', type: 'string', label: '输入值' }
    ],

    outputs: [
      { name: 'text', type: 'string', label: '主要结果' },
      { name: 'iso', type: 'string', label: 'ISO 格式' },
      { name: 'utc', type: 'string', label: 'UTC 格式' },
      { name: 'seconds', type: 'number', label: '秒级时间戳' },
      { name: 'millis', type: 'number', label: '毫秒级时间戳' }
    ],

    params: [
      {
        name: 'mode',
        type: 'select',
        label: '模式',
        options: [
          { value: 'tsToDate', label: '时间戳 → 日期' },
          { value: 'dateToTs', label: '日期 → 时间戳' }
        ],
        default: 'tsToDate'
      },
      {
        name: 'unit',
        type: 'select',
        label: '单位（仅 ts→date）',
        options: [
          { value: 'auto', label: '自动' },
          { value: 'seconds', label: '秒' },
          { value: 'millis', label: '毫秒' }
        ],
        default: 'auto',
        visibleWhen: { mode: 'tsToDate' }
      }
    ],

    batchable: false
  });

})();
