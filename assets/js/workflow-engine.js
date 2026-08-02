/**
 * 工作流引擎 — 执行有向无环图（DAG）的核心引擎
 */

(function() {
  'use strict';

  class WorkflowEngine {
    constructor() {
      this.states = {};      // 每个节点的输出缓存
      this.logs = [];        // 执行日志
      this.continueOnError = false; // 错误策略：false=遇错即停，true=继续执行下游可运行节点
    }

    /**
     * 执行工作流（同层级节点并行）
     * @param {Object} workflow — { nodes: [...], edges: [...] }
     * @param {Object} [options] — { continueOnError?: boolean }
     * @returns {Promise<{ states, logs, error }>}
     */
    async run(workflow, options = {}) {
      this.states = {};
      this.logs = [];
      this.continueOnError = !!options.continueOnError;

      if (!workflow.nodes || !workflow.nodes.length) {
        throw new Error('工作流没有节点');
      }

      // 预建 id → node 索引，避免后续 O(n²) find
      this._nodeMap = {};
      workflow.nodes.forEach(n => { this._nodeMap[n.id] = n; });

      // 按拓扑层级分组，同层节点并行执行
      const levels = this.groupByLevel(workflow);

      let firstError = null;
      const failedNodeIds = new Set();

      for (const level of levels) {
        // 过滤掉已失败节点的下游（continueOnError 模式下跳过无法执行的节点）
        const runnable = level.filter(id => {
          if (failedNodeIds.has(id)) return false;
          // 检查是否有上游失败导致本节点无法执行
          const incoming = workflow.edges.filter(e => e.to === id);
          if (incoming.length === 0) return true;
          // 条件分支的边可能被过滤掉，这里仅看是否存在失败的上游直连
          const hasFailedUpstream = incoming.some(e => failedNodeIds.has(e.from));
          return !hasFailedUpstream;
        });

        const results = await Promise.allSettled(
          runnable.map(nodeId => this.executeNodeWithLogging(nodeId, workflow))
        );

        // 收集失败节点
        results.forEach((r, i) => {
          if (r.status === 'rejected') {
            const nodeId = runnable[i];
            failedNodeIds.add(nodeId);
            if (!firstError) firstError = r.reason;
          }
        });

        // stop-on-error：首个错误立即中断
        if (!this.continueOnError && firstError) {
          break;
        }
      }

      const result = { states: this.states, logs: this.logs };
      if (firstError) result.error = firstError.message;
      return result;
    }

    /**
     * 按拓扑层级分组（Kahn 算法的层序变体）
     */
    groupByLevel(workflow) {
      const inDegree = {};
      const adj = {};

      workflow.nodes.forEach(n => {
        inDegree[n.id] = 0;
        adj[n.id] = [];
      });

      workflow.edges.forEach(e => {
        if (adj[e.from]) {
          adj[e.from].push(e.to);
          inDegree[e.to] = (inDegree[e.to] || 0) + 1;
        }
      });

      const queue = workflow.nodes
        .filter(n => (inDegree[n.id] || 0) === 0)
        .map(n => n.id);

      const levels = [];

      while (queue.length) {
        const levelSize = queue.length;
        const level = [];
        for (let i = 0; i < levelSize; i++) {
          const id = queue.shift();
          level.push(id);
          adj[id].forEach(next => {
            inDegree[next]--;
            if (inDegree[next] === 0) queue.push(next);
          });
        }
        levels.push(level);
      }

      if (levels.flat().length !== workflow.nodes.length) {
        throw new Error('工作流存在循环依赖');
      }

      return levels;
    }

    /**
     * 执行单个节点并记录日志
     */
    async executeNodeWithLogging(nodeId, workflow) {
      const node = this._nodeMap[nodeId];
      const startTime = performance.now();

      try {
        const result = await this.executeNode(node, workflow);
        this.states[nodeId] = result.output ?? {};
        const isSkipped = result.output?.__skipped === true;
        this.logs.push({
          nodeId,
          tool: node.tool,
          status: isSkipped ? 'skipped' : 'success',
          duration: Math.round(performance.now() - startTime),
          output: result.output,
          ...(isSkipped && { message: '上游条件不满足，跳过执行' })
        });
      } catch (err) {
        this.states[nodeId] = { __error: err.message };
        this.logs.push({
          nodeId,
          tool: node.tool,
          status: 'error',
          duration: Math.round(performance.now() - startTime),
          error: err.message
        });
        throw new Error(`节点 ${nodeId} (${node.tool}) 执行失败: ${err.message}`);
      }
    }

    /**
     * 表达式求值：支持 {{nodeId.outputName.field.subfield}} 语法引用其他节点输出
     * 路径至少包含 nodeId，后续字段可选；支持任意层级嵌套访问。
     */
    resolveValue(value) {
      if (typeof value !== 'string') return value;

      const fullMatch = value.match(/^\{\{([^}]+)\}\}$/);
      if (fullMatch) {
        const path = fullMatch[1].trim();
        const result = this.lookupValue(path);
        if (result === undefined) {
          this.logs.push({ nodeId: '__engine', tool: '__engine', status: 'warning', message: `表达式引用未命中: {{${path}}}` });
          return value;
        }
        return result;
      }

      let hasUnresolved = false;
      const replaced = value.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const trimmed = path.trim();
        const result = this.lookupValue(trimmed);
        if (result === undefined) {
          hasUnresolved = true;
          return match;
        }
        if (typeof result === 'object') return JSON.stringify(result);
        return String(result);
      });
      if (hasUnresolved) {
        this.logs.push({ nodeId: '__engine', tool: '__engine', status: 'warning', message: `字符串内表达式存在未命中: ${value}` });
      }
      return replaced;
    }

    /**
     * 按点分路径查找：nodeId.outputName.field.sub...
     * @param {string} path - 如 "n1.text.foo.bar"
     * @returns {*} 未命中返回 undefined
     */
    lookupValue(path) {
      const parts = path.split('.').filter(Boolean);
      if (!parts.length) return undefined;
      const nodeId = parts[0];
      let current = this.states[nodeId];
      for (let i = 1; i < parts.length; i++) {
        if (current == null) return undefined;
        current = current[parts[i]];
      }
      return current;
    }

    resolveDeep(obj) {
      if (typeof obj === 'string') return this.resolveValue(obj);
      if (Array.isArray(obj)) return obj.map(v => this.resolveDeep(v));
      if (obj && typeof obj === 'object') {
        const result = {};
        Object.entries(obj).forEach(([k, v]) => {
          result[k] = this.resolveDeep(v);
        });
        return result;
      }
      return obj;
    }

    /**
     * 评估条件表达式（内置条件节点用）
     * 使用 `with` 切换作用域到 sandbox，提供常用全局对象。
     * 安全说明：黑名单仅防止误用，无法防止原型链逃逸
     * （如 `[].constructor.constructor('return this')()`）。
     * 本工具面向本地开发环境，表达式由用户自己编写，
     * 不具备服务端多用户安全保证。如需沙箱隔离请使用 iframe sandbox。
     */
    evaluateCondition(expression, input, params) {
      // 简单黑名单：禁止出现 window / document / globalThis / eval / Function / fetch 等
      if (/(\bwindow\b|\bdocument\b|\bglobalThis\b|\beval\b|\bFunction\b|\bfetch\b|\bXMLHttpRequest\b|\bimport\b|\brequire\b)/.test(expression)) {
        throw new Error('条件表达式包含禁用的标识符');
      }
      try {
        const sandbox = { input, params, Math, JSON, String, Number, Boolean, Array, Object, Date, isNaN, isFinite };
        const fn = new Function('sandbox', `with(sandbox){ return (${expression}); }`);
        return !!fn(sandbox);
      } catch (e) {
        throw new Error(`条件表达式错误: ${e.message}`);
      }
    }

    /**
     * 执行单个节点
     */
    async executeNode(node, workflow) {
      // 收集上游输入（含条件分支过滤 + 跳过传播）
      const input = {};
      const incomingEdges = workflow.edges.filter(e => e.to === node.id);
      const inputSources = {}; // 记录每个 input 端口的来源，用于检测多上游覆盖
      let skippedEdgeCount = 0;
      for (const edge of incomingEdges) {
        const upstreamOutput = this.states[edge.from];
        if (upstreamOutput && upstreamOutput.__error) {
          throw new Error(`上游节点 ${edge.from} 执行失败`);
        }

        // 跳过传播：若上游被跳过，本边也跳过
        if (upstreamOutput && upstreamOutput.__skipped) {
          skippedEdgeCount++;
          continue;
        }

        // 条件分支过滤：若上游是条件节点且条件不匹配，则忽略该边
        const fromNode = this._nodeMap[edge.from];
        if (fromNode && fromNode.tool === '__condition') {
          const conditionResult = upstreamOutput?.__conditionResult;
          if ((edge.fromOutput === 'true' && !conditionResult) ||
              (edge.fromOutput === 'false' && conditionResult)) {
            skippedEdgeCount++;
            continue;
          }
        }

        // 多上游覆盖检测
        if (inputSources[edge.toInput] && inputSources[edge.toInput] !== edge.from) {
          this.logs.push({
            nodeId: '__engine',
            tool: '__engine',
            status: 'warning',
            message: `节点 ${node.id} 的输入端口 "${edge.toInput}" 被多个上游覆盖：${inputSources[edge.toInput]} → ${edge.from}（后者生效）`
          });
        }
        inputSources[edge.toInput] = edge.from;
        input[edge.toInput] = upstreamOutput?.[edge.fromOutput];
      }

      // 合并手动输入的初始值（未连接上游的端口）
      if (node.initialInputs) {
        Object.entries(node.initialInputs).forEach(([key, val]) => {
          if (input[key] === undefined) input[key] = val;
        });
      }

      // 表达式求值：解析 {{nodeId.outputName}} 语法
      const resolvedInput = this.resolveDeep(input);
      const resolvedParams = this.resolveDeep(node.params || {});

      // 内置条件分支节点
      if (node.tool === '__condition') {
        const expr = resolvedParams.expression || 'true';
        const result = this.evaluateCondition(expr, resolvedInput, resolvedParams);
        return { output: { __conditionResult: result } };
      }

      // 内置循环处理节点（支持异步表达式）
      if (node.tool === '__foreach') {
        const items = Array.isArray(resolvedInput.items) ? resolvedInput.items : [];
        const expr = resolvedParams.expression || 'item';
        if (/(\bwindow\b|\bdocument\b|\bglobalThis\b|\beval\b|\bFunction\b|\bfetch\b|\bXMLHttpRequest\b|\bimport\b|\brequire\b)/.test(expr)) {
          throw new Error('循环表达式包含禁用的标识符');
        }
        const sandbox = { Math, JSON, String, Number, Boolean, Array, Object, Date, isNaN, isFinite };
        // 编译一次，循环内复用（避免每个元素 new Function）
        let fn;
        try {
          fn = new Function('item', 'index', 'sandbox', `with(sandbox){ return (${expr}); }`);
        } catch (e) {
          return { output: { results: items.map(() => ({ __error: e.message })) } };
        }
        // 表达式可能返回 Promise，逐项 await
        const mapped = items.map((item, index) => {
          try {
            return fn(item, index, sandbox);
          } catch (e) {
            return { __error: e.message };
          }
        });
        const results = await Promise.all(mapped.map(async (p) => {
          try {
            return await p;
          } catch (e) {
            return { __error: e.message };
          }
        }));
        return { output: { results } };
      }

      // 跳过传播：若所有入边均被跳过（条件不匹配或上游被跳过），且无手动输入，则跳过本节点
      if (incomingEdges.length > 0 && skippedEdgeCount === incomingEdges.length &&
          Object.keys(resolvedInput).length === 0) {
        return { output: { __skipped: true } };
      }

      // 普通节点执行
      const core = await window.TOOL_REGISTRY.loadCore(node.tool);
      return await core.run({ input: resolvedInput, params: resolvedParams });
    }

    /**
     * 拓扑排序（展开分层结果为线性）
     * 保留此方法供外部调用（如画布环检测）
     */
    topologicalSort(workflow) {
      return this.groupByLevel(workflow).flat();
    }
  }

  window.WorkflowEngine = WorkflowEngine;

})();
