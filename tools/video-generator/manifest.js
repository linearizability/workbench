/**
 * 视频生成器 — 元数据注册
 */

(function() {
  'use strict';

  if (typeof window.TOOL_REGISTRY === 'undefined') {
    console.warn('TOOL_REGISTRY not loaded, cannot register video-generator tool');
    return;
  }

  window.TOOL_REGISTRY.register({
    id: 'video-generator',
    name: '视频生成',
    icon: '🎬',
    description: '生成测试视频（渐变/棋盘格/纯色），支持 WebM 格式',

    inputs: [
      { name: 'filename', type: 'string', label: '文件名' }
    ],

    outputs: [
      { name: 'filename', type: 'string', label: '文件名' },
      { name: 'format', type: 'string', label: '视频格式' },
      { name: 'duration', type: 'number', label: '时长（秒）' },
      { name: 'size', type: 'string', label: '分辨率' }
    ],

    params: [
      {
        name: 'contentType',
        type: 'select',
        label: '绘制内容',
        options: [
          { value: 'gradient', label: '渐变' },
          { value: 'checkerboard', label: '棋盘格' },
          { value: 'solid', label: '纯色' }
        ],
        default: 'gradient'
      },
      { name: 'width', type: 'number', label: '宽度', default: 640, min: 16, max: 1920 },
      { name: 'height', type: 'number', label: '高度', default: 360, min: 16, max: 1080 },
      { name: 'duration', type: 'number', label: '时长（秒）', default: 5, min: 1, max: 60 },
      { name: 'fps', type: 'number', label: '帧率', default: 30, min: 1, max: 60 },
      { name: 'color1', type: 'text', label: '颜色 1', default: '#3b82f6' },
      { name: 'color2', type: 'text', label: '颜色 2', default: '#ef4444' },
      { name: 'squareSize', type: 'number', label: '格子大小', default: 40, min: 4, max: 200 }
    ],

    batchable: false
  });

})();
