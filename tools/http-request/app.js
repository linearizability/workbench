/**
 * HTTP 请求工具 - UI 层
 */

(function() {
  'use strict';

  const el = {};
  let codeMode = 'curl';
  let lastCode = '';

  function init() {
    cacheElements();
    bindEvents();
    updateCode();
  }

  function cacheElements() {
    el.method    = document.getElementById('http-method');
    el.url       = document.getElementById('http-url');
    el.bodyType  = document.getElementById('body-type');
    el.bodyRaw   = document.getElementById('body-raw');
    el.headerList= document.getElementById('header-list');
    el.formList  = document.getElementById('form-list');
    el.status    = document.getElementById('http-status');
    el.response  = document.getElementById('http-response');
    el.codeResult= document.getElementById('code-result');

    el.bodyRawWrapper  = document.getElementById('body-raw-wrapper');
    el.bodyFormWrapper = document.getElementById('body-form-wrapper');
    el.bodyNoneWrapper = document.getElementById('body-none-wrapper');
  }

  function bindEvents() {
    el.method.addEventListener('change', () => {
      toggleBodyByMethod();
      updateCode();
    });
    el.url.addEventListener('input', debounce(updateCode, 200));
    el.bodyType.addEventListener('change', toggleBodyType);
    el.bodyRaw.addEventListener('input', debounce(updateCode, 200));

    document.addEventListener('click', (e) => {
      const codeBtn = e.target.closest('[data-code]');
      if (codeBtn) { setCodeMode(codeBtn.dataset.code); return; }

      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const handler = ACTIONS[btn.dataset.action];
      if (handler) handler(e);
    });

    // Headers / Form 输入变化也更新代码
    el.headerList.addEventListener('input', debounce(updateCode, 200));
    el.formList.addEventListener('input', debounce(updateCode, 200));
  }

  // ── Body 类型切换 ──
  function toggleBodyType() {
    const type = el.bodyType.value;
    el.bodyRawWrapper.classList.toggle('u-hidden', type !== 'raw');
    el.bodyFormWrapper.classList.toggle('u-hidden', type !== 'form');
    el.bodyNoneWrapper.classList.toggle('u-hidden', type !== 'none');
    updateCode();
  }

  function toggleBodyByMethod() {
    const m = el.method.value;
    if (m === 'GET' || m === 'HEAD') {
      el.bodyType.value = 'none';
      toggleBodyType();
    }
  }

  // ── 发送请求 ──
  async function doSend() {
    if (!window.TOOL_HTTP_REQUEST_CORE) {
      showToast('HTTP 核心模块未加载', 'error');
      return;
    }

    const url = el.url.value.trim();
    if (!url) { showToast('请输入 URL', 'warning'); return; }

    const method = el.method.value;
    const headers = collectHeaders();
    let body = null;
    let bodyType = el.bodyType.value;

    if (bodyType === 'raw') {
      body = el.bodyRaw.value;
    } else if (bodyType === 'form') {
      body = collectForm();
    }

    el.status.textContent = '发送中…';
    el.status.style.color = 'var(--color-info)';

    const result = await window.TOOL_HTTP_REQUEST_CORE.run({
      input: {},
      params: { method, url, bodyType, body, headers, timeout: 30000 }
    });

    if (result.error) {
      renderError(result.error, result.output?.duration || 0);
      el.status.textContent = '请求失败';
      el.status.style.color = 'var(--color-danger)';
      return;
    }

    const data = result.output;
    renderResponse(data);
    el.status.textContent = `${data.status} ${data.statusText} · ${data.duration}ms`;
    el.status.style.color = data.ok ? 'var(--color-success)' : 'var(--color-danger)';
  }

  function renderResponse(data) {
    // 尝试格式化 JSON
    let bodyHtml = escapeHtml(data.body);
    try {
      const json = JSON.parse(data.body);
      bodyHtml = escapeHtml(JSON.stringify(json, null, 2));
    } catch {
      // 不是 JSON，保持原样
    }

    let headerHtml = '';
    for (const [key, val] of Object.entries(data.headers)) {
      headerHtml += `<div class="http-resp-header"><span class="http-resp-hkey">${escapeHtml(key)}:</span> <span class="http-resp-hval">${escapeHtml(val)}</span></div>`;
    }

    let html = `<div class="http-resp-meta">
      <span class="http-resp-status ${data.ok ? 'is-ok' : 'is-err'}">${data.status} ${escapeHtml(data.statusText)}</span>
      <span class="http-resp-time">${data.duration}ms</span>
    </div>`;

    html += `<div class="http-resp-section-title">响应头</div>`;
    html += `<div class="http-resp-headers">${headerHtml || '<span class="placeholder">无响应头</span>'}</div>`;

    html += `<div class="http-resp-section-title">响应体</div>`;
    html += `<pre class="http-resp-body"><code>${bodyHtml}</code></pre>`;

    el.response.innerHTML = html;
  }

  function renderError(errMessage, duration) {
    let tip = '';
    if (/CORS|fetch|Failed to fetch|NetworkError/i.test(errMessage)) {
      tip = `<div class="http-cors-tip">
        <strong>请求被浏览器安全策略阻止（CORS）</strong><br>
        目标服务器未配置跨域响应头，浏览器禁止前端 JavaScript 直接访问。<br>
        请使用下方生成的 <strong>curl</strong> 命令在终端中执行。
      </div>`;
    }

    let html = `<div class="http-resp-meta">
      <span class="http-resp-status is-err">请求失败</span>
      <span class="http-resp-time">${duration}ms</span>
    </div>`;
    html += `<div class="http-resp-error">${escapeHtml(errMessage)}</div>`;
    if (tip) html += tip;
    el.response.innerHTML = html;
  }

  // ── 代码生成 ──
  function setCodeMode(m) {
    codeMode = m;
    document.querySelectorAll('[data-code]').forEach(b => b.classList.toggle('is-active', b.dataset.code === m));
    updateCode();
  }

  function updateCode() {
    const method = el.method.value;
    const url = el.url.value.trim() || 'https://api.example.com/users';
    const headers = collectHeaders();
    let body = null;

    if (el.bodyType.value === 'raw') {
      body = el.bodyRaw.value;
    } else if (el.bodyType.value === 'form') {
      body = collectForm();
    }

    let code = '';
    if (codeMode === 'curl') {
      code = genCurl(method, url, headers, body);
    } else if (codeMode === 'python') {
      code = genPython(method, url, headers, body);
    } else {
      code = genJava(method, url, headers, body);
    }

    lastCode = code;
    el.codeResult.innerHTML = `<pre class="http-code"><code>${escapeHtml(code)}</code></pre>`;
  }

  function genCurl(method, url, headers, body) {
    let cmd = `curl -X ${method}`;
    for (const [k, v] of Object.entries(headers)) {
      cmd += ` \\\n  -H "${k}: ${v.replace(/"/g, '\\"')}"`;
    }
    if (body) {
      if (typeof body === 'string') {
        cmd += ` \\\n  -d '${body.replace(/'/g, "'\\''")}'`;
      } else {
        const pairs = Object.entries(body).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
        cmd += ` \\\n  -d "${pairs}"`;
      }
    }
    cmd += ` \\\n  "${url}"`;
    return cmd;
  }

  function genPython(method, url, headers, body) {
    let code = `import requests\n\n`;
    code += `url = "${url}"\n`;
    if (Object.keys(headers).length) {
      code += `headers = {\n`;
      for (const [k, v] of Object.entries(headers)) {
        code += `    "${k}": "${v}",\n`;
      }
      code += `}\n`;
    }
    if (body) {
      if (typeof body === 'string') {
        code += `data = r'''${body}'''\n`;
      } else {
        code += `data = {\n`;
        for (const [k, v] of Object.entries(body)) {
          code += `    "${k}": "${v}",\n`;
        }
        code += `}\n`;
      }
    }
    code += `\nresponse = requests.${method.toLowerCase()}(url`;
    if (Object.keys(headers).length) code += `, headers=headers`;
    if (body) code += `, data=data`;
    code += `)\n\nprint(response.status_code)\nprint(response.text)`;
    return code;
  }

  function genJava(method, url, headers, body) {
    let code = `import java.net.http.HttpClient;\n`;
    code += `import java.net.http.HttpRequest;\n`;
    code += `import java.net.http.HttpResponse;\n`;
    code += `import java.net.URI;\n`;
    code += `import java.time.Duration;\n\n`;
    code += `public class Main {\n`;
    code += `    public static void main(String[] args) throws Exception {\n`;
    code += `        HttpClient client = HttpClient.newBuilder()\n`;
    code += `            .connectTimeout(Duration.ofSeconds(10))\n`;
    code += `            .build();\n\n`;
    code += `        HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()\n`;
    code += `            .uri(URI.create("${url}"))\n`;
    code += `            .method("${method}", `;

    if (body) {
      if (typeof body === 'string') {
        code += `HttpRequest.BodyPublishers.ofString("""\n${body}\n""")`;
      } else {
        const pairs = Object.entries(body).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
        code += `HttpRequest.BodyPublishers.ofString("${pairs}")`;
      }
    } else {
      code += `HttpRequest.BodyPublishers.noBody()`;
    }
    code += `);\n`;

    for (const [k, v] of Object.entries(headers)) {
      code += `        requestBuilder.header("${k}", "${v}");\n`;
    }

    code += `\n        HttpResponse<String> response = client.send(\n`;
    code += `            requestBuilder.build(),\n`;
    code += `            HttpResponse.BodyHandlers.ofString()\n`;
    code += `        );\n\n`;
    code += `        System.out.println(response.statusCode());\n`;
    code += `        System.out.println(response.body());\n`;
    code += `    }\n`;
    code += `}`;
    return code;
  }

  // ── 收集数据 ──
  function collectHeaders() {
    const h = {};
    el.headerList.querySelectorAll('.http-kv-row').forEach(row => {
      const key = row.querySelector('.http-kv-key').value.trim();
      const val = row.querySelector('.http-kv-val').value.trim();
      if (key) h[key] = val;
    });
    return h;
  }

  function collectForm() {
    const f = {};
    el.formList.querySelectorAll('.http-kv-row').forEach(row => {
      const key = row.querySelector('.http-kv-key').value.trim();
      const val = row.querySelector('.http-kv-val').value.trim();
      if (key) f[key] = val;
    });
    return f;
  }

  // ── 动态行操作 ──
  function doAddHeader() {
    const row = document.createElement('div');
    row.className = 'http-kv-row';
    row.innerHTML = `<input type="text" class="http-kv-key" placeholder="Key"><input type="text" class="http-kv-val" placeholder="Value"><button class="http-kv-del" data-action="del-header">&times;</button>`;
    el.headerList.appendChild(row);
    row.querySelector('.http-kv-key').focus();
  }

  function doDelHeader(e) {
    const row = e.target.closest('.http-kv-row');
    if (row) row.remove();
    updateCode();
  }

  function doAddForm() {
    const row = document.createElement('div');
    row.className = 'http-kv-row';
    row.innerHTML = `<input type="text" class="http-kv-key" placeholder="Key"><input type="text" class="http-kv-val" placeholder="Value"><button class="http-kv-del" data-action="del-form">&times;</button>`;
    el.formList.appendChild(row);
    row.querySelector('.http-kv-key').focus();
  }

  function doDelForm(e) {
    const row = e.target.closest('.http-kv-row');
    if (row) row.remove();
    updateCode();
  }

  // ── 操作 ──
  function doClear() {
    el.url.value = '';
    el.bodyRaw.value = '';
    el.bodyType.value = 'none';
    toggleBodyType();
    el.headerList.innerHTML = `
      <div class="http-kv-row">
        <input type="text" class="http-kv-key" placeholder="Key" value="Content-Type">
        <input type="text" class="http-kv-val" placeholder="Value" value="application/json">
        <button class="http-kv-del" data-action="del-header">&times;</button>
      </div>`;
    el.formList.innerHTML = `
      <div class="http-kv-row">
        <input type="text" class="http-kv-key" placeholder="Key">
        <input type="text" class="http-kv-val" placeholder="Value">
        <button class="http-kv-del" data-action="del-form">&times;</button>
      </div>`;
    el.response.innerHTML = '<div class="placeholder">点击「发送」发起请求…</div>';
    el.status.textContent = '未发送';
    el.status.style.color = '';
    updateCode();
    showToast('已清空', 'success');
  }

  function doCopyCode() {
    if (!lastCode) { showToast('没有可复制的内容', 'warning'); return; }
    copyToClipboard(lastCode).then(ok => showToast(ok ? '已复制' : '复制失败', ok ? 'success' : 'error'));
  }

  const ACTIONS = {
    send: doSend,
    clear: doClear,
    'add-header': doAddHeader,
    'del-header': doDelHeader,
    'add-form': doAddForm,
    'del-form': doDelForm,
    'copy-code': doCopyCode
  };

  init();

})();
