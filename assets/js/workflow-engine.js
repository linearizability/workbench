/**
 * 工作流引擎 — 执行有向无环图（DAG）的核心引擎
 */

(function() {
  'use strict';

  class WorkflowEngine {
    constructor() {
      this.states = {};      // 每个节点的输出缓存
      this.logs = [];        // 执行日志
    }

    /**
     * 执行工作流（同层级节点并行）
     * @param {Object} workflow — { nodes: [...], edges: [...] }
     * @returns {Promise<{ states, logs }>}
     */
    async run(workflow) {
      this.states = {};
      this.logs = [];

      if (!workflow.nodes || !workflow.nodes.length) {
        throw new Error('工作流没有节点');
      }

      // 按拓扑层级分组，同层节点并行执行
      const levels = this.groupByLevel(workflow);

      for (const level of levels) {
        await Promise.all(
          level.map(nodeId => this.executeNodeWithLogging(nodeId, workflow))
        );
      }

      return { states: this.states, logs: this.logs };
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
      const node = workflow.nodes.find(n => n.id === nodeId);
      const startTime = performance.now();

      try {
        const result = await this.executeNode(node, workflow);
        this.states[nodeId] = result.output || {};
        this.logs.push({
          nodeId,
          tool: node.tool,
          status: 'success',
          duration: Math.round(performance.now() - startTime),
          output: result.output
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
     * 表达式求值：支持 {{nodeId.outputName}} 语法引用其他节点输出
     */
    resolveValue(value) {
      if (typeof value !== 'string') return value;

      const fullMatch = value.match(/^\{\{([^}]+)\}\}$/);
      if (fullMatch) {
        const result = this.lookupValue(fullMatch[1].trim());
        return result !== undefined ? result : value;
      }

      return value.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const result = this.lookupValue(path.trim());
        if (result === undefined) return match;
        if (typeof result === 'object') return JSON.stringify(result);
        return String(result);
      });
    }

    lookupValue(path) {
      const parts = path.split('.');
      const nodeId = parts[0];
      const outputName = parts[1];
      const state = this.states[nodeId];
      if (!state) return undefined;
      if (outputName) return state[outputName];
      return state;
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
     */
    evaluateCondition(expression, input, params) {
      try {
        const fn = new Function('input', 'params', `return (${expression});`);
        return !!fn(input, params);
      } catch (e) {
        throw new Error(`条件表达式错误: ${e.message}`);
      }
    }

    /**
     * 执行单个节点
     */
    async executeNode(node, workflow) {
      // 收集上游输入（含条件分支过滤）
      const input = {};
      const incomingEdges = workflow.edges.filter(e => e.to === node.id);
      for (const edge of incomingEdges) {
        const upstreamOutput = this.states[edge.from];
        if (upstreamOutput && upstreamOutput.__error) {
          throw new Error(`上游节点 ${edge.from} 执行失败`);
        }

        // 条件分支过滤：若上游是条件节点且条件不匹配，则忽略该边
        const fromNode = workflow.nodes.find(n => n.id === edge.from);
        if (fromNode && fromNode.tool === '__condition') {
          const conditionResult = upstreamOutput?.__conditionResult;
          if ((edge.fromOutput === 'true' && !conditionResult) ||
              (edge.fromOutput === 'false' && conditionResult)) {
            continue;
          }
        }

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

      // 内置循环处理节点
      if (node.tool === '__foreach') {
        const items = Array.isArray(resolvedInput.items) ? resolvedInput.items : [];
        const expr = resolvedParams.expression || 'item';
        const results = items.map((item, index) => {
          try {
            const fn = new Function('item', 'index', `return (${expr});`);
            return fn(item, index);
          } catch (e) {
            return { __error: e.message };
          }
        });
        return { output: { results } };
      }

      // 若所有入边均来自条件节点且不匹配，则跳过执行
      if (incomingEdges.length > 0 && Object.keys(input).length === 0 &&
          incomingEdges.every(e => {
            const fromNode = workflow.nodes.find(n => n.id === e.from);
            return fromNode && fromNode.tool === '__condition';
          })) {
        return { output: {} };
      }

      // 普通节点执行
      const core = await window.TOOL_REGISTRY.loadCore(node.tool);
      return await core.run({ input: resolvedInput, params: resolvedParams });
    }

    /**
     * 拓扑排序（Kahn 算法）
     * 保留此方法供外部调用（如画布环检测）
     */
    topologicalSort(workflow) {
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

      const result = [];

      while (queue.length) {
        const id = queue.shift();
        result.push(id);
        adj[id].forEach(next => {
          inDegree[next]--;
          if (inDegree[next] === 0) queue.push(next);
        });
      }

      if (result.length !== workflow.nodes.length) {
        throw new Error('工作流存在循环依赖');
      }

      return result;
    }
  }

  window.WorkflowEngine = WorkflowEngine;

})();
