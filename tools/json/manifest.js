/**
 * JSON 工具 — 元数据注册
 */

(function() {
  'use strict';

  if (typeof window.TOOL_REGISTRY === 'undefined') {
    console.warn('TOOL_REGISTRY not loaded, cannot register json tool');
    return;
  }

  window.TOOL_REGISTRY.register({
    id: 'json',
    name: 'JSON 工具',
    icon: '📝',
    description: '格式化、压缩、验证、转换和操作 JSON 数据',

    inputs: [
      { name: 'text', type: 'string', label: 'JSON 文本', required: true }
    ],

    outputs: [
      { name: 'text', type: 'string', label: '处理后的文本' },
      { name: 'parsed', type: 'object', label: '解析后的对象' },
      { name: 'error', type: 'string', label: '错误信息' }
    ],

    params: [
      {
        name: 'action',
        type: 'select',
        label: '操作',
        options: [
          { value: 'format', label: '格式化' },
          { value: 'compress', label: '压缩' },
          { value: 'compressEscape', label: '压缩并转义' },
          { value: 'validate', label: '验证' },
          { value: 'sortKeys', label: '排序键名' },
          { value: 'toXml', label: '转 XML' },
          { value: 'toYaml', label: '转 YAML' },
          { value: 'toCsv', label: '转 CSV' },
          { value: 'escape', label: '转义' },
          { value: 'unescape', label: '反转义' }
        ],
        default: 'format'
      },
      {
        name: 'indent',
        type: 'select',
        label: '缩进',
        options: [
          { value: '2', label: '2 空格' },
          { value: '4', label: '4 空格' },
          { value: 'tab', label: '制表符' }
        ],
        default: '2',
        visibleWhen: { action: 'format' }
      }
    ],

    batchable: false
  });

})();
