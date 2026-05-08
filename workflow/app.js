/**
 * 工作流编排 — 画布渲染、节点拖拽、连线绘制
 */

(function () {
  'use strict';

  const el = {};
  const state = {
    nodes: [],      // { id, tool, x, y, params }
    edges: [],      // { from, to, fromOutput, toInput }
    selectedNode: null,
    selectedEdge: null,   // index in state.edges
    nextId: 1,
    dragging: null,       // { id, offsetX, offsetY }
    drawingEdge: null,    // { fromId, fromOutput, svgPath }
    autoRun: { enabled: false, timerId: null, nextRun: null }
  };

  const TOOL_MANIFESTS = []; // 已加载的工具元数据

  async function init() {
    cacheElements();
    await loadToolManifests();
    renderToolList();
    bindEvents();
    updateSavedList();
    tryAutoLoad();
  }

  function cacheElements() {
    el.toolList = document.getElementById('tool-list');
    el.canvas = document.getElementById('workflow-canvas');
    el.svg = document.getElementById('workflow-svg');
    el.nodesLayer = document.getElementById('workflow-nodes');
    el.props = document.getElementById('workflow-props');
    el.logsBody = document.getElementById('workflow-logs-body');
    el.resultsBody = document.getElementById('workflow-results-body');
    el.savedSelect = document.getElementById('workflow-saved-select');
    el.autoRunToggle = document.getElementById('auto-run-toggle');
    el.autoRunMode = document.getElementById('auto-run-mode');
    el.autoRunExpr = document.getElementById('auto-run-expr');
    el.autoRunCountdown = document.getElementById('auto-run-countdown');
  }

  // ── 加载工具清单 ──
  async function loadToolManifests() {
    // 阶段 2：加载 JSON、Diff、HTTP 请求工具
    await loadScript('../tools/json/manifest.js');
    await loadScript('../tools/diff/manifest.js');
    await loadScript('../tools/http-request/manifest.js');
    // 阶段 3：加载 Base64、UUID、MD5、URL、JWT、Timestamp 工具
    await loadScript('../tools/base64/manifest.js');
    await loadScript('../tools/uuid/manifest.js');
    await loadScript('../tools/md5/manifest.js');
    await loadScript('../tools/url/manifest.js');
    await loadScript('../tools/jwt/manifest.js');
    await loadScript('../tools/timestamp/manifest.js');
    // 阶段 3（续）：加载剩余工具
    await loadScript('../tools/cron/manifest.js');
    await loadScript('../tools/qrcode/manifest.js');
    await loadScript('../tools/regex/manifest.js');
    await loadScript('../tools/file-generator/manifest.js');
    await loadScript('../tools/image-generator/manifest.js');
    await loadScript('../tools/properties-yaml/manifest.js');
    await loadScript('../tools/svg-editor/manifest.js');
    await loadScript('../tools/json-to-struct/manifest.js');
    await loadScript('../notepad/manifest.js');
    await loadScript('../links/manifest.js');

    const toolIds = ['json', 'diff', 'http-request', 'base64', 'uuid', 'md5', 'url', 'jwt', 'timestamp',
      'cron', 'qrcode', 'regex', 'file-generator', 'image-generator', 'properties-yaml',
      'svg-editor', 'json-to-struct', 'notepad', 'links'];
    toolIds.forEach(id => {
      const tool = window.TOOL_REGISTRY.get(id);
      if (tool) TOOL_MANIFESTS.push(tool);
    });

    // 注册内置条件分支工具
    TOOL_MANIFESTS.push({
      id: '__condition',
      name: '条件分支',
      icon: '🔀',
      description: '根据条件表达式决定输出 true 或 false 分支',
      inputs: [{ name: 'data', label: '输入数据' }],
      outputs: [
        { name: 'true', label: '满足条件' },
        { name: 'false', label: '不满足条件' }
      ],
      params: [
        { name: 'expression', label: '条件表达式', default: 'input.data' }
      ]
    });

    // 注册内置循环处理工具
    TOOL_MANIFESTS.push({
      id: '__foreach',
      name: '循环处理',
      icon: '🔄',
      description: '对数组的每个元素执行表达式，返回结果数组',
      inputs: [{ name: 'items', label: '数组数据' }],
      outputs: [
        { name: 'results', label: '结果数组' }
      ],
      params: [
        { name: 'expression', label: '处理表达式', default: 'item' }
      ]
    });
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // ── 本地存储：已保存工作流 ──
  const SAVED_WORKFLOWS_KEY = 'workflow_saved_list';
  const AUTO_SAVE_KEY = 'workflow_auto_save';

  function getSavedWorkflows() {
    try {
      return storage.get(SAVED_WORKFLOWS_KEY, {});
    } catch {
      return {};
    }
  }

  function saveWorkflowLocal(name) {
    if (!name) return;
    const data = {
      nodes: state.nodes.map(n => ({
        id: n.id,
        tool: n.tool,
        name: n.name,
        icon: n.icon,
        x: n.x,
        y: n.y,
        params: n.params,
        initialInputs: n.initialInputs
      })),
      edges: state.edges
    };
    const saved = getSavedWorkflows();
    saved[name] = { data, savedAt: Date.now() };
    storage.set(SAVED_WORKFLOWS_KEY, saved);
    storage.set(AUTO_SAVE_KEY, name);
    updateSavedList();
    showToast(`已保存到本地: ${name}`, 'success');
  }

  function loadWorkflowLocal(name) {
    const saved = getSavedWorkflows();
    const entry = saved[name];
    if (!entry || !entry.data) {
      showToast('工作流不存在', 'error');
      return;
    }
    applyWorkflowData(entry.data);
    storage.set(AUTO_SAVE_KEY, name);
    showToast(`已加载: ${name}`, 'success');
  }

  function deleteWorkflowLocal(name) {
    const saved = getSavedWorkflows();
    if (!saved[name]) {
      showToast('工作流不存在', 'warning');
      return;
    }
    delete saved[name];
    storage.set(SAVED_WORKFLOWS_KEY, saved);
    const lastAuto = storage.get(AUTO_SAVE_KEY, '');
    if (lastAuto === name) storage.remove(AUTO_SAVE_KEY);
    updateSavedList();
    showToast(`已删除: ${name}`, 'success');
  }

  function updateSavedList() {
    if (!el.savedSelect) return;
    const saved = getSavedWorkflows();
    const names = Object.keys(saved).sort();
    let html = '<option value="">已保存的工作流…</option>';
    names.forEach(name => {
      html += `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`;
    });
    el.savedSelect.innerHTML = html;
  }

  function tryAutoLoad() {
    const lastName = storage.get(AUTO_SAVE_KEY, '');
    if (lastName) {
      const saved = getSavedWorkflows();
      if (saved[lastName]) {
        loadWorkflowLocal(lastName);
      }
    }
  }

  function doSaveLocal() {
    const name = prompt('请输入工作流名称（保存到本地浏览器）:', 'workflow-1');
    if (!name || !name.trim()) return;
    saveWorkflowLocal(name.trim());
  }

  function doDeleteLocal() {
    if (!el.savedSelect) return;
    const name = el.savedSelect.value;
    if (!name) { showToast('请先从下拉列表选择一个工作流', 'warning'); return; }
    if (!confirm(`确定删除本地工作流 "${name}" 吗？`)) return;
    deleteWorkflowLocal(name);
  }

  function applyWorkflowData(data) {
    if (data.nodes) state.nodes = data.nodes;
    if (data.edges) state.edges = data.edges;
    // 更新 nextId 避免 ID 冲突
    const maxId = state.nodes.reduce((max, n) => {
      const num = parseInt(n.id.replace(/^n/, ''), 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, 0);
    state.nextId = maxId + 1;
    // 重新渲染
    el.nodesLayer.innerHTML = '';
    el.svg.innerHTML = '';
    state.nodes.forEach(n => renderNode(n));
    renderEdges();
    renderProps();
    doClearLogs();
    doClearResults();
  }

  // ── 渲染左侧工具箱 ──
  function renderToolList() {
    if (!TOOL_MANIFESTS.length) {
      el.toolList.innerHTML = '<div class="placeholder">暂无可用工具</div>';
      return;
    }
    el.toolList.innerHTML = TOOL_MANIFESTS.map(t => `
      <div class="workflow-tool-item" data-tool="${t.id}" title="${t.description || ''}">
        <span class="workflow-tool-icon">${t.icon || '🔧'}</span>
        <span class="workflow-tool-name">${t.name}</span>
      </div>
    `).join('');
  }

  // ── 事件绑定 ──
  function bindEvents() {
    // 双击工具箱添加节点
    el.toolList.addEventListener('dblclick', (e) => {
      const item = e.target.closest('[data-tool]');
      if (item) addNode(item.dataset.tool);
    });

    // 画布拖拽与连线
    el.canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // 按钮
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const handler = ACTIONS[btn.dataset.action];
      if (handler) handler();
    });

    // 已保存工作流下拉列表
    if (el.savedSelect) {
      el.savedSelect.addEventListener('change', () => {
        const name = el.savedSelect.value;
        if (name) loadWorkflowLocal(name);
      });
    }

    // 自动执行控件
    if (el.autoRunToggle) {
      el.autoRunToggle.addEventListener('change', () => {
        if (el.autoRunToggle.checked) startAutoRun();
        else stopAutoRun();
      });
    }
    if (el.autoRunMode) {
      el.autoRunMode.addEventListener('change', () => {
        const mode = el.autoRunMode.value;
        if (el.autoRunExpr) el.autoRunExpr.placeholder = mode === 'interval' ? '5' : '0 9 * * *';
        if (state.autoRun.enabled) {
          if (state.autoRun.timerId) clearTimeout(state.autoRun.timerId);
          scheduleNext();
        }
      });
    }
    if (el.autoRunExpr) {
      el.autoRunExpr.addEventListener('change', () => {
        if (state.autoRun.enabled) {
          if (state.autoRun.timerId) clearTimeout(state.autoRun.timerId);
          scheduleNext();
        }
      });
    }

    // 页面卸载时清理定时器
    window.addEventListener('beforeunload', () => {
      if (state.autoRun.timerId) clearTimeout(state.autoRun.timerId);
    });

    // 每秒刷新倒计时显示
    setInterval(() => {
      if (state.autoRun.enabled && state.autoRun.nextRun) {
        updateAutoRunUI();
      }
    }, 1000);

    // 删除节点 / 连线
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // 若焦点在输入控件内，不触发节点删除
        const active = document.activeElement;
        if (active) {
          const tag = active.tagName;
          const isEditable = active.isContentEditable;
          if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || isEditable) {
            return;
          }
        }
        if (state.selectedNode) {
          removeNode(state.selectedNode);
        } else if (state.selectedEdge !== null) {
          removeEdge(state.selectedEdge);
        }
      }
    });
  }

  // ── 节点操作 ──
  function addNode(toolId) {
    const manifest = TOOL_MANIFESTS.find(t => t.id === toolId);
    if (!manifest) return;

    const id = 'n' + state.nextId++;
    const rect = el.canvas.getBoundingClientRect();
    const x = rect.width / 2 - 90 + (Math.random() * 40 - 20);
    const y = rect.height / 2 - 20 + (Math.random() * 40 - 20);

    const node = {
      id,
      tool: toolId,
      name: manifest.name,
      icon: manifest.icon || '🔧',
      x, y,
      params: buildDefaultParams(manifest.params),
      initialInputs: {}
    };

    state.nodes.push(node);
    renderNode(node);
    selectNode(id);
  }

  function buildDefaultParams(paramDefs) {
    const params = {};
    if (!paramDefs) return params;
    paramDefs.forEach(p => {
      params[p.name] = p.default;
    });
    return params;
  }

  // 节点常量
  const NODE_WIDTH = 180;
  const NODE_HEADER_H = 40;
  const PORT_START_Y = 14;   // 端口区内起始偏移（上下各留 14px padding）
  const PORT_SPACING = 22;   // 端口间距（稍微拉开一点）
  const PORT_RADIUS = 5;    // 端口圆半径

  function getPortY(portIndex, nodeId) {
    const div = nodeId ? document.getElementById(nodeId) : null;
    if (div) {
      const isExpanded = div.classList.contains('is-selected') || div.classList.contains('is-connecting');
      if (!isExpanded) {
        return NODE_HEADER_H / 2;
      }
    }
    return NODE_HEADER_H + PORT_START_Y + portIndex * PORT_SPACING + PORT_RADIUS;
  }

  function getNodeExpandedHeight(maxPorts) {
    return NODE_HEADER_H + maxPorts * PORT_SPACING + PORT_START_Y * 2;
  }

  function renderNode(node) {
    const manifest = TOOL_MANIFESTS.find(t => t.id === node.tool);
    const inputs = manifest?.inputs || [];
    const outputs = manifest?.outputs || [];

    const inputPorts = inputs.map((p, i) => `
      <div class="workflow-port workflow-port-in" data-port="${p.name}" title="${p.label}"
           style="top:${PORT_START_Y + i * PORT_SPACING}px">
        <span class="workflow-port-label">${p.label}</span>
      </div>
    `).join('');

    const outputPorts = outputs.map((p, i) => `
      <div class="workflow-port workflow-port-out" data-port="${p.name}" title="${p.label}"
           style="top:${PORT_START_Y + i * PORT_SPACING}px">
        <span class="workflow-port-label">${p.label}</span>
      </div>
    `).join('');

    const maxPorts = Math.max(inputs.length, outputs.length);
    const portsHeight = maxPorts * PORT_SPACING + PORT_START_Y * 2;

    const div = document.createElement('div');
    div.className = 'workflow-node';
    div.id = node.id;
    div.style.transform = `translate(${node.x}px, ${node.y}px)`;
    div.dataset.maxPorts = maxPorts;
    div.innerHTML = `
      <div class="workflow-node-header">
        <span class="workflow-node-icon">${node.icon}</span>
        <span class="workflow-node-name">${node.name}</span>
        <span class="workflow-node-status"></span>
      </div>
      <div class="workflow-node-ports" style="height: ${portsHeight}px;">
        ${inputPorts}
        ${outputPorts}
      </div>
    `;

    // 节点点击选中
    div.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('workflow-port')) return;
      e.stopPropagation();
      selectNode(node.id);
      state.dragging = { id: node.id, startX: e.clientX, startY: e.clientY, origX: node.x, origY: node.y };
    });

    // 端口 mousedown 开始连线
    div.querySelectorAll('.workflow-port').forEach(port => {
      port.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const isOut = port.classList.contains('workflow-port-out');
        if (isOut) {
          startDrawingEdge(node.id, port.dataset.port, e);
        }
      });

      port.addEventListener('mouseup', (e) => {
        e.stopPropagation();
        if (state.drawingEdge) {
          finishDrawingEdge(node.id, port.dataset.port, port.classList.contains('workflow-port-in'));
        }
      });
    });

    el.nodesLayer.appendChild(div);
  }

  function removeNode(id) {
    state.nodes = state.nodes.filter(n => n.id !== id);
    state.edges = state.edges.filter(e => e.from !== id && e.to !== id);
    const div = document.getElementById(id);
    if (div) div.remove();
    renderEdges();
    if (state.selectedNode === id) {
      state.selectedNode = null;
      renderProps();
    }
  }

  function selectNode(id) {
    state.selectedNode = id;
    document.querySelectorAll('.workflow-node').forEach(n => n.classList.toggle('is-selected', n.id === id));
    renderEdges();
    renderProps();
  }

  // ── 拖拽 ──
  function handleMouseDown(e) {
    if (e.target === el.canvas || e.target === el.svg || e.target.classList.contains('workflow-hint')) {
      state.selectedNode = null;
      state.selectedEdge = null;
      document.querySelectorAll('.workflow-node').forEach(n => n.classList.remove('is-selected'));
      el.svg.querySelectorAll('.workflow-edge').forEach(p => p.classList.remove('is-selected'));
      renderEdges();
      renderProps();
    }
  }

  function handleMouseMove(e) {
    // 节点拖拽
    if (state.dragging) {
      const node = state.nodes.find(n => n.id === state.dragging.id);
      if (node) {
        const dx = e.clientX - state.dragging.startX;
        const dy = e.clientY - state.dragging.startY;
        node.x = state.dragging.origX + dx;
        node.y = state.dragging.origY + dy;
        const div = document.getElementById(node.id);
        if (div) div.style.transform = `translate(${node.x}px, ${node.y}px)`;
        renderEdges();
      }
    }

    // 连线绘制
    if (state.drawingEdge) {
      updateDrawingEdge(e);
    }
  }

  function handleMouseUp() {
    state.dragging = null;
    if (state.drawingEdge) {
      // 如果未成功连接到目标端口，取消连线
      cancelDrawingEdge();
    }
  }

  // ── 连线 ──
  function startDrawingEdge(fromId, fromOutput, e) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'workflow-edge workflow-edge-drawing');
    el.svg.appendChild(path);
    state.drawingEdge = { fromId, fromOutput, path };
    document.querySelectorAll('.workflow-node').forEach(n => n.classList.add('is-connecting'));
    updateDrawingEdge(e);
  }

  function updateDrawingEdge(e) {
    if (!state.drawingEdge) return;
    const fromNode = state.nodes.find(n => n.id === state.drawingEdge.fromId);
    if (!fromNode) return;

    const fromManifest = TOOL_MANIFESTS.find(t => t.id === fromNode.tool);
    const fromOutputIndex = (fromManifest?.outputs || []).findIndex(o => o.name === state.drawingEdge.fromOutput);

    const fromX = fromNode.x + NODE_WIDTH + PORT_RADIUS; // 节点右边界 + 端口半径
    const fromY = fromNode.y + getPortY(fromOutputIndex >= 0 ? fromOutputIndex : 0, fromNode.id);
    const toX = e.clientX - el.canvas.getBoundingClientRect().left;
    const toY = e.clientY - el.canvas.getBoundingClientRect().top;
    const d = `M ${fromX} ${fromY} C ${fromX + 80} ${fromY}, ${toX - 80} ${toY}, ${toX} ${toY}`;
    state.drawingEdge.path.setAttribute('d', d);
  }

  function finishDrawingEdge(toId, toPort, isInPort) {
    if (!state.drawingEdge || !isInPort) {
      cancelDrawingEdge();
      return;
    }
    const { fromId, fromOutput } = state.drawingEdge;
    if (fromId === toId) {
      cancelDrawingEdge();
      return;
    }
    // 避免重复连线
    const exists = state.edges.some(e => e.from === fromId && e.to === toId && e.fromOutput === fromOutput && e.toInput === toPort);
    if (!exists) {
      state.edges.push({ from: fromId, to: toId, fromOutput, toInput: toPort });
    }
    cancelDrawingEdge();
    renderEdges();
  }

  function cancelDrawingEdge() {
    if (state.drawingEdge && state.drawingEdge.path) {
      state.drawingEdge.path.remove();
    }
    state.drawingEdge = null;
    document.querySelectorAll('.workflow-node').forEach(n => n.classList.remove('is-connecting'));
  }

  function renderEdges() {
    // 清除现有连线（保留 drawing 中的）
    el.svg.querySelectorAll('.workflow-edge:not(.workflow-edge-drawing)').forEach(p => p.remove());

    state.edges.forEach((edge, index) => {
      const fromNode = state.nodes.find(n => n.id === edge.from);
      const toNode = state.nodes.find(n => n.id === edge.to);
      if (!fromNode || !toNode) return;

      const fromManifest = TOOL_MANIFESTS.find(t => t.id === fromNode.tool);
      const toManifest = TOOL_MANIFESTS.find(t => t.id === toNode.tool);

      const fromOutputIndex = (fromManifest?.outputs || []).findIndex(o => o.name === edge.fromOutput);
      const toInputIndex = (toManifest?.inputs || []).findIndex(i => i.name === edge.toInput);

      const fromX = fromNode.x + NODE_WIDTH + PORT_RADIUS;
      const fromY = fromNode.y + getPortY(fromOutputIndex >= 0 ? fromOutputIndex : 0, fromNode.id);
      const toX = toNode.x - PORT_RADIUS;
      const toY = toNode.y + getPortY(toInputIndex >= 0 ? toInputIndex : 0, toNode.id);

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      let edgeClass = 'workflow-edge';
      if (fromNode.tool === '__condition') {
        edgeClass += edge.fromOutput === 'true' ? ' workflow-edge-true' : ' workflow-edge-false';
      }
      path.setAttribute('class', edgeClass);
      path.setAttribute('data-edge-index', index);
      path.setAttribute('d', `M ${fromX} ${fromY} C ${fromX + 80} ${fromY}, ${toX - 80} ${toY}, ${toX} ${toY}`);
      path.addEventListener('click', (e) => {
        e.stopPropagation();
        selectEdge(index);
      });
      el.svg.appendChild(path);
    });

    // 恢复选中状态
    if (state.selectedEdge !== null) {
      const path = el.svg.querySelector(`[data-edge-index="${state.selectedEdge}"]`);
      if (path) path.classList.add('is-selected');
    }
  }

  function selectEdge(index) {
    state.selectedEdge = index;
    state.selectedNode = null;
    document.querySelectorAll('.workflow-node').forEach(n => n.classList.remove('is-selected'));
    el.svg.querySelectorAll('.workflow-edge').forEach(p => p.classList.toggle('is-selected', Number(p.dataset.edgeIndex) === index));
    renderProps();
  }

  function removeEdge(index) {
    state.edges.splice(index, 1);
    state.selectedEdge = null;
    renderEdges();
    renderProps();
  }

  function updateNodeStatusBadges() {
    state.nodes.forEach(node => {
      const div = document.getElementById(node.id);
      if (!div) return;
      const badge = div.querySelector('.workflow-node-status');
      if (!badge) return;

      if (node.__lastError) {
        badge.textContent = '✗';
        badge.className = 'workflow-node-status is-error';
      } else if (node.__lastResult) {
        badge.textContent = '✓';
        badge.className = 'workflow-node-status is-success';
      } else {
        badge.textContent = '';
        badge.className = 'workflow-node-status';
      }
    });
  }

  // ── 边属性面板 ──
  function renderEdgeProps() {
    const edge = state.edges[state.selectedEdge];
    if (!edge) {
      el.props.innerHTML = '<div class="workflow-props-placeholder">选中连线以查看信息</div>';
      return;
    }
    const fromNode = state.nodes.find(n => n.id === edge.from);
    const toNode = state.nodes.find(n => n.id === edge.to);

    let html = `
      <div class="workflow-props-header">
        <span class="workflow-props-name">连线</span>
        <button class="btn btn-sm btn-danger" data-action="delete-edge">删除</button>
      </div>
      <div class="workflow-prop-row">
        <span class="workflow-prop-port">从：${escapeHtml(fromNode?.name || edge.from)} (${edge.from})</span>
      </div>
      <div class="workflow-prop-row">
        <span class="workflow-prop-port">到：${escapeHtml(toNode?.name || edge.to)} (${edge.to})</span>
      </div>
      <div class="workflow-prop-row">
        <span class="workflow-prop-port">${edge.fromOutput} → ${edge.toInput}</span>
      </div>
    `;

    if (fromNode && fromNode.tool === '__condition') {
      html += `
        <div class="workflow-props-section">条件分支</div>
        <div class="workflow-prop-row">
          <label class="workflow-prop-label">分支类型</label>
          <select class="workflow-prop-input" data-edge-branch="${state.selectedEdge}">
            <option value="true" ${edge.fromOutput === 'true' ? 'selected' : ''}>满足条件 (true)</option>
            <option value="false" ${edge.fromOutput === 'false' ? 'selected' : ''}>不满足条件 (false)</option>
          </select>
        </div>
      `;
    }

    el.props.innerHTML = html;

    el.props.querySelectorAll('[data-edge-branch]').forEach(sel => {
      sel.addEventListener('change', () => {
        const idx = Number(sel.dataset.edgeBranch);
        const branch = sel.value;
        if (state.edges[idx]) {
          state.edges[idx].fromOutput = branch;
          renderEdges();
        }
      });
    });
  }

  // ── 属性面板 ──
  function renderProps() {
    if (state.selectedEdge !== null) {
      renderEdgeProps();
      return;
    }
    if (!state.selectedNode) {
      el.props.innerHTML = '<div class="workflow-props-placeholder">选中节点以配置参数</div>';
      return;
    }

    const node = state.nodes.find(n => n.id === state.selectedNode);
    const manifest = TOOL_MANIFESTS.find(t => t.id === node.tool);
    if (!manifest) return;

    let html = `
      <div class="workflow-props-header">
        <span class="workflow-props-icon">${node.icon}</span>
        <span class="workflow-props-name">${node.name} <span style="color:var(--color-text-muted);font-weight:400;font-size:0.85em;">(${node.id})</span></span>
        <button class="btn btn-sm btn-danger" data-action="delete-node">删除</button>
      </div>
    `;

    if (manifest.params && manifest.params.length) {
      html += '<div class="workflow-props-section">参数</div>';
      manifest.params.forEach(p => {
        // 检查 visibleWhen 条件
        if (p.visibleWhen) {
          const shouldShow = Object.entries(p.visibleWhen).every(([key, expected]) => node.params[key] === expected);
          if (!shouldShow) return;
        }

        const val = node.params[p.name] !== undefined ? node.params[p.name] : p.default;
        if (p.type === 'select') {
          html += `
            <div class="workflow-prop-row">
              <label class="workflow-prop-label">${p.label}</label>
              <select class="workflow-prop-input" data-param="${p.name}">
                ${p.options.map(o => `<option value="${o}" ${o === val ? 'selected' : ''}>${o}</option>`).join('')}
              </select>
            </div>`;
        } else {
          html += `
            <div class="workflow-prop-row">
              <label class="workflow-prop-label">${p.label}</label>
              <input type="text" class="workflow-prop-input" data-param="${p.name}" value="${val}" placeholder="支持 {{节点ID.字段名}} 表达式引用">
            </div>`;
        }
      });
    }

    // 输入端口信息
    if (manifest.inputs && manifest.inputs.length) {
      html += '<div class="workflow-props-section">输入数据</div>';
      manifest.inputs.forEach(i => {
        const connected = state.edges.some(e => e.to === node.id && e.toInput === i.name);
        if (connected) {
          html += `
            <div class="workflow-prop-row">
              <span class="workflow-prop-port is-connected">${i.label}（已连接上游）</span>
            </div>`;
        } else {
          const val = node.initialInputs[i.name] ?? '';
          html += `
            <div class="workflow-prop-row">
              <label class="workflow-prop-label">${i.label}</label>
              <textarea class="workflow-prop-input workflow-prop-textarea" data-input="${i.name}" rows="4" placeholder="输入初始值，支持 {{节点ID.字段名}} 表达式引用">${escapeHtml(val)}</textarea>
            </div>`;
        }
      });
    }

    // 输出端口信息
    if (manifest.outputs && manifest.outputs.length) {
      html += '<div class="workflow-props-section">输出端口</div>';
      manifest.outputs.forEach(o => {
        const connected = state.edges.some(e => e.from === node.id && e.fromOutput === o.name);
        html += `
          <div class="workflow-prop-row">
            <span class="workflow-prop-port ${connected ? 'is-connected' : ''}">${o.label}</span>
          </div>`;
      });
    }

    // 执行结果
    if (node.__lastResult !== undefined || node.__lastError) {
      html += '<div class="workflow-props-section">执行结果</div>';
      if (node.__lastError) {
        html += `
          <div class="workflow-prop-row">
            <div class="workflow-result-error">${escapeHtml(node.__lastError)}</div>
          </div>`;
      } else if (typeof node.__lastResult === 'object' && node.__lastResult !== null) {
        const result = node.__lastResult;

        // 优先展示 text 字段（易读的主要输出）
        if (typeof result.text === 'string') {
          html += `
            <div class="workflow-prop-row">
              <pre class="workflow-result-code" style="max-height:400px;"><code>${escapeHtml(result.text)}</code></pre>
            </div>`;
        }

        // 展示 stats（简洁一行）
        if (result.stats && typeof result.stats === 'object') {
          const s = result.stats;
          const parts = [];
          if (s.mode) parts.push(`模式: ${s.mode}`);
          if (typeof s.added === 'number') parts.push(`新增 ${s.added} 行`);
          if (typeof s.removed === 'number') parts.push(`删除 ${s.removed} 行`);
          if (parts.length) {
            html += `
              <div class="workflow-prop-row">
                <span class="workflow-prop-port is-connected">${parts.join(' · ')}</span>
              </div>`;
          }
        }

        // 其他字段：透传字段隐藏，数组折叠
        Object.entries(result).forEach(([key, val]) => {
          if (key === 'text' || key === 'stats') return;
          if (key === 'oldText' || key === 'newText') return; // 透传字段不展示

          if (Array.isArray(val)) {
            html += `
              <div class="workflow-prop-row">
                <span class="workflow-prop-port">${key} — ${val.length} 项（供下游节点使用）</span>
              </div>`;
          } else if (typeof val === 'object' && val !== null) {
            html += `
              <div class="workflow-prop-row">
                <label class="workflow-prop-label">${key}</label>
                <pre class="workflow-result-code"><code>${escapeHtml(JSON.stringify(val, null, 2))}</code></pre>
              </div>`;
          }
        });
      } else {
        const resultText = String(node.__lastResult ?? '');
        html += `
          <div class="workflow-prop-row">
            <pre class="workflow-result-code"><code>${escapeHtml(resultText)}</code></pre>
          </div>`;
      }
    }

    el.props.innerHTML = html;

    // 绑定参数变更
    el.props.querySelectorAll('[data-param]').forEach(input => {
      input.addEventListener('change', () => {
        const paramName = input.dataset.param;
        node.params[paramName] = input.value;
        // select 变更可能触发 visibleWhen，重新渲染面板
        if (input.tagName === 'SELECT') {
          renderProps();
        }
      });
    });

    // 绑定初始输入变更
    el.props.querySelectorAll('[data-input]').forEach(input => {
      input.addEventListener('input', () => {
        const inputName = input.dataset.input;
        node.initialInputs[inputName] = input.value;
      });
    });
  }

  // ── 运行 ──
  async function doRun() {
    if (!state.nodes.length) { showToast('画布上没有节点', 'warning'); return; }

    el.logsBody.innerHTML = '<div class="workflow-log-item is-info">开始执行工作流…</div>';

    // 清除旧结果状态
    state.nodes.forEach(n => { n.__lastResult = null; n.__lastError = null; });

    const workflow = {
      nodes: state.nodes.map(n => ({ id: n.id, tool: n.tool, params: n.params, initialInputs: n.initialInputs })),
      edges: state.edges.map(e => ({ ...e }))
    };

    const engine = new window.WorkflowEngine();
    try {
      const result = await engine.run(workflow);
      result.logs.forEach(log => {
        const node = state.nodes.find(n => n.id === log.nodeId);
        if (node) {
          node.__lastResult = log.output;
          node.__lastError = log.error || null;
        }
        appendLog(`[${log.nodeId}] ${log.tool} — ${log.status === 'success' ? '成功' : '失败'} (${log.duration}ms)`);
      });
      updateNodeStatusBadges();
      renderProps();
      renderFinalResults(engine);
      showToast('工作流执行完成', 'success');
    } catch (err) {
      // 已经执行过的节点也保存结果
      engine.logs.forEach(log => {
        const node = state.nodes.find(n => n.id === log.nodeId);
        if (node) {
          node.__lastResult = log.output;
          node.__lastError = log.error || null;
        }
      });
      updateNodeStatusBadges();
      renderProps();
      renderFinalResults(engine);
      appendLog(`执行中断: ${err.message}`, 'error');
      showToast(err.message, 'error');
    }
  }

  // ── 结果面板渲染 ──
  function renderFinalResults(engine) {
    if (!el.resultsBody) return;

    // 找出最终节点：没有出边的节点
    const finalNodeIds = new Set(state.nodes.map(n => n.id));
    state.edges.forEach(e => finalNodeIds.delete(e.from));

    if (finalNodeIds.size === 0) {
      el.resultsBody.innerHTML = '<div class="workflow-results-placeholder">工作流没有最终输出节点</div>';
      return;
    }

    let html = '';
    finalNodeIds.forEach(id => {
      const node = state.nodes.find(n => n.id === id);
      if (!node) return;
      const log = engine.logs.find(l => l.nodeId === id);
      html += renderResultItem(node, node.__lastResult, node.__lastError, log);
    });

    el.resultsBody.innerHTML = html;
  }

  function renderResultItem(node, result, error, log) {
    const manifest = TOOL_MANIFESTS.find(t => t.id === node.tool);
    const toolName = manifest?.name || node.tool;
    const statusClass = error ? 'is-error' : 'is-success';
    const statusText = error ? '失败' : (log ? `成功 · ${log.duration}ms` : '成功');

    let bodyHtml = '';
    if (error) {
      bodyHtml = `<div class="workflow-result-error">${escapeHtml(error)}</div>`;
    } else if (result) {
      if (node.tool === 'diff' && result.changes) {
        bodyHtml = renderDiffResult(result);
      } else if (node.tool === 'http-request') {
        bodyHtml = renderHttpResult(result);
      } else if (typeof result === 'object') {
        if (typeof result.text === 'string') {
          bodyHtml = `<pre class="workflow-result-code"><code>${escapeHtml(result.text)}</code></pre>`;
        } else {
          bodyHtml = `<pre class="workflow-result-code"><code>${escapeHtml(JSON.stringify(result, null, 2))}</code></pre>`;
        }
      } else {
        bodyHtml = `<pre class="workflow-result-code"><code>${escapeHtml(String(result))}</code></pre>`;
      }
    } else {
      bodyHtml = '<div class="workflow-results-placeholder">无输出</div>';
    }

    return `
      <div class="workflow-result-item">
        <div class="workflow-result-item-header">
          <span class="workflow-result-item-icon">${node.icon}</span>
          <span class="workflow-result-item-name">${escapeHtml(toolName)} (${node.id})</span>
          <span class="workflow-result-item-status ${statusClass}">${statusText}</span>
        </div>
        <div class="workflow-result-item-body">${bodyHtml}</div>
      </div>
    `;
  }

  function renderDiffResult(result) {
    const changes = result.changes;
    const stats = result.stats;
    if (!changes || !changes.length) {
      return '<div class="workflow-results-placeholder">无差异</div>';
    }

    let html = '<div class="diff-line-list">';
    let oldNum = 1;
    let newNum = 1;

    changes.forEach(part => {
      const lines = part.value.split('\n');
      if (lines[lines.length - 1] === '') lines.pop();

      lines.forEach(line => {
        const cls = part.added ? 'diff-added' : part.removed ? 'diff-removed' : 'diff-normal';
        const oNum = part.added ? '' : String(oldNum++);
        const nNum = part.removed ? '' : String(newNum++);
        const marker = part.added ? '+' : part.removed ? '-' : ' ';

        html += `<div class="diff-line ${cls}">
          <span class="diff-line-num">${oNum.padStart(4, ' ')}</span>
          <span class="diff-line-num">${nNum.padStart(4, ' ')}</span>
          <span class="diff-line-marker">${marker}</span>
          <span class="diff-line-text">${escapeHtml(line)}</span>
        </div>`;
      });
    });

    html += '</div>';

    if (stats) {
      const parts = [];
      if (stats.mode) parts.push(`模式: ${stats.mode}`);
      if (typeof stats.added === 'number') parts.push(`新增 ${stats.added} 行`);
      if (typeof stats.removed === 'number') parts.push(`删除 ${stats.removed} 行`);
      if (parts.length) {
        html = `<div class="workflow-result-stats">${parts.join(' · ')}</div>` + html;
      }
    }

    return html;
  }

  function renderHttpResult(result) {
    const statusClass = result.ok ? 'is-success' : (result.status >= 400 ? 'is-error' : 'is-warning');
    let html = `<div class="workflow-result-stats">
      <span class="${statusClass}">${result.status} ${escapeHtml(result.statusText)}</span>
      <span>耗时 ${result.duration}ms</span>
    </div>`;

    if (result.body) {
      let body = result.body;
      try {
        const json = JSON.parse(body);
        body = JSON.stringify(json, null, 2);
      } catch {
        // 保持原样
      }
      html += `<pre class="workflow-result-code"><code>${escapeHtml(body)}</code></pre>`;
    }

    return html;
  }

  function doClearResults() {
    if (el.resultsBody) {
      el.resultsBody.innerHTML = '<div class="workflow-results-placeholder">运行工作流后，最终节点结果将显示在这里</div>';
    }
  }

  function appendLog(msg, type = 'info') {
    const div = document.createElement('div');
    div.className = `workflow-log-item is-${type}`;
    div.textContent = msg;
    el.logsBody.appendChild(div);
    el.logsBody.scrollTop = el.logsBody.scrollHeight;
  }

  function doClear() {
    state.nodes = [];
    state.edges = [];
    state.selectedNode = null;
    state.selectedEdge = null;
    state.nextId = 1;
    el.nodesLayer.innerHTML = '';
    el.svg.innerHTML = '';
    renderProps();
    el.logsBody.innerHTML = '';
    doClearResults();
    showToast('画布已清空', 'success');
  }

  function doClearLogs() {
    el.logsBody.innerHTML = '';
  }

  function doSave() {
    // 排除执行时产生的临时状态（__lastResult / __lastError）
    const cleanNodes = state.nodes.map(n => ({
      id: n.id,
      tool: n.tool,
      name: n.name,
      icon: n.icon,
      x: n.x,
      y: n.y,
      params: n.params,
      initialInputs: n.initialInputs
    }));
    const data = {
      nodes: cleanNodes,
      edges: state.edges
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflow-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('工作流已保存', 'success');
  }

  function doLoad() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          applyWorkflowData(data);
          showToast('工作流已导入', 'success');
        } catch (err) {
          showToast('导入失败: ' + err.message, 'error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function doDeleteNode() {
    if (state.selectedNode) {
      removeNode(state.selectedNode);
    }
  }

  function doDeleteEdge() {
    if (state.selectedEdge !== null) {
      removeEdge(state.selectedEdge);
    }
  }

  // ── 自动执行 ──
  function startAutoRun() {
    if (!state.nodes.length) {
      showToast('画布上没有节点，无法自动执行', 'warning');
      if (el.autoRunToggle) el.autoRunToggle.checked = false;
      return;
    }
    state.autoRun.enabled = true;
    updateAutoRunUI();
    scheduleNext();
  }

  function stopAutoRun() {
    state.autoRun.enabled = false;
    if (state.autoRun.timerId) {
      clearTimeout(state.autoRun.timerId);
      state.autoRun.timerId = null;
    }
    state.autoRun.nextRun = null;
    updateAutoRunUI();
  }

  function scheduleNext() {
    if (!state.autoRun.enabled) return;

    const mode = el.autoRunMode ? el.autoRunMode.value : 'interval';
    const expr = el.autoRunExpr ? el.autoRunExpr.value.trim() : '5';
    let delayMs;

    if (mode === 'interval') {
      const seconds = parseFloat(expr) || 5;
      delayMs = Math.max(1000, seconds * 1000);
    } else {
      try {
        if (typeof Cron === 'undefined') {
          throw new Error('Croner 库未加载');
        }
        const job = new Cron(expr);
        const runs = job.nextRuns(1);
        if (!runs || !runs.length) {
          throw new Error('无法计算下次执行时间');
        }
        delayMs = runs[0].getTime() - Date.now();
        if (delayMs < 0) delayMs = 0;
      } catch (e) {
        showToast('Cron 表达式错误: ' + e.message, 'error');
        stopAutoRun();
        if (el.autoRunToggle) el.autoRunToggle.checked = false;
        return;
      }
    }

    state.autoRun.nextRun = Date.now() + delayMs;
    updateAutoRunUI();

    state.autoRun.timerId = setTimeout(async () => {
      if (!state.autoRun.enabled) return;
      try {
        await doRun();
      } catch (e) {
        // doRun 内部已处理错误
      }
      scheduleNext();
    }, delayMs);
  }

  function updateAutoRunUI() {
    if (!el.autoRunCountdown) return;
    if (!state.autoRun.enabled) {
      el.autoRunCountdown.textContent = '已停止';
      el.autoRunCountdown.classList.remove('is-active');
      return;
    }
    el.autoRunCountdown.classList.add('is-active');
    if (!state.autoRun.nextRun) {
      el.autoRunCountdown.textContent = '计算中…';
      return;
    }
    const remaining = Math.max(0, Math.ceil((state.autoRun.nextRun - Date.now()) / 1000));
    const mode = el.autoRunMode ? el.autoRunMode.value : 'interval';
    if (mode === 'cron' && remaining >= 60) {
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      el.autoRunCountdown.textContent = `${mins}m${secs}s`;
    } else {
      el.autoRunCountdown.textContent = `${remaining}s`;
    }
  }

  const ACTIONS = {
    run: doRun,
    clear: doClear,
    save: doSave,
    load: doLoad,
    'save-local': doSaveLocal,
    'delete-local': doDeleteLocal,
    'clear-logs': doClearLogs,
    'clear-results': doClearResults,
    'delete-node': doDeleteNode,
    'delete-edge': doDeleteEdge
  };

  init();
})();
