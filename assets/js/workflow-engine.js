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
     * 执行工作流
     * @param {Object} workflow — { nodes: [...], edges: [...] }
     * @returns {Promise<{ states, logs }>}
     */
    async run(workflow) {
      this.states = {};
      this.logs = [];

      if (!workflow.nodes || !workflow.nodes.length) {
        throw new Error('工作流没有节点');
      }

      // 拓扑排序确定执行顺序
      const order = this.topologicalSort(workflow);

      for (const nodeId of order) {
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

      return { states: this.states, logs: this.logs };
    }

    /**
     * 执行单个节点
     */
    async executeNode(node, workflow) {
      const core = await window.TOOL_REGISTRY.loadCore(node.tool);

      // 收集上游输入
      const input = {};
      const incomingEdges = workflow.edges.filter(e => e.to === node.id);
      for (const edge of incomingEdges) {
        const upstreamOutput = this.states[edge.from];
        if (upstreamOutput && upstreamOutput.__error) {
          throw new Error(`上游节点 ${edge.from} 执行失败`);
        }
        input[edge.toInput] = upstreamOutput?.[edge.fromOutput];
      }

      // 合并手动输入的初始值（未连接上游的端口）
      if (node.initialInputs) {
        Object.entries(node.initialInputs).forEach(([key, val]) => {
          if (input[key] === undefined) input[key] = val;
        });
      }

      // 执行
      return await core.run({ input, params: node.params || {} });
    }

    /**
     * 拓扑排序（Kahn 算法）
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
