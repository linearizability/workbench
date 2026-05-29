/**
 * 密码生成器 — 元数据注册
 */

(function() {
  'use strict';

  if (typeof window.TOOL_REGISTRY === 'undefined') {
    console.warn('TOOL_REGISTRY not loaded, cannot register password-generator tool');
    return;
  }

  window.TOOL_REGISTRY.register({
    id: 'password-generator',
    name: '密码生成器',
    icon: '🔑',
    description: '生成安全随机密码，支持自定义字符集、强度评估、批量生成',

    inputs: [],

    outputs: [
      { name: 'text', type: 'string', label: '密码文本' },
      { name: 'list', type: 'array', label: '密码列表' },
      { name: 'strength', type: 'object', label: '强度评估' }
    ],

    params: [
      {
        name: 'length',
        type: 'number',
        label: '密码长度',
        default: 16,
        min: 4,
        max: 128
      },
      {
        name: 'useUpper',
        type: 'select',
        label: '大写字母',
        options: [
          { value: 'true', label: '包含' },
          { value: 'false', label: '不包含' }
        ],
        default: 'true'
      },
      {
        name: 'useLower',
        type: 'select',
        label: '小写字母',
        options: [
          { value: 'true', label: '包含' },
          { value: 'false', label: '不包含' }
        ],
        default: 'true'
      },
      {
        name: 'useDigits',
        type: 'select',
        label: '数字',
        options: [
          { value: 'true', label: '包含' },
          { value: 'false', label: '不包含' }
        ],
        default: 'true'
      },
      {
        name: 'useSymbols',
        type: 'select',
        label: '符号',
        options: [
          { value: 'true', label: '包含' },
          { value: 'false', label: '不包含' }
        ],
        default: 'true'
      },
      {
        name: 'excludeAmbiguous',
        type: 'select',
        label: '排除易混淆字符',
        options: [
          { value: 'true', label: '是' },
          { value: 'false', label: '否' }
        ],
        default: 'false'
      },
      {
        name: 'excludeChars',
        type: 'string',
        label: '自定义排除字符',
        default: ''
      },
      {
        name: 'quantity',
        type: 'number',
        label: '生成数量',
        default: 1,
        min: 1,
        max: 100
      }
    ],

    batchable: false
  });

})();
