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
  };

  const TOOL_MANIFESTS = []; // 已加载的工具元数据

  async function init() {
    cacheElements();
    await loadToolManifests();
    renderToolList();
    bindEvents();
  }

  function cacheElements() {
    el.toolList = document.getElementById('tool-list');
    el.canvas = document.getElementById('workflow-canvas');
    el.svg = document.getElementById('workflow-svg');
    el.nodesLayer = document.getElementById('workflow-nodes');
    el.props = document.getElementById('workflow-props');
    el.logsBody = document.getElementById('workflow-logs-body');
  }

  // ── 加载工具清单 ──
  async function loadToolManifests() {
    // 阶段 2：加载 JSON、Diff、HTTP 请求工具
    await loadScript('../json/manifest.js');
    await loadScript('../diff/manifest.js');
    await loadScript('../http-request/manifest.js');

    ['json', 'diff', 'http-request'].forEach(id => {
      const tool = window.TOOL_REGISTRY.get(id);
      if (tool) TOOL_MANIFESTS.push(tool);
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

    // 删除节点 / 连线
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
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
    const x = rect.width / 2 - 80 + (Math.random() * 40 - 20);
    const y = rect.height / 2 - 60 + (Math.random() * 40 - 20);

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

  function renderNode(node) {
    const manifest = TOOL_MANIFESTS.find(t => t.id === node.tool);
    const inputs = manifest?.inputs || [];
    const outputs = manifest?.outputs || [];

    const inputPorts = inputs.map((p, i) => `
      <div class="workflow-port workflow-port-in" data-port="${p.name}" title="${p.label}"
           style="top:${16 + i * 24}px"></div>
    `).join('');

    const outputPorts = outputs.map((p, i) => `
      <div class="workflow-port workflow-port-out" data-port="${p.name}" title="${p.label}"
           style="top:${16 + i * 24}px"></div>
    `).join('');

    const div = document.createElement('div');
    div.className = 'workflow-node';
    div.id = node.id;
    div.style.transform = `translate(${node.x}px, ${node.y}px)`;
    div.innerHTML = `
      ${inputPorts}
      <div class="workflow-node-body">
        <span class="workflow-node-icon">${node.icon}</span>
        <span class="workflow-node-name">${node.name}</span>
        <span class="workflow-node-status"></span>
      </div>
      ${outputPorts}
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
    renderProps();
  }

  // ── 拖拽 ──
  function handleMouseDown(e) {
    if (e.target === el.canvas || e.target === el.svg || e.target.classList.contains('workflow-hint')) {
      state.selectedNode = null;
      state.selectedEdge = null;
      document.querySelectorAll('.workflow-node').forEach(n => n.classList.remove('is-selected'));
      el.svg.querySelectorAll('.workflow-edge').forEach(p => p.classList.remove('is-selected'));
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
    updateDrawingEdge(e);
  }

  function updateDrawingEdge(e) {
    if (!state.drawingEdge) return;
    const fromNode = state.nodes.find(n => n.id === state.drawingEdge.fromId);
    if (!fromNode) return;

    const fromManifest = TOOL_MANIFESTS.find(t => t.id === fromNode.tool);
    const fromOutputIndex = (fromManifest?.outputs || []).findIndex(o => o.name === state.drawingEdge.fromOutput);

    const fromX = fromNode.x + 160 + 6; // 节点右边界 + 端口半径
    const fromY = fromNode.y + 16 + (fromOutputIndex >= 0 ? fromOutputIndex : 0) * 24 + 6;
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

      const fromX = fromNode.x + 160 + 6; // 节点右边界 + 端口半径
      const fromY = fromNode.y + 16 + (fromOutputIndex >= 0 ? fromOutputIndex : 0) * 24 + 6;
      const toX = toNode.x - 6; // 节点左边界 - 端口半径
      const toY = toNode.y + 16 + (toInputIndex >= 0 ? toInputIndex : 0) * 24 + 6;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', 'workflow-edge');
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

  // ── 属性面板 ──
  function renderProps() {
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
        <span class="workflow-props-name">${node.name}</span>
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
              <input type="text" class="workflow-prop-input" data-param="${p.name}" value="${val}">
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
              <textarea class="workflow-prop-input workflow-prop-textarea" data-input="${i.name}" rows="4" placeholder="输入初始值…">${escapeHtml(val)}</textarea>
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
      appendLog(`执行中断: ${err.message}`, 'error');
      showToast(err.message, 'error');
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
    showToast('画布已清空', 'success');
  }

  function doClearLogs() {
    el.logsBody.innerHTML = '';
  }

  function doSave() {
    const data = {
      nodes: state.nodes,
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

  const ACTIONS = {
    run: doRun,
    clear: doClear,
    save: doSave,
    load: doLoad,
    'clear-logs': doClearLogs,
    'delete-node': doDeleteNode
  };

  init();
})();
