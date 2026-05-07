/**
 * 工具注册中心 — 所有工具注册到此，供工作流引擎查找和调用
 */

(function() {
  'use strict';

  const _tools = new Map();

  window.TOOL_REGISTRY = {
    /**
     * 注册工具
     * @param {Object} manifest — 工具元数据
     */
    register(manifest) {
      if (!manifest.id) throw new Error('Tool manifest must have an id');
      _tools.set(manifest.id, manifest);
    },

    /**
     * 获取工具元数据
     */
    get(id) {
      return _tools.get(id);
    },

    /**
     * 列出所有已注册工具
     */
    list() {
      return Array.from(_tools.values());
    },

    /**
     * 加载指定工具的 Core 模块
     */
    async loadCore(id) {
      const manifest = this.get(id);
      if (!manifest) throw new Error(`Tool "${id}" not registered`);

      const globalName = `TOOL_${id.toUpperCase().replace(/-/g, '_')}_CORE`;
      if (window[globalName]) return window[globalName];

      // 动态加载 core.js
      await this._loadScript(`../${id}/core.js`);

      if (!window[globalName]) {
        throw new Error(`Tool "${id}" core.js did not register ${globalName}`);
      }
      return window[globalName];
    },

    _loadScript(src) {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(script);
      });
    }
  };

})();
