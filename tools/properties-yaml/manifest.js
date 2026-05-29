/**
 * Properties ↔ YAML — 元数据注册
 */

(function() {
  'use strict';

  if (typeof window.TOOL_REGISTRY === 'undefined') {
    console.warn('TOOL_REGISTRY not loaded, cannot register properties-yaml tool');
    return;
  }

  window.TOOL_REGISTRY.register({
    id: 'properties-yaml',
    name: 'Properties↔YAML',
    icon: '⚙️',
    description: 'Properties 与 YAML 格式互转',

    inputs: [
      { name: 'text', type: 'string', label: '输入文本' }
    ],

    outputs: [
      { name: 'text', type: 'string', label: '转换结果' }
    ],

    params: [
      {
        name: 'mode',
        type: 'select',
        label: '转换方向',
        options: [
          { value: 'toYaml', label: '转 YAML' },
          { value: 'toProperties', label: '转 Properties' }
        ],
        default: 'toYaml'
      },
      {
        name: 'preserveStrings',
        type: 'checkbox',
        label: '保留字符串',
        default: false
      },
      {
        name: 'sortKeys',
        type: 'checkbox',
        label: '排序键',
        default: false
      }
    ],

    batchable: false
  });

})();
