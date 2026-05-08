/**
 * 图片生成器 — 元数据注册
 */

(function() {
  'use strict';

  if (typeof window.TOOL_REGISTRY === 'undefined') {
    console.warn('TOOL_REGISTRY not loaded, cannot register image-generator tool');
    return;
  }

  window.TOOL_REGISTRY.register({
    id: 'image-generator',
    name: '占位图',
    icon: '🖼️',
    description: '生成占位图片 SVG',

    inputs: [
      { name: 'text', type: 'string', label: '图片文字' }
    ],

    outputs: [
      { name: 'svg', type: 'string', label: 'SVG 图片' },
      { name: 'text', type: 'string', label: '标签文本' }
    ],

    params: [
      {
        name: 'width',
        type: 'number',
        label: '宽度',
        default: 800,
        min: 1,
        max: 4096
      },
      {
        name: 'height',
        type: 'number',
        label: '高度',
        default: 450,
        min: 1,
        max: 4096
      },
      {
        name: 'bg',
        type: 'text',
        label: '背景色',
        default: '#1d4ed8'
      },
      {
        name: 'fg',
        type: 'text',
        label: '文字色',
        default: '#ffffff'
      }
    ],

    batchable: false
  });

})();
