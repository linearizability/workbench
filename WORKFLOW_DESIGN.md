# Workbench 工作流模块 — 架构设计文档

> 分支：`workflow-refactor`
> 目标：在现有工具箱基础上，新增工作流编排能力，实现工具之间的串联与自动化

---

## 1. 项目现状

当前 Workbench 包含 18 个独立工具，通过 iframe 嵌入壳页面运行。各工具之间完全隔离，状态无法共享。

已开发工具清单：links, notepad, json, file-generator, image-generator, properties-yaml, svg-editor, md5, base64, qrcode, timestamp, cron, url, jwt, uuid, regex, diff, json-to-struct, http-request

---

## 2. 目标架构

改造后项目分为 **三大模块**：

```
Workbench
├── 常用链接      (links/)          — 保持现状，不受影响
├── 工具箱        (tools/*)         — 保持现状，独立使用，但内部拆分为三层
└── 工作流        (workflow/)       — 新增，可视化编排工具节点
```

### 2.1 工具箱改造方式

每个工具从"单一文件"拆分为三层：

```
tools/json/
├── index.html        — 独立页面入口（完全保留，向后兼容）
├── app.js            — UI 层：DOM 操作、事件绑定（变薄，调用 Core）
├── core.js           — 核心层：纯函数，接收 { input, params }，返回 { output, error }
├── manifest.js       — 元数据层：id、名称、输入/输出/参数定义
└── styles.css        — 样式（不变）
```

**关键原则**：
- `app.js` 独立页面完全保留，用户无感知
- `core.js` 绝不操作 DOM，只处理数据转换
- `manifest.js` 是工具注册到工作流引擎的"身份证"

### 2.2 核心设计：三层分离

| 层级 | 文件 | 职责 | 依赖 |
|---|---|---|---|
| **Manifest** | `manifest.js` | 声明工具身份：ID、名称、图标、输入端口、输出端口、可配置参数 | 无 |
| **Core** | `core.js` | 纯函数，接收 `{ input, params }`，返回 `{ output, error }` | 无 |
| **UI** | `app.js` | DOM 事件、渲染、调用 Core | Core + Manifest |

**manifest.js 示例（JSON 工具）**：

```javascript
// tools/json/manifest.js
window.TOOL_REGISTRY.register({
  id: 'json',
  name: 'JSON 工具',
  icon: '📝',
  description: '格式化、压缩、验证 JSON',

  inputs: [
    { name: 'text', type: 'string', label: 'JSON 文本', required: true }
  ],

  outputs: [
    { name: 'text', type: 'string', label: '处理后的 JSON' },
    { name: 'error', type: 'string', label: '错误信息' }
  ],

  params: [
    { name: 'action', type: 'select', label: '操作', options: ['format', 'compress', 'validate'], default: 'format' },
    { name: 'indent', type: 'select', label: '缩进', options: ['2', '4', 'tab'], default: '2', visibleWhen: { action: 'format' } }
  ],

  batchable: false
});
```

**core.js 示例**：

```javascript
// tools/json/core.js
window.TOOL_JSON_CORE = {
  async run({ input, params }) {
    const { text } = input;
    const { action, indent } = params;

    if (!text) return { output: { text: '' }, error: null };

    try {
      const json = JSON.parse(text);
      let result = '';
      if (action === 'format') {
        const space = indent === 'tab' ? '\t' : Number(indent);
        result = JSON.stringify(json, null, space);
      } else if (action === 'compress') {
        result = JSON.stringify(json);
      }
      return { output: { text: result }, error: null };
    } catch (err) {
      return { output: null, error: err.message };
    }
  }
};
```

**app.js 改造后**：

```javascript
// 独立页面模式下，app.js 把 DOM 输入包成对象，调用 Core，再渲染结果
const result = await window.TOOL_JSON_CORE.run({
  input: { text: el.input.value },
  params: { action: 'format', indent: '2' }
});
if (result.error) {
  showError(result.error);
} else {
  el.result.textContent = result.output.text;
}
```

---

## 3. 全局基础设施

### 3.1 工具注册中心 (`assets/js/tool-registry.js`)

所有工具注册到全局注册表，工作流引擎通过 ID 查找工具元数据和核心逻辑。

```javascript
window.TOOL_REGISTRY = {
  _tools: new Map(),

  register(manifest) {
    this._tools.set(manifest.id, manifest);
  },

  get(id) {
    return this._tools.get(id);
  },

  list() {
    return Array.from(this._tools.values());
  },

  // 加载指定工具的 core.js（动态加载，按需）
  async loadCore(id) {
    const manifest = this.get(id);
    if (!manifest) throw new Error(`Tool ${id} not registered`);

    const coreGlobal = `TOOL_${id.toUpperCase().replace(/-/g, '_')}_CORE`;
    if (window[coreGlobal]) return window[coreGlobal];

    // 动态加载 core.js
    await this._loadScript(`../tools/${id}/core.js`);
    return window[coreGlobal];
  },

  _loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }
};
```

### 3.2 工作流引擎 (`assets/js/workflow-engine.js`)

