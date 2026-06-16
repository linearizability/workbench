/**
 * 常用链接工具 - 核心逻辑
 */

(function() {
  'use strict';

  const STORAGE_KEYS = {
    LINKS: 'tools_home_links',
    ORDER: 'tools_home_link_order',
    META: 'tools_home_link_meta',
    CATEGORY_ORDER: 'tools_home_category_order'
  };

  let state = {
    links: [],
    editingLinkId: null,
    category: ''
  };

  const elements = {};

  function init() {
    cacheElements();
    loadLinks();
    renderLinks();
    bindEvents();
  }

  function cacheElements() {
    elements.linksContainer = document.getElementById('links-container');
    elements.linkModal = document.getElementById('link-modal');
    elements.modalTitle = document.getElementById('modal-title');
    elements.linkNameInput = document.getElementById('link-name');
    elements.linkUrlInput = document.getElementById('link-url');
    elements.linkCategorySelect = document.getElementById('link-category-select');
    elements.linkCategoryInput = document.getElementById('link-category-input');
    elements.linkIconInput = document.getElementById('link-icon');
    elements.fileInput = document.getElementById('file-input');
    elements.bookmarkFileInput = document.getElementById('bookmark-file-input');
    elements.categorySelect = document.getElementById('category-select');
    elements.filtersMeta = document.getElementById('filters-meta');

    elements.bulkImportModal = document.getElementById('bulk-import-modal');
    elements.bulkText = document.getElementById('bulk-text');
    elements.bulkDefaultCategory = document.getElementById('bulk-default-category');
    elements.bookmarksHtml = document.getElementById('bookmarks-html');
    elements.bookmarksCategory = document.getElementById('bookmarks-category');
  }

  function bindEvents() {
    // 事件委托：链接列表是动态渲染的，不能只在初始化时绑定按钮
    document.addEventListener('click', handleActionClick);

    elements.linkModal.addEventListener('click', handleModalClick);
    elements.fileInput.addEventListener('change', handleFileSelect);
    elements.bookmarkFileInput.addEventListener('change', handleBookmarksFileSelect);

    elements.categorySelect.addEventListener('change', () => {
      state.category = elements.categorySelect.value;
      renderLinks();
    });

    // 分类下拉：选"新建分类"时切换到文本输入
    elements.linkCategorySelect.addEventListener('change', () => {
      if (elements.linkCategorySelect.value === '__new__') {
        elements.linkCategorySelect.classList.add('u-hidden');
        elements.linkCategoryInput.classList.remove('u-hidden');
        elements.linkCategoryInput.value = '';
        elements.linkCategoryInput.focus();
      }
    });

    // 拖拽排序（事件委托在容器上）
    // mousedown 记录是否按在拖拽手柄上，dragstart 的 e.target 始终是 draggable 元素而非手柄
    elements.linksContainer.addEventListener('mousedown', handleDragMouseDown);
    elements.linksContainer.addEventListener('dragstart', handleDragStart);
    elements.linksContainer.addEventListener('dragover', handleDragOver);
    elements.linksContainer.addEventListener('drop', handleDrop);
    elements.linksContainer.addEventListener('dragend', handleDragEnd);

    // 批量导入 Tab 切换
    document.querySelectorAll('[data-import-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        setImportMode(btn.dataset.importMode);
      });
    });
  }

  function handleActionClick(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;
    const handler = ACTIONS[action];
    if (!handler) return;

    // 防止在 <a> 内点击按钮时触发跳转
    e.preventDefault();
    e.stopPropagation();
    handler(e, target);
  }

  function handleModalClick(e) {
    if (e.target.dataset.action === 'close-modal') {
      closeModal();
    }
  }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const config = JSON.parse(event.target.result);
        importConfig(config);
      } catch (err) {
        showToast('导入失败：无效的配置文件', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function loadLinks() {
    if (typeof storage === 'undefined') {
      console.error('storage 未定义，请确保 utils.js 已加载');
      state.links = [];
      return;
    }

    state.links = storage.get(STORAGE_KEYS.LINKS, []);
    applyMetaToLinks(state.links);
  }

  function getMetaMap() {
    return storage.get(STORAGE_KEYS.META, {});
  }

  function saveMetaMap(map) {
    storage.set(STORAGE_KEYS.META, map);
  }

  function applyMetaToLinks(links) {
    const meta = getMetaMap();
    links.forEach(l => {
      const m = meta[l.id];
      l.pinned = !!(m && m.pinned);
    });
  }

  function togglePin(id) {
    const meta = getMetaMap();
    const cur = meta[id] || {};
    meta[id] = { ...cur, pinned: !cur.pinned };
    saveMetaMap(meta);
    const link = state.links.find(l => l.id === id);
    if (link) link.pinned = !!meta[id].pinned;
    renderLinks();
  }

  function getOrder() {
    return storage.get(STORAGE_KEYS.ORDER, []);
  }

  function saveOrder(order) {
    storage.set(STORAGE_KEYS.ORDER, order);
  }

  function ensureOrderContainsAll(order, links) {
    const set = new Set(order);
    links.forEach(l => {
      if (!set.has(l.id)) order.push(l.id);
    });
    return order;
  }

  function sortLinks(links) {
    const order = ensureOrderContainsAll(getOrder(), links.slice());
    saveOrder(order);
    const indexMap = new Map(order.map((id, idx) => [id, idx]));

    return links.slice().sort((a, b) => {
      const ap = a.pinned ? 1 : 0;
      const bp = b.pinned ? 1 : 0;
      if (ap !== bp) return bp - ap;
      const ai = indexMap.has(a.id) ? indexMap.get(a.id) : Number.MAX_SAFE_INTEGER;
      const bi = indexMap.has(b.id) ? indexMap.get(b.id) : Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return (a.name || '').localeCompare(b.name || '');
    });
  }

  function renderLinks() {
    if (!elements.linksContainer) return;

    const filtered = filterLinks(state.links);

    updateCategoryOptions(state.links);
    updateFiltersMeta(filtered.length, state.links.length);

    if (filtered.length === 0) {
      elements.linksContainer.innerHTML = `
        <div class="empty-state">
          <p>没有匹配的结果</p>
        </div>
      `;
      return;
    }

    const grouped = groupByCategory(sortLinks(filtered));
    const sortedCategories = sortCategories(Object.keys(grouped));

    let html = '';
    sortedCategories.forEach(category => {
      const links = grouped[category];
      const defaultIcon = '🔗';

      html += `
        <div class="link-category" data-category="${escapeHtml(category)}" draggable="true">
          <div class="link-category-header">
            <button type="button" class="link-action drag-category" data-action="drag-category" data-category="${escapeHtml(category)}" title="拖拽排序">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="9" cy="7" r="1.5"/>
                <circle cx="15" cy="7" r="1.5"/>
                <circle cx="9" cy="12" r="1.5"/>
                <circle cx="15" cy="12" r="1.5"/>
                <circle cx="9" cy="17" r="1.5"/>
                <circle cx="15" cy="17" r="1.5"/>
              </svg>
            </button>
            <h3 class="link-category-title">${escapeHtml(category)}</h3>
            <button type="button" class="link-action rename-category" data-action="rename-category" data-category="${escapeHtml(category)}" title="重命名分类">
              <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          </div>
          <div class="link-list">
            ${links.map(link => `
              <a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer" class="link-item ${link.pinned ? 'is-pinned' : ''}" data-id="${escapeHtml(link.id)}" draggable="true">
                <span class="link-icon">${link.icon || defaultIcon}</span>
                <span class="link-name" title="${escapeHtml(link.name)}">${escapeHtml(link.name)}</span>
                <div class="link-actions">
                  <button type="button" class="link-action pin" data-action="toggle-pin" data-id="${escapeHtml(link.id)}" title="${link.pinned ? '取消置顶' : '置顶'}">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 17l-5 3 1-6-4-4 6-.9L12 4l2 5.1 6 .9-4 4 1 6-5-3z"/>
                    </svg>
                  </button>
                  <button type="button" class="link-action drag" data-action="drag-link" data-id="${escapeHtml(link.id)}" title="拖拽排序">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <circle cx="9" cy="7" r="1.5"/>
                      <circle cx="15" cy="7" r="1.5"/>
                      <circle cx="9" cy="12" r="1.5"/>
                      <circle cx="15" cy="12" r="1.5"/>
                      <circle cx="9" cy="17" r="1.5"/>
                      <circle cx="15" cy="17" r="1.5"/>
                    </svg>
                  </button>
                  <button type="button" class="link-action edit" data-action="edit-link" data-id="${escapeHtml(link.id)}" title="编辑">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button type="button" class="link-action delete" data-action="delete-link" data-id="${escapeHtml(link.id)}" title="删除">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <polyline points="3 6 5 6 21 18"/>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 18l-2.4-2.4"/>
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.36 6.64a9 9 0 1 1-12.73 0"/>
                    </svg>
                  </button>
                </div>
              </a>
            `).join('')}
          </div>
        </div>
      `;
    });

    elements.linksContainer.innerHTML = html;
  }

  function filterLinks(links) {
    const cat = state.category || '';
    return links.filter(l => {
      const c = l.category || '其他';
      if (cat && c !== cat) return false;
      return true;
    });
  }

  function updateCategoryOptions(links) {
    if (!elements.categorySelect) return;
    const current = elements.categorySelect.value;
    const cats = Array.from(new Set(links.map(l => l.category || '其他'))).sort();
    const options = [''].concat(cats);

    elements.categorySelect.innerHTML = options.map(v => {
      const label = v ? v : '全部分类';
      return `<option value="${escapeHtml(v)}">${escapeHtml(label)}</option>`;
    }).join('');

    elements.categorySelect.value = options.includes(current) ? current : '';
  }

  function updateFiltersMeta(shown, total) {
    if (!elements.filtersMeta) return;
    elements.filtersMeta.textContent = `显示 ${shown} / ${total}`;
  }
  function groupByCategory(links) {
    return links.reduce((acc, link) => {
      const category = link.category || '其他';
      if (!acc[category]) acc[category] = [];
      acc[category].push(link);
      return acc;
    }, {});
  }

  function openAddLinkModal() {
    state.editingLinkId = null;
    elements.modalTitle.textContent = '添加链接';
    elements.linkNameInput.value = '';
    elements.linkUrlInput.value = '';
    elements.linkIconInput.value = '';
    setCategoryField('');
    openModal();
  }

  function openEditLinkModal(id) {
    const link = state.links.find(l => l.id === id);
    if (!link) return;

    state.editingLinkId = id;
    elements.modalTitle.textContent = '编辑链接';
    elements.linkNameInput.value = link.name || '';
    elements.linkUrlInput.value = link.url || '';
    elements.linkIconInput.value = link.icon || '';
    setCategoryField(link.category || '');
    openModal();
  }

  function openModal() {
    updateCategorySelectOptions();
    elements.linkModal.classList.remove('u-hidden');
    elements.linkNameInput.focus();
  }

  /** 填充分类下拉选项（保留已选值） */
  function updateCategorySelectOptions() {
    const cats = Array.from(new Set(state.links.map(l => l.category || '其他'))).sort();
    const currentVal = elements.linkCategorySelect.value;
    let html = '<option value="">请选择分类</option>';
    cats.forEach(c => {
      html += `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`;
    });
    html += '<option value="__new__">➕ 新建分类…</option>';
    elements.linkCategorySelect.innerHTML = html;
    // 恢复之前选中的值（如果存在于列表中）
    if (currentVal && currentVal !== '__new__') {
      elements.linkCategorySelect.value = currentVal;
    }
  }

  /** 设置分类字段：已有分类用 select，否则显示输入框 */
  function setCategoryField(category) {
    updateCategorySelectOptions();
    const options = Array.from(elements.linkCategorySelect.options).map(o => o.value);
    if (category && options.includes(category)) {
      elements.linkCategorySelect.value = category;
      elements.linkCategorySelect.classList.remove('u-hidden');
      elements.linkCategoryInput.classList.add('u-hidden');
      elements.linkCategoryInput.value = '';
    } else if (category) {
      // 分类不在已有列表中（理论上不会，但做兜底）
      elements.linkCategorySelect.value = '__new__';
      elements.linkCategorySelect.classList.add('u-hidden');
      elements.linkCategoryInput.classList.remove('u-hidden');
      elements.linkCategoryInput.value = category;
    } else {
      elements.linkCategorySelect.value = '';
      elements.linkCategorySelect.classList.remove('u-hidden');
      elements.linkCategoryInput.classList.add('u-hidden');
      elements.linkCategoryInput.value = '';
    }
  }

  /** 读取当前分类值：优先取输入框，否则取下拉 */
  function getCategoryValue() {
    if (!elements.linkCategoryInput.classList.contains('u-hidden')) {
      return elements.linkCategoryInput.value.trim();
    }
    const v = elements.linkCategorySelect.value;
    return (v && v !== '__new__') ? v : '';
  }

  function closeModal() {
    elements.linkModal.classList.add('u-hidden');
    state.editingLinkId = null;
  }

  function saveLink() {
    const name = elements.linkNameInput.value.trim();
    const url = elements.linkUrlInput.value.trim();
    const category = getCategoryValue();
    const icon = elements.linkIconInput.value.trim();

    if (!name || !url) {
      showToast('请填写名称和 URL', 'warning');
      return;
    }

    try {
      new URL(url);
    } catch {
      showToast('请输入有效的 URL', 'warning');
      return;
    }

    const id = state.editingLinkId || generateId(name);

    const link = {
      id,
      name,
      url,
      category: category || '其他',
      icon: icon || null
    };

    const index = state.links.findIndex(l => l.id === id);
    if (index >= 0) {
      state.links[index] = link;
    } else {
      state.links.push(link);
    }

    saveCustomLinks();
    renderLinks();
    closeModal();
    showToast('保存成功', 'success');
  }

  function generateId(name) {
    const base = name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const id = base || 'link';
    let counter = 1;
    let finalId = id;

    while (state.links.some(l => l.id === finalId)) {
      finalId = `${id}-${counter}`;
      counter++;
    }

    return finalId;
  }

  function saveCustomLinks() {
    storage.set(STORAGE_KEYS.LINKS, state.links);
  }

  function deleteLink(id) {
    const index = state.links.findIndex(l => l.id === id);
    if (index < 0) return;

    state.links.splice(index, 1);
    saveCustomLinks();
    renderLinks();
    showToast('删除成功', 'success');
  }

  function renameCategory(oldName) {
    const newName = prompt('重命名分类', oldName);
    if (newName === null) return;
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;

    let count = 0;
    state.links.forEach(l => {
      if ((l.category || '其他') === oldName) {
        l.category = trimmed;
        count++;
      }
    });

    if (count === 0) return;
    saveCustomLinks();
    renderLinks();
    showToast(`已将 ${count} 条链接的分类更新为「${trimmed}」`, 'success');
  }

  function exportConfig() {
    const order = storage.get(STORAGE_KEYS.ORDER, []);
    const meta = storage.get(STORAGE_KEYS.META, {});
    const categoryOrder = storage.get(STORAGE_KEYS.CATEGORY_ORDER, []);
    const config = {
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      links: state.links,
      order,
      meta,
      categoryOrder
    };

    const now = new Date();
    const ts = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0')
    ].join('');
    const json = JSON.stringify(config, null, 2);
    downloadFile(json, `tools-links-config-${ts}.json`, 'application/json');
    showToast('配置已导出', 'success');
  }

  function importConfig(config) {
    if (!config.links || !Array.isArray(config.links)) {
      showToast('无效的配置文件', 'error');
      return;
    }

    state.links = config.links;
    if (Array.isArray(config.order)) saveOrder(config.order);
    if (config.meta && typeof config.meta === 'object') saveMetaMap(config.meta);
    if (Array.isArray(config.categoryOrder)) saveCategoryOrder(config.categoryOrder);
    applyMetaToLinks(state.links);
    saveCustomLinks();
    renderLinks();
    showToast('配置已导入', 'success');
  }

  // ---------------- Category ordering ----------------
  function getCategoryOrder() {
    return storage.get(STORAGE_KEYS.CATEGORY_ORDER, []);
  }

  function saveCategoryOrder(order) {
    storage.set(STORAGE_KEYS.CATEGORY_ORDER, order);
  }

  function sortCategories(categories) {
    const saved = getCategoryOrder();
    const indexMap = new Map(saved.map((c, i) => [c, i]));
    // 新分类追加到末尾并持久化
    let changed = false;
    categories.forEach(c => {
      if (!indexMap.has(c)) {
        indexMap.set(c, saved.length);
        saved.push(c);
        changed = true;
      }
    });
    if (changed) saveCategoryOrder(saved);
    return categories.slice().sort((a, b) => {
      const ai = indexMap.has(a) ? indexMap.get(a) : Number.MAX_SAFE_INTEGER;
      const bi = indexMap.has(b) ? indexMap.get(b) : Number.MAX_SAFE_INTEGER;
      return ai - bi;
    });
  }

  function reorderCategory(fromCat, toCat) {
    let order = getCategoryOrder();
    // 确保两个分类都在列表中
    if (!order.includes(fromCat)) order.push(fromCat);
    if (!order.includes(toCat)) order.push(toCat);
    order = order.filter(c => c !== fromCat);
    const idx = order.indexOf(toCat);
    if (idx >= 0) order.splice(idx, 0, fromCat);
    else order.push(fromCat);
    saveCategoryOrder(order);
  }

  // ---------------- Drag & Drop sorting ----------------
  let draggingId = null;          // 链接拖拽
  let draggingCategory = null;    // 分类拖拽
  let dragHandleType = null;      // 'link' | 'category' | null

  function handleDragMouseDown(e) {
    if (e.target.closest('[data-action="drag-category"]')) {
      dragHandleType = 'category';
    } else if (e.target.closest('[data-action="drag-link"]')) {
      dragHandleType = 'link';
    } else {
      dragHandleType = null;
    }
  }

  function handleDragStart(e) {
    if (!dragHandleType) {
      e.preventDefault();
      return;
    }

    if (dragHandleType === 'category') {
      dragHandleType = null;
      const catEl = e.target.closest('.link-category');
      if (!catEl) { e.preventDefault(); return; }
      draggingCategory = catEl.dataset.category;
      draggingId = null;
      catEl.classList.add('is-dragging');
      try {
        e.dataTransfer.setData('text/plain', 'cat:' + draggingCategory);
        e.dataTransfer.effectAllowed = 'move';
      } catch {}
      return;
    }

    // 链接拖拽
    dragHandleType = null;
    const item = e.target.closest('.link-item');
    if (!item) { e.preventDefault(); return; }
    draggingId = item.dataset.id;
    draggingCategory = null;
    item.classList.add('is-dragging');
    try {
      e.dataTransfer.setData('text/plain', draggingId);
      e.dataTransfer.effectAllowed = 'move';
    } catch {}
  }

  function handleDragOver(e) {
    if (!draggingId && !draggingCategory) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(e) {
    e.preventDefault();

    if (draggingCategory) {
      // 分类拖拽
      const targetCat = e.target.closest('.link-category');
      if (!targetCat) return;
      const toCat = targetCat.dataset.category;
      if (!toCat || toCat === draggingCategory) return;
      reorderCategory(draggingCategory, toCat);
      draggingCategory = null;
      renderLinks();
      return;
    }

    if (draggingId) {
      // 链接拖拽：落在另一个链接上 → 重排序；落在分类标题上 → 移动分类
      const targetItem = e.target.closest('.link-item');
      if (targetItem) {
        const toId = targetItem.dataset.id;
        if (toId && toId !== draggingId) {
          reorder(draggingId, toId);
          draggingId = null;
          renderLinks();
        }
        return;
      }

      const targetCatHeader = e.target.closest('.link-category-header');
      if (targetCatHeader) {
        const targetCatEl = targetCatHeader.closest('.link-category');
        const toCat = targetCatEl && targetCatEl.dataset.category;
        if (toCat) {
          const link = state.links.find(l => l.id === draggingId);
          if (link && (link.category || '其他') !== toCat) {
            link.category = toCat;
            saveCustomLinks();
            draggingId = null;
            renderLinks();
            showToast(`已将「${link.name}」移动到「${toCat}」`, 'success');
          }
        }
        return;
      }
    }
  }

  function handleDragEnd() {
    draggingId = null;
    draggingCategory = null;
    dragHandleType = null;
    const dragging = elements.linksContainer.querySelector('.is-dragging');
    if (dragging) dragging.classList.remove('is-dragging');
  }

  function reorder(fromId, toId) {
    let order = getOrder();
    order = ensureOrderContainsAll(order, state.links);
    const fromIdx = order.indexOf(fromId);
    const toIdx = order.indexOf(toId);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
    order.splice(fromIdx, 1);
    // 前往后拖：插到目标后面；后往前拖：插到目标前面
    const newToIdx = order.indexOf(toId);
    if (fromIdx < toIdx) {
      order.splice(newToIdx + 1, 0, fromId);
    } else {
      order.splice(newToIdx, 0, fromId);
    }
    saveOrder(order);
  }

  // ---------------- Bulk import ----------------
  let importMode = 'text';
  function openBulkImport() {
    elements.bulkImportModal.classList.remove('u-hidden');
    setImportMode(importMode);
  }

  function closeBulkImport() {
    elements.bulkImportModal.classList.add('u-hidden');
  }

  function setImportMode(mode) {
    importMode = mode;
    document.querySelectorAll('[data-import-mode]').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.importMode === mode);
    });
    document.querySelectorAll('.import-panel').forEach(panel => {
      panel.classList.toggle('u-hidden', panel.dataset.panel !== mode);
    });
  }

  async function pasteBookmarksHtml() {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      showToast('当前浏览器不支持剪贴板读取', 'error');
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      elements.bookmarksHtml.value = text || '';
      showToast('已粘贴书签 HTML', 'success');
    } catch {
      showToast('读取剪贴板失败', 'error');
    }
  }

  function handleBookmarksFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      elements.bookmarksHtml.value = String(event.target.result || '');
      showToast('书签 HTML 已加载', 'success');
    };
    reader.onerror = () => showToast('读取文件失败', 'error');
    reader.readAsText(file);
    e.target.value = '';
  }

  function doBulkImport() {
    try {
      let imported = [];
      if (importMode === 'text') {
        imported = parseBulkText(elements.bulkText.value || '', elements.bulkDefaultCategory.value || '');
      } else {
        imported = parseBookmarksHtml(elements.bookmarksHtml.value || '', elements.bookmarksCategory.value || '');
      }

      if (imported.length === 0) {
        showToast('没有可导入的内容', 'warning');
        return;
      }

      mergeImportedLinks(imported);
      saveCustomLinks();
      renderLinks();
      closeBulkImport();
      showToast(`已导入 ${imported.length} 条链接`, 'success');
    } catch (err) {
      showToast('导入失败: ' + err.message, 'error');
    }
  }

  function parseBulkText(text, defaultCategory) {
    const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const out = [];
    for (const line of lines) {
      const parsed = parseLineToLink(line, defaultCategory);
      if (parsed) out.push(parsed);
    }
    return out;
  }

  function parseLineToLink(line, defaultCategory) {
    const urlMatch = line.match(/https?:\/\/\S+/i);
    if (!urlMatch) return null;
    const url = urlMatch[0].replace(/[),;]$/g, '');
    const before = line.slice(0, urlMatch.index).trim();
    const after = line.slice(urlMatch.index + urlMatch[0].length).trim();

    // 支持 name,url,category
    if (line.includes(',')) {
      const parts = line.split(',').map(s => s.trim()).filter(Boolean);
      const urlPart = parts.find(p => /^https?:\/\//i.test(p));
      if (urlPart) {
        const namePart = parts.find(p => p !== urlPart) || '';
        const catPart = parts.find(p => p !== urlPart && p !== namePart) || '';
        return buildLinkFromParts(namePart, urlPart, catPart || defaultCategory);
      }
    }

    const name = before || '';
    const category = after || defaultCategory || '';
    return buildLinkFromParts(name, url, category);
  }

  function buildLinkFromParts(name, url, category) {
    let finalName = (name || '').trim();
    if (!finalName) {
      try {
        const u = new URL(url);
        finalName = u.hostname;
      } catch {
        finalName = 'Link';
      }
    }
    const finalCategory = (category || '').trim() || '其他';
    return { id: generateId(finalName), name: finalName, url, category: finalCategory, icon: null };
  }

  function parseBookmarksHtml(html, defaultCategory) {
    const text = String(html || '').trim();
    if (!text) return [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    const anchors = Array.from(doc.querySelectorAll('a[href]'));
    const out = [];
    anchors.forEach(a => {
      const href = a.getAttribute('href') || '';
      if (!/^https?:\/\//i.test(href)) return;
      const name = (a.textContent || '').trim() || href;
      const folder = guessBookmarkFolderName(a) || defaultCategory || '书签';
      out.push({ id: generateId(name), name, url: href, category: folder, icon: null });
    });
    return out;
  }

  function guessBookmarkFolderName(a) {
    let node = a.parentElement;
    for (let i = 0; i < 8 && node; i++) {
      const h3 = node.querySelector && node.querySelector('h3');
      if (h3 && h3.textContent) return h3.textContent.trim();
      node = node.parentElement;
    }
    return '';
  }

  function mergeImportedLinks(imported) {
    const byId = new Map(state.links.map(l => [l.id, l]));
    const byUrl = new Set(state.links.map(l => l.url));
    imported.forEach(link => {
      if (byId.has(link.id)) {
        byId.set(link.id, { ...byId.get(link.id), ...link });
        return;
      }
      if (byUrl.has(link.url)) return;
      byId.set(link.id, link);
      byUrl.add(link.url);
    });
    state.links = Array.from(byId.values());
    applyMetaToLinks(state.links);
  }

  const ACTIONS = {
    'add-link'(e) {
      e.preventDefault();
      openAddLinkModal();
    },

    'edit-link'(e, target) {
      const id = target && target.dataset ? target.dataset.id : null;
      if (!id) return;
      openEditLinkModal(id);
    },

    'delete-link'(e, target) {
      const id = target && target.dataset ? target.dataset.id : null;
      if (!id) return;
      if (confirm('确定要删除这个链接吗？')) {
        deleteLink(id);
      }
    },

    'toggle-pin'(e, target) {
      const id = target && target.dataset ? target.dataset.id : null;
      if (!id) return;
      togglePin(id);
    },

    'drag-link'() {
      // 仅作为链接拖拽手柄标识
    },

    'drag-category'() {
      // 仅作为分类拖拽手柄标识
    },

    'save-link'() {
      saveLink();
    },

    'close-modal'() {
      closeModal();
    },

    'export-config'() {
      exportConfig();
    },

    'import-config'() {
      elements.fileInput.click();
    },

    'open-bulk-import'() {
      openBulkImport();
    },

    'close-bulk-import'() {
      closeBulkImport();
    },

    'do-bulk-import'() {
      doBulkImport();
    },

    'rename-category'(e, target) {
      const oldName = target && target.dataset ? target.dataset.category : null;
      if (!oldName) return;
      renameCategory(oldName);
    },

    'upload-bookmarks'() {
      elements.bookmarkFileInput.click();
    },

    'paste-bookmarks'() {
      pasteBookmarksHtml();
    }
  };

  init();
})();

