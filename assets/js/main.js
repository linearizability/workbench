/**
 * 主入口脚本
 */

(function() {
  'use strict';

  // 应用配置
  const APP_CONFIG = {
    name: 'Workbench',
    version: '1.0.0',
    storagePrefix: 'tools_'
  };

  // 初始化
  function init() {
    initTheme();
    initResponsive();
  }

  /**
   * 初始化主题
   */
  function initTheme() {
    const savedTheme = storage.get(APP_CONFIG.storagePrefix + 'theme', 'light');
    if (savedTheme === 'dark') {
      document.body.classList.add('dark-theme');
    }
  }

  /**
   * 初始化响应式处理
   */
  function initResponsive() {
    let resizeTimer;
    window.addEventListener('resize', debounce(() => {
      // 响应式逻辑
    }, 250));
  }

  // 启动
  init();

})();