执行有向无环图（DAG）的核心引擎。

#### 3.2.1 数据流模型

工作流是一个有向无环图：

```javascript
const workflow = {
  nodes: [
    { id: 'n1', tool: 'http-request', params: { method: 'GET', url: 'https://api.example.com/user/1' } },
    { id: 'n2', tool: 'http-request', params: { method: 'GET', url: 'https://api.example.com/user/2' } },
    { id: 'n3', tool: 'json', params: { action: 'format', indent: '2' } },
    { id: 'n4', tool: 'json', params: { action: 'format', indent: '2' } },
    { id: 'n5', tool: 'diff', params: { mode: 'lines' } }
  ],
  edges: [
    // HTTP 1 → JSON 格式化
    { from: 'n1', to: 'n3', fromOutput: 'body', toInput: 'text' },
    // HTTP 2 → JSON 格式化
    { from: 'n2', to: 'n4', fromOutput: 'body', toInput: 'text' },
    // 两个 JSON 结果 → Diff
    { from: 'n3', to: 'n5', fromOutput: 'text', toInput: 'oldText' },
    { from: 'n4', to: 'n5', fromOutput: 'text', toInput: 'newText' }
  ]
};
```

#### 3.2.2 引擎执行逻辑

```javascript
class WorkflowEngine {
  constructor() {
    this.states = {};      // 每个节点的输出缓存
    this.logs = [];        // 执行日志
  }

  async run(workflow) {
    this.states = {};
    this.logs = [];

    // 拓扑排序确定执行顺序
    const order = this.topologicalSort(workflow);

    for (const nodeId of order) {
      const node = workflow.nodes.find(n => n.id === nodeId);
      const startTime = performance.now();

      try {
        const result = await this.executeNode(node, workflow);
        this.states[nodeId] = result.output;
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
        // 错误处理策略：中断或继续（可配置）
        throw new Error(`节点 ${nodeId} (${node.tool}) 执行失败: ${err.message}`);
      }
    }

    return { states: this.states, logs: this.logs };
  }

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

    // 执行
    return await core.run({ input, params: node.params });
  }

  topologicalSort(workflow) {
    const inDegree = {};
    const adj = {};

    workflow.nodes.forEach(n => { inDegree[n.id] = 0; adj[n.id] = []; });
    workflow.edges.forEach(e => {
      adj[e.from].push(e.to);
      inDegree[e.to]++;
    });

    const queue = workflow.nodes.filter(n => inDegree[n.id] === 0).map(n => n.id);
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
```

#### 3.2.3 批量执行支持

高频场景：多次调用接口，传参不同。

```javascript
// 一个节点可以展开为批量任务
{
  id: 'batch-http',
  tool: 'http-request',
  batch: {
    source: 'array',           // 从数组循环
    items: [
      { url: 'https://api.example.com/user/1' },
      { url: 'https://api.example.com/user/2' },
      { url: 'https://api.example.com/user/3' }
    ],
    paramMapping: { url: 'url' }  // 数组项的字段映射到工具参数
  }
}
// 执行后，该节点输出变为数组：[{ body: '...' }, { body: '...' }, ...]
// 下游节点若不支持数组，引擎自动按索引分发到多个并行分支
```

---

## 4. 工作流编排 UI (`workflow/`)

### 4.1 界面布局

