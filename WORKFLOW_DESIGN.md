# Workbench 工作流模块 — 架构设计文档

> 状态：阶段 1-4 核心功能已完成，进入维护与优化阶段

---

## 1. 项目现状

当前 Workbench 包含 **19 个工具**（17 个在 `tools/` + `links` + `notepad`），全部已完成 `core.js` + `manifest.js` 拆分，可在工作流中串联使用。

已开发工具清单：links, notepad, json, file-generator, image-generator, properties-yaml, svg-editor, md5, base64, qrcode, timestamp, cron, url, jwt, uuid, regex, diff, json-to-struct, http-request

**根级独立模块**：`links/` 和 `notepad/` 与 `tools/` 同级，不是工具箱子模块。`TOOL_REGISTRY.loadCore()` 通过 `ROOT_LEVEL_TOOLS` 集合区分加载路径。

---

## 2. 目标架构

```
Workbench
├── 常用链接      (links/)          — 根级独立模块
├── 文本处理      (notepad/)        — 根级独立模块
├── 工具箱        (tools/*)         — 所有工具已拆分为 core.js + manifest.js
└── 工作流        (workflow/)       — 可视化编排画布（已完成）
```

### 2.1 工具三层分离

每个工具拆分为：

```
tools/<tool-id>/
├── index.html        # 独立页面入口（完全保留，向后兼容）
├── app.js            # UI 层：DOM 操作、事件绑定（变薄，调用 Core）
├── core.js           # 核心层：纯函数，接收 { input, params }，返回 { output, error }
├── manifest.js       # 元数据层：id、名称、输入/输出/参数定义
└── styles.css        # 样式（不变）
```

**关键原则**：
- `app.js` 独立页面完全保留，用户无感知
- `core.js` 绝不操作 DOM，只处理数据转换
- `manifest.js` 是工具注册到工作流引擎的"身份证"

**manifest.js 示例**：

```javascript
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
    { name: 'action', type: 'select', label: '操作', options: ['format', 'compress', 'validate'], default: 'format' }
  ],
  batchable: false
});
```

**core.js 示例**：

```javascript
window.TOOL_JSON_CORE = {
  async run({ input, params }) {
    const { text } = input;
    const { action } = params;
    if (!text) return { output: { text: '' }, error: null };
    try {
      const json = JSON.parse(text);
      const result = action === 'format' ? JSON.stringify(json, null, 2) : JSON.stringify(json);
      return { output: { text: result }, error: null };
    } catch (err) {
      return { output: null, error: err.message };
    }
  }
};
```

---

## 3. 全局基础设施

### 3.1 工具注册中心 (`assets/js/tool-registry.js`)

所有工具注册到全局注册表，工作流引擎通过 ID 查找。

**ROOT_LEVEL_TOOLS 机制**：
```javascript
const ROOT_LEVEL_TOOLS = new Set(['links', 'notepad']);

async loadCore(id) {
  const basePath = ROOT_LEVEL_TOOLS.has(id) ? `../${id}` : `../tools/${id}`;
  await this._loadScript(`${basePath}/core.js`);
  // ...
}
```

- `links` 和 `notepad` 是根级独立模块，`core.js` 在根目录
- 其余工具在 `tools/` 下

### 3.2 工作流引擎 (`assets/js/workflow-engine.js`)

执行 DAG 的核心引擎。

**数据流模型**：
```javascript
const workflow = {
  nodes: [
    { id: 'n1', tool: 'http-request', params: { method: 'GET', url: '...' } },
    { id: 'n2', tool: 'json', params: { action: 'format' } }
  ],
  edges: [
    { from: 'n1', to: 'n2', fromOutput: 'body', toInput: 'text' }
  ]
};
```

**执行逻辑**：拓扑排序 → 按序执行节点 → 收集上游输出作为当前节点输入 → 缓存结果

---

## 4. 工作流编排 UI (`workflow/`)

### 4.1 界面布局

