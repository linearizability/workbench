/**
 * 通用工具函数库
 */

(function() {
  'use strict';

  /**
   * 防抖函数
   * @param {Function} func - 要防抖的函数
   * @param {number} wait - 等待时间（毫秒）
   * @returns {Function}
   */
  window.debounce = function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  /**
   * 节流函数
   * @param {Function} func - 要节流的函数
   * @param {number} wait - 等待时间（毫秒）
   * @returns {Function}
   */
  window.throttle = function throttle(func, wait) {
    let inThrottle;
    let lastFunc;
    let lastRan;
    return function executedFunction(...args) {
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        lastRan = Date.now();
        inThrottle = true;
      } else {
        clearTimeout(lastFunc);
        lastFunc = setTimeout(() => {
          if (Date.now() - lastRan >= wait) {
            func.apply(context, args);
            lastRan = Date.now();
          }
        }, wait - (Date.now() - lastRan));
      }
    };
  };

  /**
   * 复制到剪贴板
   * @param {string} text - 要复制的文本
   * @returns {Promise<boolean>}
   */
  window.copyToClipboard = function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text)
        .then(() => true)
        .catch(() => false);
    }

    // 降级方案
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return Promise.resolve(true);
    } catch (err) {
      document.body.removeChild(textarea);
      return Promise.resolve(false);
    }
  };

  /**
   * 格式化日期
   * @param {Date|string|number} date - 日期对象或时间戳
   * @param {string} format - 格式字符串 (YYYY-MM-DD HH:mm:ss)
   * @returns {string}
   */
  window.formatDate = function formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  };

  /**
   * 本地存储工具
   */
  window.storage = {
    /**
     * 设置存储
     * @param {string} key - 键名
     * @param {*} value - 值
     */
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (err) {
        console.error('Storage set error:', err);
      }
    },

    /**
     * 获取存储
     * @param {string} key - 键名
     * @param {*} defaultValue - 默认值
     * @returns {*}
     */
    get(key, defaultValue = null) {
      try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : defaultValue;
      } catch (err) {
        console.error('Storage get error:', err);
        return defaultValue;
      }
    },

    /**
     * 删除存储
     * @param {string} key - 键名
     */
    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch (err) {
        console.error('Storage remove error:', err);
      }
    },

    /**
     * 清空存储
     */
    clear() {
      try {
        localStorage.clear();
      } catch (err) {
        console.error('Storage clear error:', err);
      }
    }
  };

  /**
   * Toast 提示
   * @param {string} message - 提示消息
   * @param {string} type - 类型 (success, error, warning, info)
   * @param {number} duration - 显示时长（毫秒）
   */
  window.showToast = function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container')
      || (() => {
      const el = document.createElement('div');
      el.id = 'toast-container';
      el.style.cssText = `
        position: fixed;
        top: 1rem;
        right: 1rem;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      `;
      document.body.appendChild(el);
      return el;
    })();

    const typeColors = {
      success: '#22c55e',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#06b6d4'
    };

    const toast = document.createElement('div');
    toast.style.cssText = `
      padding: 0.75rem 1rem;
      background: white;
      color: ${typeColors[type]};
      border-left: 4px solid ${typeColors[type]};
      border-radius: 0.375rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      font-size: 0.875rem;
      animation: slideIn 0.3s ease;
      max-width: 300px;
    `;
    toast.textContent = message;

    // 添加动画样式
    if (!document.getElementById('toast-styles')) {
      const style = document.createElement('style');
      style.id = 'toast-styles';
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease forwards';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  };

  /**
   * 转义 HTML
   * @param {string} text - 要转义的文本
   * @returns {string}
   */
  window.escapeHtml = function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  /**
   * 下载文件
   * @param {string} content - 文件内容
   * @param {string} filename - 文件名
   * @param {string} mimeType - MIME 类型
   */
  window.downloadFile = function downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

})();