```
┌─────────────────────────────────────────────────────────────┐
│ 工具箱              │          画布（SVG 连线）              │
│                     │                                        │
│ [📝 JSON]           │    ┌─────────┐      ┌─────────┐      │
│ [🌐 HTTP]           │    │ HTTP #1 │─────▶│ JSON    │      │
│ [🔄 Diff]           │    └─────────┘      └─────────┘      │
│ [🔍 Regex]          │         │                   │          │
│                     │    ┌─────────┐      ┌─────────┐      │
│ 双击或拖拽添加节点   │    │ HTTP #2 │─────▶│ JSON    │      │
│                     │    └─────────┘      └─────────┘      │
│                     │                   │         │          │
│                     │              ┌─────────┐             │
│                     │              │  Diff   │◀─────────── │
│                     │              └─────────┘             │
│                     │                                        │
├─────────────────────┴────────────────────────────────────────┤
│ [运行] [单步调试] [保存] [导入]                                │
│ 日志面板：                                                   │
│ [10:23:01] HTTP #1  200 OK  120ms                           │
│ [10:23:02] JSON     格式化成功  5ms                         │
│ [10:23:02] Diff     发现 3 处差异                            │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 组件说明

- **左侧工具箱**：从 `TOOL_REGISTRY` 读取所有已注册工具，显示图标和名称
- **画布区域**：
  - 节点：矩形卡片，左侧输入端口（圆点），右侧输出端口（圆点）
  - 连线：拖拽端口到另一端口创建边，SVG 贝塞尔曲线
  - 节点位置：绝对定位 + `transform: translate()`
- **右侧属性面板**（选中节点后展开）：显示该工具的参数配置表单（和独立工具的表单一致）
- **底部日志面板**：显示每一步的输入/输出/耗时/状态

### 4.3 交互细节

- 双击左侧工具 → 在画布中央创建节点
- 拖拽节点 → 移动位置
- 拖拽端口 → 绘制连线，松开时若落在另一端口则创建边
- 点击节点 → 右侧显示属性面板，可修改参数
- 右键节点 → 删除节点（连带删除相关边）
- 点击连线 → 高亮，Delete 键删除

---

## 5. 渐进迁移路径

### 阶段 1：搭骨架（JSON 工具试点）

目标：验证架构可行性，跑通最小闭环。

1. 新建 `assets/js/tool-registry.js`
2. 新建 `assets/js/workflow-engine.js`
3. 拆分 JSON 工具：
   - 新建 `tools/json/core.js`
   - 新建 `tools/json/manifest.js`
   - 改造 `tools/json/app.js`（变薄，调用 Core）
4. 新建 `workflow/index.html` + `app.js` + `styles.css`
   - 支持拖拽 JSON 节点
   - 支持两个 JSON 节点连线
   - 支持运行并查看结果

**验收标准**：在画布上拖入两个 JSON 节点，设置不同参数，连线，点击运行，第二个节点拿到第一个节点的输出并正确处理。

### 阶段 2：扩展核心工具（3-5 个）

目标：覆盖高频串联场景。

5. 拆分 diff 工具：`core.js` + `manifest.js`
6. 拆分 http-request 工具：`core.js` + `manifest.js`
7. 拆分 base64 工具：`core.js` + `manifest.js`
8. 工作流支持多节点编排 + 连线 + 批量执行

**验收标准**：实现用户原始需求——HTTP 多次调用 → JSON 格式化 → 文本对比

### 阶段 3：全部迁移（剩余工具）

目标：所有工具均可用于工作流。

9. 逐个工具抽离 Core 和 Manifest，每个工具半天工作量
10. 工作流支持保存/导入 workflow JSON

**验收标准**：任意两个工具可以在工作流中串联。

### 阶段 4：增强

目标：支持更复杂的编排逻辑。

11. 条件分支节点（if/else）
12. 循环节点（for-each）
13. 定时触发（cron 触发工作流）
14. 变量/上下文传递（节点间共享临时变量）

---

## 6. 文件变更清单

### 新增文件

| 文件 | 说明 |
|---|---|
| `assets/js/tool-registry.js` | 工具注册中心 |
| `assets/js/workflow-engine.js` | 工作流执行引擎 |
| `workflow/index.html` | 工作流编排页面 |
| `workflow/app.js` | 画布渲染、节点拖拽、连线绘制 |
| `workflow/styles.css` | 画布样式 |

### 每个工具新增文件（以 JSON 为例）

| 文件 | 说明 |
|---|---|
| `tools/json/core.js` | 纯函数核心逻辑 |
| `tools/json/manifest.js` | 工具元数据 |

### 每个工具改造文件（以 JSON 为例）

| 文件 | 变更 |
|---|---|
| `tools/json/app.js` | 逻辑抽离到 core.js，app.js 变薄为 UI 层 |
| `tools/json/index.html` | 引入 manifest.js 和 core.js |

### 全局改造

| 文件 | 变更 |
|---|---|
| `index.html` | 新增"工作流"菜单入口 |
| `assets/js/index.js` | 新增 workflow 路由 |

---

## 7. 关键决策记录

| 决策 | 选择 | 原因 |
|---|---|---|
| iframe 保留吗？ | **保留** | 独立访问场景仍需，向后兼容 |
| Core 必须异步吗？ | **是** | HTTP 请求、文件读取都是异步 |
| 状态存在哪？ | **内存 + 导出 JSON** | 工作流定义本身即状态 |
| 需要后端吗？ | **不需要** | 纯前端，所有执行在浏览器 |
| 节点位置持久化？ | **是，存 workflow JSON** | 关闭后重新打开保持布局 |
| 错误处理策略？ | **默认中断，可配置继续** | 调试时中断，生产流水线可配置忽略 |

---

## 8. 风险与应对

| 风险 | 应对 |
|---|---|
| 拆分 Core 时引入 bug | 每个工具拆分后立即测试独立页面，确保功能不变 |
| 工作流画布性能差（节点多） | 使用 DocumentFragment 批量渲染，节点位置用 CSS transform |
| 浏览器 CORS 限制 HTTP 节点 | HTTP Core 中捕获 CORS 错误，提示用户使用生成的 curl 代码 |
| 循环依赖检测遗漏 | 拓扑排序时严格检查，存在环时抛错并高亮环状节点 |

---

## 9. 下一步行动

1. ✅ 创建分支 `workflow-refactor`
2. ✅ 编写本设计文档
3. ⬜ 创建 `assets/js/tool-registry.js`
4. ⬜ 创建 `assets/js/workflow-engine.js`
5. ⬜ 拆分 JSON 工具（`core.js` + `manifest.js`）
6. ⬜ 创建工作流画布骨架（`workflow/index.html` + `app.js` + `styles.css`）
7. ⬜ 验证：两个 JSON 节点连线运行
