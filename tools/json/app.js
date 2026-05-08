/**
 * JSON 工具 - 核心逻辑
 */

(function() {
  'use strict';

  // 常量定义
  const STORAGE_KEY = 'json_tool_history';
  const INDENT_MAP = {
    '2': 2,
    '4': 4,
    'tab': '\t'
  };

  // 状态管理
  let state = {
    inputJson: null,
    formattedOutput: '',
    isValid: false,
    errorMessage: ''
  };

  // DOM 元素缓存
  const elements = {};

  /**
   * 初始化
   */
  function init() {
    cacheElements();
    bindEvents();
    resetOnLoad();
  }

  /**
   * 缓存 DOM 元素
   */
  function cacheElements() {
    elements.inputEditor = document.getElementById('input-editor');
    elements.outputEditor = document.getElementById('output-editor');
    elements.indentSelect = document.getElementById('indent-select');
    elements.inputInfo = document.getElementById('input-info');
    elements.outputInfo = document.getElementById('output-info');
    elements.validationStatus = document.getElementById('validation-status');
    elements.jsonStats = document.getElementById('json-stats');
    elements.queryInput = document.getElementById('query-input');
    elements.queryResult = document.getElementById('query-result');
    elements.buttons = document.querySelectorAll('button[data-action]');
    elements.fileInput = document.getElementById('file-input');
    elements.editorDropZone = document.getElementById('editor-drop-zone');
  }

  /**
   * 绑定事件
   */
  function bindEvents() {
    // 输入框变化监听
    elements.inputEditor.addEventListener('input', debounce(handleInputChange, 300));

    // 按钮点击事件
    elements.buttons.forEach(button => {
      button.addEventListener('click', handleButtonClick);
    });

    // 查询输入监听
    elements.queryInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleQuery();
      }
    });

    // Tab 键支持
    elements.inputEditor.addEventListener('keydown', handleTabKey);

    // 文件上传
    elements.fileInput.addEventListener('change', handleFileSelect);

    // 拖放支持
    elements.editorDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      elements.editorDropZone.classList.add('is-dragover');
    });

    elements.editorDropZone.addEventListener('dragleave', (e) => {
      // 仅在真正离开容器时移除
      if (!elements.editorDropZone.contains(e.relatedTarget)) {
        elements.editorDropZone.classList.remove('is-dragover');
      }
    });

    elements.editorDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      elements.editorDropZone.classList.remove('is-dragover');
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) {
        readFileContent(file);
      }
    });
  }

  /**
   * 处理输入变化
   */
  function handleInputChange() {
    const input = elements.inputEditor.value.trim();
    updateInputInfo(input);

    if (!input) {
      clearOutput();
      updateValidationStatus('waiting');
      updateStats(null);
      return;
    }

    try {
      const parsed = JSON.parse(input);
      state.inputJson = parsed;
      state.isValid = true;
      state.errorMessage = '';
      updateValidationStatus('valid');
      updateStats(parsed);
    } catch (err) {
      state.inputJson = null;
      state.isValid = false;
      state.errorMessage = err.message;
      updateValidationStatus('invalid', err.message);
      updateStats(null);
    }
  }

  /**
   * 处理按钮点击
   */
  async function handleButtonClick(e) {
    const action = e.currentTarget.dataset.action;
    const handler = ACTIONS[action];

    if (handler) {
      await handler();
    }
  }

  /**
   * 处理 Tab 键
   */
  function handleTabKey(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = elements.inputEditor.selectionStart;
      const end = elements.inputEditor.selectionEnd;
      const value = elements.inputEditor.value;

      elements.inputEditor.value = value.substring(0, start) + '  ' + value.substring(end);
      elements.inputEditor.selectionStart = elements.inputEditor.selectionEnd = start + 2;
    }
  }

  /**
   * 更新输入信息
   */
  function updateInputInfo(value) {
    elements.inputInfo.textContent = `${value.length} 字符`;
  }

  /**
   * 更新输出信息
   */
  function updateOutputInfo(value) {
    elements.outputInfo.textContent = `${value.length} 字符`;
  }

  /**
   * 更新验证状态
   */
  function updateValidationStatus(status, message = '') {
    const icon = elements.validationStatus.querySelector('.status-icon');
    const text = elements.validationStatus.querySelector('.status-text');

    icon.classList.remove('valid', 'invalid');

    const statusMap = {
      waiting: { text: '等待输入' },
      valid: { text: 'JSON 有效' },
      invalid: { text: `无效: ${message}` }
    };

    const config = statusMap[status];
    text.textContent = config.text;

    if (status === 'valid') {
      icon.classList.add('valid');
    } else if (status === 'invalid') {
      icon.classList.add('invalid');
    }
  }

  /**
   * 更新统计信息
   */
  function updateStats(json) {
    if (!json) {
      elements.jsonStats.querySelector('.stats-value').textContent = '-';
      return;
    }

    const stats = analyzeJson(json);
    elements.jsonStats.querySelector('.stats-value').textContent =
      `${stats.objects} 对象, ${stats.arrays} 数组, ${stats.strings} 字符串, ${stats.numbers} 数字, ${stats.booleans} 布尔, ${stats.nulls} null`;
  }

  /**
   * 分析 JSON 结构
   */
  function analyzeJson(obj, result = { objects: 0, arrays: 0, strings: 0, numbers: 0, booleans: 0, nulls: 0 }) {
    if (obj === null) {
      result.nulls++;
      return result;
    }

    const type = typeof obj;

    switch (type) {
      case 'object':
        if (Array.isArray(obj)) {
          result.arrays++;
          obj.forEach(item => analyzeJson(item, result));
        } else {
          result.objects++;
          Object.values(obj).forEach(value => analyzeJson(value, result));
        }
        break;
      case 'string':
        result.strings++;
        break;
      case 'number':
        result.numbers++;
        break;
      case 'boolean':
        result.booleans++;
        break;
    }

    return result;
  }

  /**
   * 清空输出
   */
  function clearOutput() {
    elements.outputEditor.innerHTML = '<div class="placeholder">结果将显示在这里...</div>';
    state.formattedOutput = '';
    updateOutputInfo('');
  }

  /**
   * 显示输出
   */
  function displayOutput(json) {
    if (!json) {
      clearOutput();
      return;
    }

    const indent = getIndent();
    let formatted;

    try {
      formatted = JSON.stringify(json, null, indent);
      state.formattedOutput = formatted;
      updateOutputInfo(formatted);

      // 使用 Prism 高亮（若未加载则降级为纯文本）
      if (typeof Prism !== 'undefined' && Prism.languages && Prism.languages.json) {
        const highlighted = Prism.highlight(formatted, Prism.languages.json, 'json');
        elements.outputEditor.innerHTML = `<pre><code>${highlighted}</code></pre>`;
      } else {
        elements.outputEditor.textContent = formatted;
      }
    } catch (err) {
      showToast('格式化失败: ' + err.message, 'error');
    }
  }

  /**
   * 获取缩进
   */
  function getIndent() {
    const value = elements.indentSelect.value;
    return INDENT_MAP[value] || 2;
  }

  /**
   * 处理查询
   */
  function handleQuery() {
    const query = elements.queryInput.value.trim();

    if (!query || !state.inputJson) {
      elements.queryResult.innerHTML = '<div class="placeholder">请输入有效的 JSON 和查询路径</div>';
      return;
    }

    try {
      const result = queryJson(state.inputJson, query);
      elements.queryResult.textContent = JSON.stringify(result, null, 2);
    } catch (err) {
      elements.queryResult.innerHTML = `<div class="placeholder" style="color: var(--color-danger);">查询错误: ${err.message}</div>`;
    }
  }

  /**
   * 查询 JSON
   */
  function queryJson(obj, path) {
    let result = obj;
    const parts = path.split('.');

    for (const part of parts) {
      // 处理数组索引
      const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, key, index] = arrayMatch;
        result = result[key];
        result = result[parseInt(index, 10)];
      } else {
        result = result[part];
      }

      if (result === undefined) {
        throw new Error(`路径 "${part}" 不存在`);
      }
    }

    return result;
  }

  /**
   * 加载历史记录
   */
  function resetOnLoad() {
    // 优化：默认不自动回填上次输入，避免每次打开页面都残留内容
    elements.inputEditor.value = '';
    elements.queryInput.value = '';
    clearOutput();
    updateValidationStatus('waiting');
    updateStats(null);
    elements.queryResult.innerHTML = '<div class="placeholder">查询结果将显示在这里...</div>';
    state.inputJson = null;
    state.isValid = false;
    state.formattedOutput = '';
    state.errorMessage = '';
  }

  /**
   * 保存历史记录
   */
  function saveHistory() {
    const input = elements.inputEditor.value.trim();
    if (!input) return;

    const history = storage.get(STORAGE_KEY, []);
    const newHistory = [input, ...history.filter(item => item !== input)].slice(0, 10);
    storage.set(STORAGE_KEY, newHistory);
  }

  // Core 逻辑已抽离到 core.js，此处保留 UI 层调用

  /**
   * 处理文件选择
   */
  function handleFileSelect(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    readFileContent(file);
    e.target.value = '';
  }

  /**
   * 读取文件内容并填入编辑器
   */
  function readFileContent(file) {
    // 文件大小限制：10MB
    if (file.size > 10 * 1024 * 1024) {
      showToast('文件过大，请选择 10MB 以内的文件', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result || '';
      elements.inputEditor.value = content;
      handleInputChange();
      showToast(`已导入文件：${file.name}`, 'success');
    };
    reader.onerror = () => {
      showToast('文件读取失败', 'error');
    };
    reader.readAsText(file);
  }

  // ── 通过 Core 执行 ──
  async function runCore(action, extraParams = {}) {
    if (!state.isValid) {
      showToast('请输入有效的 JSON', 'error');
      return;
    }
    const indent = elements.indentSelect.value;
    const result = await window.TOOL_JSON_CORE.run({
      input: { text: elements.inputEditor.value },
      params: { action, indent, ...extraParams }
    });
    if (result.error) {
      showToast(result.error, 'error');
      return;
    }
    if (action === 'validate') {
      showToast(result.output.text, 'success');
    } else if (action === 'compress') {
      elements.outputEditor.textContent = result.output.text;
      state.formattedOutput = result.output.text;
      updateOutputInfo(result.output.text);
      showToast('压缩成功', 'success');
      saveHistory();
    } else {
      displayOutput(result.output.parsed);
      state.formattedOutput = result.output.text;
      showToast('处理成功', 'success');
      saveHistory();
    }
  }

  // 动作处理器
  const ACTIONS = {
    // 格式化
    async format() { await runCore('format'); },

    // 压缩
    async minify() { await runCore('compress'); },

    // 验证
    async validate() {
      if (state.isValid) {
        showToast('JSON 格式正确', 'success');
      } else {
        showToast(state.errorMessage || 'JSON 格式错误', 'error');
      }
    },

    // 排序键名
    async sortKeys() { await runCore('sortKeys'); },
    async 'sort-keys'() { await runCore('sortKeys'); },

    // 转 XML
    async toXml() { await runCore('toXml'); },
    async 'to-xml'() { await runCore('toXml'); },

    // 转 YAML
    async toYaml() { await runCore('toYaml'); },
    async 'to-yaml'() { await runCore('toYaml'); },

    // 转 CSV
    async toCsv() { await runCore('toCsv'); },
    async 'to-csv'() { await runCore('toCsv'); },

    // 复制结果
    copy() {
      if (!state.formattedOutput) {
        showToast('没有可复制的内容', 'warning');
        return;
      }

      copyToClipboard(state.formattedOutput).then(success => {
        if (success) {
          showToast('复制成功', 'success');
        } else {
          showToast('复制失败', 'error');
        }
      });
    },

    // 下载
    download() {
      if (!state.formattedOutput) {
        showToast('没有可下载的内容', 'warning');
        return;
      }

      const filename = `json-output-${Date.now()}.json`;
      downloadFile(state.formattedOutput, filename, 'application/json');
      showToast('下载已开始', 'success');
    },

    // 清空
    clear() {
      elements.inputEditor.value = '';
      elements.queryInput.value = '';
      clearOutput();
      updateValidationStatus('waiting');
      updateStats(null);
      elements.queryResult.innerHTML = '<div class="placeholder">查询结果将显示在这里...</div>';
      state.inputJson = null;
      state.isValid = false;
      state.formattedOutput = '';
      showToast('已清空', 'success');
    },

    // 查询
    query() {
      handleQuery();
    },

    // 上传文件
    'upload-file'() {
      elements.fileInput.click();
    }
  };

  // 启动应用
  init();

})();
