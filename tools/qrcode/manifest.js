/**
 * 二维码工具 — 元数据注册
 */

(function() {
  'use strict';

  if (typeof window.TOOL_REGISTRY === 'undefined') {
    console.warn('TOOL_REGISTRY not loaded, cannot register qrcode tool');
    return;
  }

  window.TOOL_REGISTRY.register({
    id: 'qrcode',
    name: '二维码',
    icon: '📱',
    description: '将文本转换为二维码 SVG',

    inputs: [
      { name: 'text', type: 'string', label: '二维码内容' }
    ],

    outputs: [
      { name: 'svg', type: 'string', label: '二维码 SVG' },
      { name: 'text', type: 'string', label: '原始文本' }
    ],

    params: [
      {
        name: 'size',
        type: 'number',
        label: '尺寸',
        default: 256,
        min: 64,
        max: 1024
      },
      {
        name: 'ecLevel',
        type: 'select',
        label: '纠错级别',
        options: [
          { value: 'L', label: '低 (L)' },
          { value: 'M', label: '中 (M)' },
          { value: 'Q', label: '较高 (Q)' },
          { value: 'H', label: '高 (H)' }
        ],
        default: 'M'
      },
      {
        name: 'fgColor',
        type: 'text',
        label: '前景色',
        default: '#000000'
      },
      {
        name: 'bgColor',
        type: 'text',
        label: '背景色',
        default: '#ffffff'
      },
      {
        name: 'margin',
        type: 'number',
        label: '边距',
        default: 4,
        min: 0,
        max: 10
      }
    ],

    batchable: false
  });

})();
