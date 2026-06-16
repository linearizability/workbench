# Workbench - 开发规范文档

## 项目概述

纯前端在线工具集合 + 工作流编排平台，提供多种常用开发者工具，并支持工具之间的可视化串联与自动化执行。

## 模块说明

### 聚合主页（壳页面） (index.html)
**位置**：`workbench/index.html`

**功能**：
- 左侧菜单导航：常用链接、工具箱（支持后续扩展）
- 模块装载：通过 iframe 装载各个子工具页面

### 工作流编排 (workflow/)
**位置**：`workbench/workflow/index.html`

**功能**：
- 可视化画布：拖拽节点、连线编排工具执行流程
- 左侧工具箱：双击工具添加到画布
- 右侧属性面板：选中节点后配置参数
- 底部日志/结果面板：显示执行过程和结果
- 条件分支节点、循环节点等控制流
- 本地保存/加载/导出/导入工作流 JSON
- 自动运行（定时触发）

**节点交互设计**：
- 默认收起：所有节点统一 180×40px，仅显示 header（图标+名称+状态）
- hover/选中/拖拽连线时展开：显示输入/输出端口
- 节点高度由端口数量动态计算（`portsHeight = maxPorts × PORT_SPACING + 顶部/底部padding`）
- 端口 absolute 定位在 `.workflow-node-ports` 内，通过 `top: PORT_START_Y + i × PORT_SPACING` 排列
- 收起时连线收缩到 header 中心（20px），展开时精确连接到对应端口
- hover 展开/收起时自动重绘连线

### 常用链接工具 (links/)
**位置**：`workbench/links/index.html`

**注意**：`links/` 是**根级独立模块**，与 `tools/` 同级，不是工具箱内的子工具。

**功能**：
- 链接管理：新增、编辑、删除
- 分类展示、搜索过滤、置顶与拖拽排序
- 批量导入、配置迁移（导出/导入 JSON）
- 本地持久化：`tools_home_links` / `tools_home_deleted_default_link_ids` / `tools_home_link_order` / `tools_home_link_meta`

### 文本处理 (notepad/)
**位置**：`workbench/notepad/index.html`

**注意**：`notepad/` 是**根级独立模块**，与 `tools/` 同级。

**功能**：
- 富文本编辑器，支持基础排版
- 本地自动保存

### 工具箱 (tools/*)
所有位于 `tools/` 目录下的工具，均已拆分为三层架构：

```
tools/<tool-id>/
├── index.html        # 独立页面入口（完全保留，向后兼容）
├── app.js            # UI 层：DOM 操作、事件绑定（调用 Core）
├── core.js           # 核心层：纯函数，接收 { input, params }，返回 { output, error }
├── manifest.js       # 元数据层：id、名称、输入/输出/参数定义
└── styles.css        # 工具样式
```

**已拆分工具清单**：json, diff, http-request, base64, uuid, md5, url, jwt, timestamp, cron, qrcode, regex, file-generator, image-generator, properties-yaml, svg-editor, json-to-struct, password-generator, unicode

## 目录结构

```
workbench/
├── index.html              # 主入口页面
├── README.md               # 本文件
├── WORKFLOW_DESIGN.md      # 工作流架构设计文档
├── assets/                 # 静态资源
│   ├── css/
│   │   ├── main.css
│   │   ├── variables.css
│   │   ├── index.css
│   │   └── components/
│   │       ├── buttons.css
│   │       ├── card.css
│   │       ├── editor.css
│   │       ├── modal.css
│   │       ├── tool-layout.css
│   │       └── toolbar.css
│   └── js/
│       ├── main.js
│       ├── index.js        # 聚合页壳逻辑（导航/路由/iframe装载）
│       ├── utils.js        # 通用工具函数（storage、toast、copy等）
│       ├── tool-registry.js # 工具注册中心
│       └── workflow-engine.js # 工作流执行引擎
├── links/                  # 常用链接（根级独立模块）
├── notepad/                # 文本处理（根级独立模块）
├── workflow/               # 工作流编排
│   ├── index.html
│   ├── app.js              # 画布渲染、节点拖拽、连线绘制
│   └── styles.css
├── tools/                  # 工具箱
│   ├── json/
│   ├── diff/
│   ├── http-request/
│   ├── base64/
│   ├── uuid/
│   ├── md5/
│   ├── url/
│   ├── jwt/
│   ├── timestamp/
│   ├── cron/
│   ├── qrcode/
│   ├── regex/
│   ├── file-generator/
│   ├── image-generator/
│   ├── properties-yaml/
│   ├── svg-editor/
│   └── json-to-struct/
│   ├── password-generator/
│   └── unicode/
└── ...
```

## 全局基础设施

### 工具注册中心 (`assets/js/tool-registry.js`)

所有工具通过 `manifest.js` 注册到全局注册表。工作流引擎通过 ID 查找工具元数据和核心逻辑。

**关键机制：`ROOT_LEVEL_TOOLS`**
- `links` 和 `notepad` 是根级独立模块，`core.js` 位于 `../<id>/core.js`
- 其他工具位于 `tools/` 下，`core.js` 位于 `../tools/<id>/core.js`
- `loadCore(id)` 方法会根据 `ROOT_LEVEL_TOOLS` 集合自动选择正确的 basePath

```javascript
const ROOT_LEVEL_TOOLS = new Set(['links', 'notepad']);

async loadCore(id) {
  const basePath = ROOT_LEVEL_TOOLS.has(id) ? `../${id}` : `../tools/${id}`;
  await this._loadScript(`${basePath}/core.js`);
  // ...
}
```

