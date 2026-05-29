/**
 * 备忘录 — 元数据注册
 */

(function() {
  'use strict';

  if (typeof window.TOOL_REGISTRY === 'undefined') {
    console.warn('TOOL_REGISTRY not loaded, cannot register notepad tool');
    return;
  }

  window.TOOL_REGISTRY.register({
    id: 'notepad',
    name: '文本处理',
    icon: '📝',
    description: '文本分析、去重行、排序行',

    inputs: [
      { name: 'content', type: 'string', label: '输入内容' }
    ],

    outputs: [
      { name: 'text', type: 'string', label: '结果文本' },
      { name: 'wordCount', type: 'number', label: '单词数' },
      { name: 'lineCount', type: 'number', label: '行数' },
      { name: 'charCount', type: 'number', label: '字符数' }
    ],

    params: [
      {
        name: 'mode',
        type: 'select',
        label: '模式',
        options: [
          { value: 'analyze', label: '文本分析' },
          { value: 'dedupeLines', label: '去重行' },
          { value: 'sortLines', label: '排序行' }
        ],
        default: 'analyze'
      }
    ],

    batchable: false
  });

})();
