/**
 * 文本对比 — 元数据注册
 */

(function() {
  'use strict';

  if (typeof window.TOOL_REGISTRY === 'undefined') {
    console.warn('TOOL_REGISTRY not loaded, cannot register diff tool');
    return;
  }

  window.TOOL_REGISTRY.register({
    id: 'diff',
    name: '文本对比',
    icon: '🔄',
    description: '比较两段文本的差异，支持行级、词级、字符级对比',

    inputs: [
      { name: 'oldText', type: 'string', label: '原始文本' },
      { name: 'newText', type: 'string', label: '新文本' }
    ],

    outputs: [
      { name: 'text', type: 'string', label: '格式化对比文本' },
      { name: 'changes', type: 'array', label: '差异结果数组' },
      { name: 'stats', type: 'object', label: '统计信息' },
      { name: 'oldText', type: 'string', label: '原始文本（透传）' },
      { name: 'newText', type: 'string', label: '新文本（透传）' }
    ],

    params: [
      {
        name: 'mode',
        type: 'select',
        label: '对比模式',
        options: [
          { value: 'lines', label: '行级对比' },
          { value: 'words', label: '词级对比' },
          { value: 'chars', label: '字符级对比' }
        ],
        default: 'lines'
      }
    ],

    batchable: false
  });

})();
