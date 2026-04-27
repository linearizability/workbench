# Workbench - 开发规范文档

## 项目概述

纯前端在线工具集合，提供多种常用的开发者工具和生活工具。

## 模块说明

### 聚合主页（壳页面） (index.html)
**位置**：`workbench/index.html`

**功能**：
- 左侧菜单导航：常用链接、工具箱（支持后续扩展）
- 模块装载：通过 iframe 装载各个子工具页面（例如 `links/`、`json/`）

**配置持久化说明**：
- **常用链接默认值**：在 `workbench/links/app.js` 的 `DEFAULT_LINKS` 常量中定义
- **用户自定义链接**：通过 localStorage 保存（同浏览器内持久，key：`tools_home_links`）
- **默认链接删除**：通过 localStorage 记录被删除的默认链接 id（key：`tools_home_deleted_default_link_ids`），用于刷新后不再显示
- **跨浏览器迁移**：在“常用链接”页面使用“导出/导入配置”功能

**链接配置格式**：
```javascript
{
  id: 'unique-id',              // 唯一标识
  name: '链接名称',              // 显示名称
  url: 'https://example.com',    // 链接地址
  category: '分类名称',         // 分类（可选）
  icon: '🔗' or 'icon-url'      // 图标（emoji 或 URL，可选）
}
```

## 目录结构