### 工作流引擎 (`assets/js/workflow-engine.js`)

执行 DAG（有向无环图）的核心引擎：
- 拓扑排序确定执行顺序
- 节点间通过 `edges` 传递数据（`fromOutput` → `toInput`）
- 支持条件分支和循环节点
- 执行日志和状态缓存

## 样式与脚本组织规范

### CSS 分层
- **变量层**：`assets/css/variables.css` — 颜色/间距/字体/阴影/z-index 等设计 token
- **基础层**：`assets/css/main.css` — 全局 reset、排版基础、工具类
- **组件层**：`assets/css/components/*.css` — 跨工具复用的 UI 组件样式
  - `buttons.css` / `toolbar.css` / `card.css` / `modal.css` / `tool-layout.css` / `editor.css`
- **工具层**：`<tool>/styles.css` — 仅放该工具独有的差异样式

### JS 组织
- **通用能力**：`assets/js/utils.js`（storage、toast、copy、download 等）
- **工具逻辑**：`<tool>/app.js`，IIFE 自包含
- **聚合页壳逻辑**：`assets/js/index.js` — 导航、路由、iframe 装载
- **工作流画布**：`workflow/app.js` — 节点渲染、拖拽、连线

## 快速继续开发

### 运行方式（开发调试）
纯静态站点，无构建。推荐用静态服务器打开：

```bash
# Python
python -m http.server 4173

# Node.js
npx serve -l 4173

# 访问入口
# 壳页面：http://localhost:4173/index.html
# 工作流：http://localhost:4173/workflow/index.html
# 子工具：http://localhost:4173/<tool>/index.html
```

### 新增一个子工具（Checklist）
1. **创建目录**：`workbench/tools/<tool-id>/`
2. **四件套**：`index.html` + `app.js` + `core.js` + `manifest.js` + `styles.css`
3. **引入通用 CSS**：`../assets/css/variables.css` → `main.css` → `components/*.css` → `./styles.css`
4. **编写 manifest.js**：注册到 `TOOL_REGISTRY`，声明 inputs/outputs/params
5. **编写 core.js**：纯函数，接收 `{ input, params }`，返回 `{ output, error }`
6. **挂到菜单**：修改 `index.html`（工具箱二级按钮加 `data-nav="<tool-id>"`）
7. **挂到路由**：修改 `assets/js/index.js` 的 `ROUTES`，加 `'<tool-id>': './tools/<tool-id>/index.html'`
8. **工作流支持**：确保 manifest.js 中声明了 `inputs` 和 `outputs`，工作流页面会自动识别

### 事件绑定规范
- 动态渲染的 DOM 必须使用事件委托：`document.addEventListener('click', (e) => e.target.closest('[data-action]'))`
- 按钮位于 `<a>` 内部时：`e.preventDefault()` + `e.stopPropagation()`

### 外部依赖（CDN）使用约定
- 优先用 CDNJS，限定在具体工具页面内引入
- 当前已使用：Prism.js（JSON 高亮）、js-yaml（YAML 解析）
- CDN 加载失败时必须降级，不得崩溃

### 剪贴板能力说明
- `navigator.clipboard.read()` 在部分浏览器需要 HTTPS + 用户手势 + 权限
- 先尝试 `readText()`，再尝试 `read()`，给出明确错误提示

### 安全约定（预览渲染）
- 用户输入渲染为 HTML/SVG 时，使用 `iframe sandbox + srcdoc` 隔离（如 `svg-editor`）

## 各工具模块详情

### JSON 工具 (tools/json/)
- JSON 格式化（2/4空格/Tab）、压缩、验证
- JSON → XML / CSV 转换、键名排序、路径查询
- 历史记录（localStorage 最近 10 次）

### 文本对比 (tools/diff/)
- 比较两段文本差异，支持行级/词级/字符级对比
- 5 个输出端口：格式化对比文本、差异结果数组、统计信息、原始文本（透传）、新文本（透传）

### HTTP 请求 (tools/http-request/)
- 支持 GET/POST/PUT/DELETE 等方法
- 自定义 Headers、Body、超时
- 输出：响应体、状态码、状态文本、是否成功、响应头、耗时

### 其他工具
- **base64**：Base64 编解码
- **uuid**：UUID 生成
- **md5**：MD5 哈希计算
- **url**：URL 编解码、解析
- **jwt**：JWT 解码、验证
- **timestamp**：时间戳转换
- **cron**：Cron 表达式解析、验证
- **qrcode**：二维码生成
- **regex**：正则表达式测试
- **file-generator**：模板文件生成与下载
- **image-generator**：占位图生成（PNG/JPEG/WebP）
- **properties-yaml**：Properties ↔ YAML 双向转换
- **svg-editor**：SVG 源码编辑与预览（iframe sandbox 隔离）
- **json-to-struct**：JSON 转多种语言的结构体定义
- **password-generator**：安全随机密码生成、强度评估、批量生成
- **unicode**：Unicode 编码与解码，支持多种格式（\uXXXX、\u{X}、U+、0x、&#x;、%u）

## 代码规范

### HTML
- 语义化标签、2 空格缩进、双引号属性

### CSS
- CSS Variables、Flexbox/Grid、相对单位（rem/em/%）

### JavaScript
- ES6+、const/let、IIFE 避免全局污染、函数单一职责

### Git 提交规范
```
feat: 新增功能
fix: 修复 bug
docs: 文档更新
style: 样式调整
refactor: 重构
perf: 性能优化
```