```
┌─────────────────────────────────────────────────────────────┐
│ 工具箱              │          画布（SVG 连线）    │ 属性面板 │
│                     │                               │         │
│ [📝 JSON]           │    ┌─────────┐               │ 参数配置 │
│ [🌐 HTTP]           │    │ HTTP #1 │─────▶┌──────┐│         │
│ [🔄 Diff]           │    └─────────┘      │ JSON ││         │
│ [🔍 Regex]          │                     └──────┘│         │
│                     │                               │         │
│ 双击添加节点         │                               │         │
│                     │                               │         │
├─────────────────────┴───────────────────────────────┴─────────┤
│ [运行] [保存] [导入] [导出] [自动运行]                         │
│ 日志面板 / 执行结果面板                                       │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 节点设计：Header + Collapsible Ports

**默认状态（收起）**：
- 尺寸：180×40px（所有节点统一大小）
- 内容：仅 header（图标 + 名称 + 状态徽章）
- 连线：收缩到 header 中心（Y = 20px）

**展开状态（hover / 选中 / 拖拽连线）**：
- 端口区显示：输入端口在左侧，输出端口在右侧
- 节点高度由端口数量动态计算：
  ```javascript
  portsHeight = maxPorts × PORT_SPACING + PORT_START_Y × 2
  nodeHeight = NODE_HEADER_H + portsHeight  // 40 + portsHeight
  ```
- 端口位置（相对于 `.workflow-node-ports`）：
  ```javascript
  portTop = PORT_START_Y + index × PORT_SPACING  // PORT_START_Y = 14, PORT_SPACING = 22
  ```
- 连线：精确连接到对应端口的中心

**端口可见性控制**：
- 默认 `opacity: 0; pointer-events: none`
- 展开时 `opacity: 1; pointer-events: auto`
- 拖拽连线时（`is-connecting` 类）所有节点端口临时显示

**CSS 关键规则**：
```css
.workflow-node {
  width: 180px;
  max-height: 40px;
  overflow: hidden;
  transition: max-height 0.2s ease;
}
.workflow-node:hover,
.workflow-node.is-selected,
.workflow-node.is-connecting {
  max-height: 500px;
  overflow: visible;
}
```

### 4.3 连线动态定位

`getPortY(portIndex, nodeId)` 根据节点展开状态返回不同坐标：
- **收起**：返回 `NODE_HEADER_H / 2`（20px，header 中心）
- **展开**：返回 `NODE_HEADER_H + PORT_START_Y + portIndex × PORT_SPACING + PORT_RADIUS`

**触发重绘时机**：
- `selectNode()` — 选中/取消选中
- `handleMouseDown()` — 点击画布空白处取消选中
- `mouseenter` / `mouseleave` — hover 展开/收起
- `handleMouseMove()` — 节点拖拽移动
- `startDrawingEdge()` / `cancelDrawingEdge()` — 开始/取消连线

### 4.4 交互细节

- 双击左侧工具 → 在画布中央创建节点
- 拖拽节点 → 移动位置（`transform: translate`）
- 拖拽输出端口 → 绘制连线，松开时落在输入端口则创建边
- 点击节点 → 右侧显示属性面板，可修改参数
- 点击画布空白处 → 取消选中，节点收起
- 点击连线 → 高亮，Delete 键删除
- 右键节点 → 删除节点（连带删除相关边）

---

## 5. 已完成功能清单

### 阶段 1：搭骨架 ✅
- [x] `assets/js/tool-registry.js` — 工具注册中心（含 ROOT_LEVEL_TOOLS）
- [x] `assets/js/workflow-engine.js` — 工作流执行引擎
- [x] JSON 工具拆分（core.js + manifest.js）
- [x] `workflow/index.html` + `app.js` + `styles.css` — 画布骨架

### 阶段 2：扩展核心工具 ✅
- [x] diff、http-request、base64 拆分
- [x] 多节点编排 + 连线 + 运行

### 阶段 3：全部迁移 ✅
- [x] 所有 19 个工具均已拆分 core.js + manifest.js
- [x] 工作流支持保存/导入 workflow JSON（localStorage）
- [x] 导出/导入工作流文件

### 阶段 4：增强 ✅
- [x] 条件分支节点（`__condition`）— 根据表达式输出 true/false 分支
- [x] 循环节点（`__foreach`）— 对数组每项执行处理
- [x] 变量引用 — 节点参数支持 `{{节点ID.字段名}}` 表达式
- [x] 自动运行 — 支持定时触发（间隔/cron 表达式）
- [x] 执行结果可视化 — 画布下方显示 diff/JSON 等执行结果

---

## 6. 文件清单

### 全局基础设施

| 文件 | 说明 |
|---|---|
| `assets/js/tool-registry.js` | 工具注册中心（含 ROOT_LEVEL_TOOLS） |
| `assets/js/workflow-engine.js` | 工作流执行引擎 |
| `assets/js/index.js` | 聚合页路由（含 workflow 路由） |

### 工作流画布

| 文件 | 说明 |
|---|---|
| `workflow/index.html` | 工作流编排页面 |
| `workflow/app.js` | 画布渲染、节点拖拽、连线绘制、属性面板 |
| `workflow/styles.css` | 画布样式（节点、端口、连线、动画） |

### 每个工具的文件（以 JSON 为例）

| 文件 | 说明 |
|---|---|
| `tools/json/core.js` | 纯函数核心逻辑 |
| `tools/json/manifest.js` | 工具元数据（注册到 TOOL_REGISTRY） |
| `tools/json/app.js` | UI 层（已变薄，调用 Core） |
| `tools/json/index.html` | 独立页面入口 |

---

## 7. 关键决策记录

| 决策 | 选择 | 原因 |
|---|---|---|
| iframe 保留吗？ | **保留** | 独立访问场景仍需，向后兼容 |
| Core 必须异步吗？ | **是** | HTTP 请求等操作是异步的 |
| 状态存在哪？ | **内存 + localStorage + 导出 JSON** | 工作流定义本身即状态 |
| 需要后端吗？ | **不需要** | 纯前端，所有执行在浏览器 |
| 节点位置持久化？ | **是，存 workflow JSON** | 关闭后重新打开保持布局 |
| 节点大小统一？ | **是，默认 180×40px** | 视觉效果整齐，hover 展开 |
| 连线随展开动态调整？ | **是** | 收起时缩到 header 中心，展开时连到端口 |
| links/notepad 位置？ | **根级独立模块** | 与工具箱同级，不走 tools/ 路径 |

---

## 8. 风险与应对

| 风险 | 应对 |
|---|---|
| 拆分 Core 时引入 bug | 每个工具拆分后立即测试独立页面 |
| 工作流画布性能差 | CSS transform 移动节点，批量渲染 SVG 连线 |
| 浏览器 CORS 限制 HTTP 节点 | Core 中捕获 CORS 错误，提示使用 curl |
| 循环依赖检测遗漏 | 拓扑排序时严格检查，存在环时抛错 |
| 节点 hover 误触 | `pointer-events` 控制，收起时端口不可交互 |

---

## 9. 后续可优化方向

1. **节点 hover 连线实时更新**：当前已实现，可进一步优化性能（节流 renderEdges）
2. **批量执行并行化**：循环节点内的多个任务可并行执行
3. **工作流模板**：提供常用模板（HTTP → JSON → Diff 等）
4. **节点分组/子工作流**：支持将多个节点打包为复合节点
5. **执行历史版本**：保存每次执行的快照，支持回滚对比
6. **快捷键支持**：Delete 删除、Ctrl+S 保存、Ctrl+R 运行等