```
workbench/
├── index.html              # 主入口页面
├── DEVELOPMENT.md          # 开发规范文档
├── assets/                 # 静态资源
│   ├── css/               # 全局样式
│   │   ├── main.css       # 主样式文件
│   │   └── variables.css  # CSS变量定义
│   │   └── components/    # 通用组件样式（避免各工具重复定义）
│   │       ├── buttons.css
│   │       ├── card.css
│   │       ├── editor.css
│   │       ├── modal.css
│   │       ├── tool-layout.css
│   │       └── toolbar.css
│   ├── js/                # 全局脚本
│   │   ├── main.js        # 主脚本（通用初始化，可选）
│   │   ├── index.js       # 聚合页壳页面逻辑（导航/装载模块）
│   │   └── utils.js       # 工具函数
│   └── images/            # 图片资源
├── links/                 # 常用链接工具
│   ├── index.html         # 工具主页面
│   ├── app.js             # 工具逻辑
│   └── styles.css         # 工具样式（可选）
├── file-generator/        # 文件生成器
│   ├── index.html         # 工具主页面
│   ├── app.js             # 工具逻辑
│   └── styles.css         # 工具样式（可选）
├── image-generator/       # 图片生成器
│   ├── index.html         # 工具主页面
│   ├── app.js             # 工具逻辑
│   └── styles.css         # 工具样式（可选）
├── properties-yaml/       # Properties ↔ YAML 工具
│   ├── index.html         # 工具主页面
│   ├── app.js             # 工具逻辑
│   └── styles.css         # 工具样式（可选）
├── svg-editor/            # SVG 编辑器
│   ├── index.html         # 工具主页面
│   ├── app.js             # 工具逻辑
│   └── styles.css         # 工具样式（可选）
├── json/                  # JSON工具
│   ├── index.html         # 工具主页面
│   ├── app.js             # 工具逻辑
│   └── styles.css         # 工具样式（可选）
├── base64/`# Base64工具
├── timestamp/             # 时间戳工具
└── ...                    # 其他工具
```

## 样式与脚本组织规范（重要）

### CSS 分层（推荐）
- **变量层**：`assets/css/variables.css`
  - 只放颜色/间距/字体/阴影/z-index 等设计 token
- **基础层**：`assets/css/main.css`
  - 全局 reset、排版基础、工具类（如 `u-hidden`）
- **组件层**：`assets/css/components/*.css`
  - 跨多个工具复用的 UI 组件样式，**禁止在各工具里重复定义**
  - 当前已沉淀：
    - `buttons.css`：`.btn` / `.btn-primary` / `.btn-secondary` / `.btn-icon` 等
    - `toolbar.css`：`.toolbar` / `.toolbar-group` / `select` 等
    - `card.css`：`.card` / `.card-header` / `.card-body` 等
    - `modal.css`：`.modal` / `.modal-content` / 表单组件等
    - `tool-layout.css`：`.tool-container` / `.tool-header` / `.tool-footer` / `.empty-state` 等
    - `editor.css`：JSON 工具编辑器相关的可复用样式
- **工具层**：`<tool>/styles.css`
  - 只放该工具独有的差异样式（布局微调、特定组件细节），避免复制按钮/模态框等通用代码

### 子工具页面引入顺序（推荐）
每个子工具的 `index.html` 里按如下顺序引入 CSS：
1. `../assets/css/variables.css`
2. `../assets/css/main.css`
3. `../assets/css/components/*.css`（按需要）
4. `./styles.css`（工具差异样式）

### JS 组织建议
- **通用能力**：放在 `assets/js/utils.js`（storage、toast、copy、download 等）
- **工具逻辑**：放在 `<tool>/app.js`，IIFE 自包含，避免全局污染
- **聚合页壳逻辑**：只处理导航与装载（当前在 `assets/js/index.js`）

## 快速继续开发（必读）

### 本项目运行方式（开发调试）
这是纯静态站点，无构建。推荐用静态服务器打开，避免浏览器对本地文件的限制：
- **Python**：
  - `python -m http.server 4173`（在 `workbench/` 目录执行）
- **访问入口**：
  - 壳页面：`/index.html`
  - 子工具：`/<tool>/index.html`（例如 `/json/index.html`）

### 新增一个子工具的最短路径（Checklist）
1. **创建目录**：`workbench/<tool-id>/`
2. **三件套**：`index.html` + `app.js` + `styles.css`
3. **引入通用 CSS（按顺序）**：
   - `../assets/css/variables.css`
   - `../assets/css/main.css`
   - `../assets/css/components/*.css`（按需）
   - `./styles.css`
4. **挂到菜单**：修改 `workbench/index.html`（工具箱二级按钮加 `data-nav="<tool-id>"`）
5. **挂到路由**：修改 `workbench/assets/js/index.js` 的 `ROUTES`，加：
   - `'<tool-id>': './<tool-id>/index.html'`
6. **更新文档**：补充到本文件的“目录结构”和“模块说明”

### 事件绑定规范（避免动态 DOM 按钮失效）
- 若 UI 是通过 `innerHTML` 动态渲染（列表/表格/卡片项等），**必须使用事件委托**，例如：
  - `document.addEventListener('click', (e) => e.target.closest('[data-action]') ...)`
- 典型坑：初始化时 `querySelectorAll()` 只能拿到当时存在的节点，后续渲染出来的按钮不会自动绑定事件。
- 若按钮位于 `<a>` 内部（例如链接卡片右侧操作区），点击按钮必须：
  - `e.preventDefault()` + `e.stopPropagation()`，避免触发链接跳转。

### 外部依赖（CDN）使用约定
- 优先用 **CDNJS**，并限定在具体工具页面内引入，避免污染全局与增加壳页面负担。
- 当前已使用的外部库：
  - **Prism.js**：`workbench/json/` 用于 JSON 高亮（CDN）
  - **js-yaml**：`workbench/json/`、`workbench/properties-yaml/` 用于 YAML 解析/生成（CDN）
- **降级策略必须有**：CDN 加载失败时不得导致工具崩溃（例如 JSON 高亮已做无 Prism 时降级为纯文本）。

### 剪贴板能力说明（权限/HTTPS 约束）
- `navigator.clipboard.read()`（读取剪贴板 items，如 `image/svg+xml`）在部分浏览器需要：
  - HTTPS 环境
  - 用户手势触发
  - 权限允许
- 因此涉及剪贴板的工具必须：
  - 先尝试 `readText()`（最通用）
  - 再尝试 `read()`（尽力而为）
  - 给出明确错误提示，不影响其他功能。

### 安全约定（预览渲染）
- 任何“用户输入 → 渲染为 HTML/SVG”的工具，默认使用隔离方案：
  - 推荐 `iframe sandbox + srcdoc`（例如 `svg-editor`）
  - 避免直接 `innerHTML` 造成脚本执行风险。

### 常用链接工具 (links/)
**位置**：`workbench/links/index.html`

**功能**：
- 链接管理：新增、编辑、删除
- 分类展示：按分类分组展示
- 搜索与过滤：支持按名称/URL/分类搜索与分类下拉过滤
- 置顶与排序：支持置顶（星标）与拖拽排序（持久化）
- 批量导入：支持粘贴文本导入、书签 HTML 导入
- 配置迁移：导入/导出 JSON 配置文件
- 本地持久化：
  - 自定义链接：`tools_home_links`
  - 删除的默认链接：`tools_home_deleted_default_link_ids`
  - 排序：`tools_home_link_order`
  - 元数据（置顶等）：`tools_home_link_meta`

### JSON 工具 (json/)
**位置**：`workbench/json/index.html`

**功能**：
- JSON 格式化：支持 2/4 空格或制表符缩进，带语法高亮
- JSON 压缩：移除空格和换行，一行紧凑输出
- JSON 验证：实时语法检测，显示错误位置和提示
- JSON 结构统计：显示对象、数组、字符串等元素数量
- JSON → XML 转换：将 JSON 数据转换为 XML 格式
- JSON → CSV 转换：将 JSON 数组转换为 CSV 表格
- JSON 键名排序：递归排序嵌套对象的键名
- JSON 路径查询：支持点语法和数组索引查询

**交互功能**：
- 双向编辑区域：输入和结果并列显示
- Tab 键支持：输入框中按 Tab 插入 2 个空格
- 一键复制：快速复制结果到剪贴板
- 下载文件：将结果保存为 JSON 文件
- 清空内容：一键清空输入和输出
- 历史记录：自动保存最近 10 次输入到 localStorage

### 文件生成器 (file-generator/)
**位置**：`workbench/file-generator/index.html`

**功能**：
- 模板生成：空白文件、JSON 配置、CSV 示例、README、`.gitignore`、`.env`
- 一键下载：使用浏览器下载生成文件（不上传）
- 复制内容：一键复制文本到剪贴板

### 图片生成器 (image-generator/)
**位置**：`workbench/image-generator/index.html`

**功能**：
- 占位图生成：自定义宽高、背景色、文字颜色与显示文本
- 导出下载：支持 PNG/JPEG/WebP

### Properties ↔ YAML (properties-yaml/)
**位置**：`workbench/properties-yaml/index.html`

**功能**：
- `.properties` ↔ YAML 双向转换
- 支持 `a.b.c=1` 展平规则与 `arr[0]` 数组索引形式
- 可选：排序键、全部按字符串处理

### SVG 编辑器 (svg-editor/)
**位置**：`workbench/svg-editor/index.html`

**功能**：
- 上传 SVG 文件，展示源码并预览
- 支持粘贴 SVG 文本（最稳定）
- 支持从剪贴板读取 `image/svg+xml`（浏览器/权限/HTTPS 相关，可能受限）
- 修改源码后预览实时更新（使用 `iframe sandbox` 隔离渲染）

## 命名规范

### 文件命名
- HTML文件：使用小写字母和连字符，如 `json-formatter.html`
- CSS文件：使用小写字母和连字符，如 `json-formatter.css`
- JS文件：使用小写字母和连字符，如 `json-formatter.js`

### 函数命名
- 使用驼峰命名法（camelCase）
- 动词作前缀：`handleClick`, `formatJson`, `validateInput`
- 事件处理函数以 `handle` 开头：`handleSubmit`, `handleInputChange`

### 变量命名
- 常量使用全大写下划线：`MAX_SIZE`, `DEFAULT_CONFIG`
- 使用语义化命名，避免单字母（循环变量除外）

### CSS类名
- 使用BEM命名规范：`.block__element--modifier`
- 工具类以 `u-` 开头：`.u-hidden`, `.u-text-center`

## 代码规范

### HTML
- 使用语义化标签
- 缩进使用2个空格
- 属性使用双引号
- 自闭合标签不使用结尾斜杠（HTML5标准）

### CSS
- 使用现代CSS特性（CSS Variables, Flexbox, Grid）
- 优先使用相对单位（rem, em, %）
- 响应式设计优先移动端
- 颜色使用变量定义

### JavaScript
- 使用ES6+语法
- 优先使用 const 和 let
- 避免全局变量污染
- 函数单一职责原则
- 适当的错误处理

## 工具开发模板

### HTML模板
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>工具名称 - Workbench</title>
    <link rel="stylesheet" href="../assets/css/variables.css">
    <link rel="stylesheet" href="../assets/css/main.css">
    <link rel="stylesheet" href="../assets/css/components/tool-layout.css">
    <link rel="stylesheet" href="../assets/css/components/buttons.css">
    <link rel="stylesheet" href="../assets/css/components/toolbar.css">
    <link rel="stylesheet" href="../assets/css/components/card.css">
    <link rel="stylesheet" href="../assets/css/components/editor.css">
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <div class="tool-container">
        <header class="tool-header">
            <h1>工具名称</h1>
            <p class="tool-description">工具描述</p>
        </header>
        <main class="tool-main">
            <!-- 工具内容 -->
        </main>
    </div>
    <script src="../assets/js/utils.js"></script>
    <script src="app.js"></script>
</body>
</html>
```

### JS模板
```javascript
(function() {
    'use strict';

    // 常量定义
    const CONSTANTS = {};

    // 状态管理
    let state = {};

    // DOM元素
    const elements = {};

    // 初始化
    function init() {
        cacheElements();
        bindEvents();
    }

    // 缓存DOM元素
    function cacheElements() {
        elements.input = document.getElementById('input');
        elements.output = document.getElementById('output');
    }

    // 绑定事件
    function bindEvents() {
        elements.input.addEventListener('input', handleInputChange);
    }

    // 事件处理
    function handleInputChange(e) {
        // 处理逻辑
    }

    // 业务函数
    function processData(data) {
        // 业务逻辑
    }

    // 启动
    init();
})();
```

## 组件规范

### 通用组件
- 按钮组件：支持 primary、secondary、danger 等变体
- 输入框组件：支持验证、错误提示
- 模态框组件：支持自定义内容
- Toast提示：成功、错误、警告、信息

### 工具函数（utils.js）
```javascript
// 防抖函数
function debounce(func, wait) {}

// 节流函数
function throttle(func, wait) {}

// 复制到剪贴板
function copyToClipboard(text) {}

// 格式化日期
function formatDate(date, format) {}

// 本地存储
const storage = {
    set(key, value) {},
    get(key) {},
    remove(key) {}
};
```

## 性能优化

- 使用事件委托减少监听器数量
- 大列表使用虚拟滚动
- 图片懒加载
- 避免频繁DOM操作，使用DocumentFragment
- 长任务使用requestIdleCallback

## 兼容性

- 支持现代浏览器（Chrome 80+, Firefox 75+, Safari 13+, Edge 80+）
- 使用PostCSS处理浏览器前缀
- 提供polyfill支持（如需要）

## 安全规范

- 输入验证和清理
- 防止XSS攻击（textContent代替innerHTML）
- CSP策略
- HTTPS部署

## Git提交规范

```
feat: 新增功能
fix: 修复bug
docs: 文档更新
style: 样式调整
refactor: 重构
perf: 性能优化
test: 测试相关
chore: 构建/工具链相关
```

## 部署规范

- 构建压缩
- CDN部署静态资源
- 启用Gzip压缩
- 缓存策略配置
