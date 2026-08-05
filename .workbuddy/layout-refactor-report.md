# 节点展开/收起错位根治 + 自动布局

## 问题根因

节点用 `max-height` CSS 过渡（0.2s ease）实现展开/收起动画，但连线端点坐标由 JS `getPortY()` 在 rAF 回调中即时计算。两套机制时间轴不同步：

- hover 瞬间：JS 立刻把边端点跳到展开后坐标，但 CSS 动画还在过渡中
- hover 离开：边先跳回收起坐标，节点还在收起动画中
- 多节点连线时连锁跳动

## 修复方案：height:auto + 端口常驻

### CSS 变更（`workflow/styles.css`）

| 选择器 | 原值 | 新值 |
|---|---|---|
| `.workflow-node` | `max-height: 80px; overflow: hidden; transition: max-height 0.2s` | `height: auto; overflow: visible; transition: border-color 0.15s, box-shadow 0.15s` |
| `:hover/.is-selected/.is-connecting` | `max-height: 1000px; overflow: visible` | 删除（不再需要展开规则） |
| `.workflow-port` | `opacity: 0; pointer-events: none` | `opacity: 1; pointer-events: auto` |
| `.workflow-node-ports` | `border-top: 1px solid transparent` + hover 触发 | `border-top: 1px solid var(--color-border)` 始终显示 |
| `.workflow-port-label` | `opacity: 0` + hover 淡入 | 保留不变（纯 opacity 不改布局，无时序冲突） |

### JS 变更（`workflow/app.js`）

**删除：**
- `isNodeExpanded()` 函数
- `state.hoveredNode` 字段及所有引用（state 定义、restoreState、applyWorkflowData、doClear）
- `renderNode` 中的 `mouseenter`/`mouseleave` 事件处理器
- 画布点击取消选中时的 `scheduleRenderEdges()` 调用

**简化：**
- `getPortY(portIndex, nodeId)` → `getPortY(portIndex)`：始终返回 `NODE_HEADER_H + PORT_START_Y + portIndex * PORT_SPACING + PORT_RADIUS`，无折叠/展开分支
- `renderNode`：无端口节点（uuid/password-generator）不渲染 `.workflow-node-ports` div

### 新增：自动布局

- `autoLayout()` 函数：Kahn 拓扑分层 + 同层竖向居中排列
  - 层间距 = NODE_WIDTH + 100 = 460px
  - 同层间距 = 40px
  - 支持环中节点（未覆盖的放到最后一层）
- 工具栏新增"⇄ 自动排列"按钮（`data-action="auto-layout"`）
- 注册到 `ACTIONS` 表

## 修改文件

| 文件 | 改动 |
|---|---|
| `workflow/styles.css` | 节点/端口/端口区 CSS 重构 |
| `workflow/app.js` | 删除 isNodeExpanded/hoveredNode/getPortY 简化/renderNode 无端口处理/autoLayout 新增 |
| `workflow/index.html` | 工具栏加"自动排列"按钮 |

## 效果

- 少端口节点（1入1出）：~136px 高，紧凑
- 多端口节点（2入6出）：~376px 高，所有端口始终可见可连
- 无端口节点：~80px 高，仅 header
- 无任何 CSS 过渡动画 → 零时序冲突 → 零错位
- 自动排列一键整理布局
