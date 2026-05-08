/**
 * HTTP 请求 — 核心逻辑（纯函数，不操作 DOM）
 */

(function() {
  'use strict';

  window.TOOL_HTTP_REQUEST_CORE = {
    /**
     * 发送 HTTP 请求
     * @param {Object} options — { input: { url?, body? }, params: { method, url, bodyType, body, headers, timeout } }
     * @returns {Promise<{ output: { ok, status, statusText, headers, body, duration }, error }>}
     */
    async run({ input, params }) {
      const method = params.method || 'GET';
      const url = (input.url ?? params.url ?? '').trim();
      const timeout = Number(params.timeout) || 30000;

      if (!url) {
        return { output: null, error: 'URL 不能为空' };
      }

      // 解析 headers
      let headers = {};
      if (params.headers) {
        if (typeof params.headers === 'object' && !Array.isArray(params.headers)) {
          headers = params.headers;
        } else if (typeof params.headers === 'string') {
          try {
            headers = JSON.parse(params.headers);
          } catch {
            return { output: null, error: 'Headers 格式错误，应为 JSON 对象' };
          }
        }
      }

      // 处理 body
      let body = null;
      const bodyType = params.bodyType || 'none';

      if (method !== 'GET' && method !== 'HEAD' && bodyType !== 'none') {
        const rawBody = input.body ?? params.body ?? '';

        if (bodyType === 'raw') {
          body = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
          if (body && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
          }
        } else if (bodyType === 'form') {
          if (typeof rawBody === 'string') {
            body = rawBody;
          } else if (typeof rawBody === 'object' && rawBody !== null) {
            body = new URLSearchParams(rawBody).toString();
          }
          headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
      }

      // 发送请求
      const start = performance.now();
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        const fetchOpts = { method, headers, signal: controller.signal };
        if (body !== null) fetchOpts.body = body;

        const res = await fetch(url, fetchOpts);
        clearTimeout(timer);

        const duration = Math.round(performance.now() - start);
        let bodyText = '';
        try {
          bodyText = await res.text();
        } catch {
          bodyText = '(无法读取响应体)';
        }

        // 收集响应头
        const responseHeaders = {};
        res.headers.forEach((val, key) => {
          responseHeaders[key] = val;
        });

        return {
          output: {
            ok: res.ok,
            status: res.status,
            statusText: res.statusText,
            headers: responseHeaders,
            body: bodyText,
            duration
          },
          error: null
        };
      } catch (err) {
        const duration = Math.round(performance.now() - start);
        const message = err.name === 'AbortError'
          ? `请求超时（超过 ${timeout}ms）`
          : err.message;
        return {
          output: { ok: false, status: 0, statusText: '请求失败', headers: {}, body: '', duration },
          error: message
        };
      }
    }
  };

})();
