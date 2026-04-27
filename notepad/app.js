/**
 * 备忘录工具
 */
(function() {
  'use strict';

  // ── 常量 ──
  const STORAGE_KEY = 'tools_notepad_notes';
  const CATEGORY_KEY = 'tools_notepad_categories';

  // ── 状态 ──
  let notes = [];
  let editingId = null;   // null = 新增模式, string = 编辑模式
  let deletingId = null;  // 待删除的 id

  // ── DOM ──
  const el = {};

  // ── 初始化 ──
  function init() {
    cacheElements();
    loadNotes();
    renderList();
    updateCategoryFilter();
    updateCategoryDatalist();
    bindEvents();
  }

  function cacheElements() {
    el.searchInput    = document.getElementById('search-input');
    el.filterCategory = document.getElementById('filter-category');
    el.btnAdd         = document.getElementById('btn-add');
    el.list           = document.getElementById('notepad-list');
    el.emptyState     = document.getElementById('empty-state');

    // 编辑模态框
    el.modalNote      = document.getElementById('modal-note');
    el.modalTitle     = document.getElementById('modal-title');
    el.noteTitle      = document.getElementById('note-title');
    el.noteContent    = document.getElementById('note-content');
    el.noteCategory   = document.getElementById('note-category');
    el.noteTags       = document.getElementById('note-tags');
    el.categoryList   = document.getElementById('category-list');
    el.btnSave        = document.getElementById('btn-save');

    // 删除确认模态框
    el.modalDelete      = document.getElementById('modal-delete');
    el.btnConfirmDelete = document.getElementById('btn-confirm-delete');
  }

  // ── 数据持久化 ──
  function loadNotes() {
    notes = storage.get(STORAGE_KEY, []);
  }

  function saveNotes() {
    storage.set(STORAGE_KEY, notes);
  }

  function getCategories() {
    return storage.get(CATEGORY_KEY, []);
  }

  function saveCategories(cats) {
    storage.set(CATEGORY_KEY, cats);
  }

  function syncCategories(category) {
    if (!category) return;
    const cats = getCategories();
    if (!cats.includes(category)) {
      cats.push(category);
      saveCategories(cats);
      updateCategoryFilter();
      updateCategoryDatalist();
    }
  }

  // ── 渲染 ──
  function renderList() {
    const keyword = el.searchInput.value.trim().toLowerCase();
    const filterCat = el.filterCategory.value;
    let filtered = notes;

    if (keyword) {
      filtered = filtered.filter(n =>
        n.title.toLowerCase().includes(keyword) ||
        n.content.toLowerCase().includes(keyword) ||
        (n.tags || []).some(t => t.toLowerCase().includes(keyword))
      );
    }

    if (filterCat) {
      filtered = filtered.filter(n => n.category === filterCat);
    }

    // 置顶优先，再按更新时间倒序
    filtered.sort((a, b) => {
      const aPin = a.pinned ? 1 : 0;
      const bPin = b.pinned ? 1 : 0;
      if (bPin !== aPin) return bPin - aPin;
      return b.updatedAt - a.updatedAt;
    });

    if (filtered.length === 0) {
      el.list.innerHTML = '';
      el.emptyState.style.display = '';
      el.emptyState.querySelector('p').textContent =
        (keyword || filterCat) ? '没有找到匹配的备忘' : '还没有备忘，点击「新增备忘」开始记录';
      return;
    }

    el.emptyState.style.display = 'none';
    el.list.innerHTML = filtered.map(n => renderCard(n)).join('');
  }

  function renderCard(note) {
    const tags = (note.tags || []).map(t =>
      '<span class="notepad-tag">' + escapeHtml(t) + '</span>'
    ).join('');

    const category = note.category
      ? '<span class="notepad-category">' + escapeHtml(note.category) + '</span>'
      : '';

    const timeStr = formatDate(note.updatedAt);

    const pinnedClass = note.pinned ? ' is-pinned' : '';
    const pinIcon = note.pinned ? '★' : '☆';
    const pinTitle = note.pinned ? '取消置顶' : '置顶';

    return '' +
      '<div class="notepad-card' + pinnedClass + '" data-id="' + note.id + '">' +
        '<div class="notepad-card-header">' +
          '<h3 class="notepad-card-title">' + escapeHtml(note.title || '无标题') + '</h3>' +
          '<div class="notepad-card-actions">' +
            '<button class="btn-icon btn-icon-pin' + (note.pinned ? ' is-active' : '') + '" data-action="pin" data-id="' + note.id + '" title="' + pinTitle + '">' + pinIcon + '</button>' +
            '<button class="btn-icon" data-action="edit" data-id="' + note.id + '" title="编辑">&#9998;</button>' +
            '<button class="btn-icon btn-icon-danger" data-action="delete" data-id="' + note.id + '" title="删除">&#10005;</button>' +
          '</div>' +
        '</div>' +
        (note.content
          ? '<div class="notepad-card-body">' + escapeHtml(note.content) + '</div>'
          : '') +
        '<div class="notepad-card-footer">' +
          '<div class="notepad-card-meta">' +
            category +
            '<div class="notepad-tags">' + tags + '</div>' +
          '</div>' +
          '<span class="notepad-card-time">' + timeStr + '</span>' +
        '</div>' +
      '</div>';
  }

  function updateCategoryFilter() {
    const current = el.filterCategory.value;
    const cats = getCategories();
    el.filterCategory.innerHTML = '<option value="">全部分类</option>' +
      cats.map(c => '<option value="' + escapeHtml(c) + '"' + (c === current ? ' selected' : '') + '>' + escapeHtml(c) + '</option>').join('');
  }

  function updateCategoryDatalist() {
    const cats = getCategories();
    el.categoryList.innerHTML = cats.map(c => '<option value="' + escapeHtml(c) + '">').join('');
  }

  // ── 模态框 ──
  function openAddModal() {
    editingId = null;
    el.modalTitle.textContent = '新增备忘';
    el.noteTitle.value = '';
    el.noteContent.value = '';
    el.noteCategory.value = '';
    el.noteTags.value = '';
    el.modalNote.style.display = '';
    el.noteTitle.focus();
  }

  function openEditModal(id) {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    editingId = id;
    el.modalTitle.textContent = '编辑备忘';
    el.noteTitle.value = note.title;
    el.noteContent.value = note.content;
    el.noteCategory.value = note.category || '';
    el.noteTags.value = (note.tags || []).join(', ');
    el.modalNote.style.display = '';
    el.noteTitle.focus();
  }

  function closeModal() {
    el.modalNote.style.display = 'none';
    editingId = null;
  }

  function openDeleteModal(id) {
    deletingId = id;
    el.modalDelete.style.display = '';
  }

  function closeDeleteModal() {
    el.modalDelete.style.display = 'none';
    deletingId = null;
  }

  // ── CRUD ──
  function saveNote() {
    const title = el.noteTitle.value.trim();
    const content = el.noteContent.value.trim();
    const category = el.noteCategory.value.trim();
    const tagsStr = el.noteTags.value.trim();
    const tags = tagsStr
      ? tagsStr.split(/[,，]/).map(t => t.trim()).filter(Boolean)
      : [];

    if (!title && !content) {
      showToast('请至少填写标题或内容', 'warning');
      return;
    }

    const now = Date.now();

    if (editingId) {
      // 编辑
      const note = notes.find(n => n.id === editingId);
      if (note) {
        note.title = title;
        note.content = content;
        note.category = category;
        note.tags = tags;
        note.updatedAt = now;
      }
      showToast('备忘已更新', 'success');
    } else {
      // 新增
      notes.push({
        id: 'note_' + now + '_' + Math.random().toString(36).slice(2, 8),
        title,
        content,
        category,
        tags,
        createdAt: now,
        updatedAt: now
      });
      showToast('备忘已保存', 'success');
    }

    if (category) syncCategories(category);
    saveNotes();
    closeModal();
    renderList();
  }

  function togglePin(id) {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    note.pinned = !note.pinned;
    saveNotes();
    renderList();
    showToast(note.pinned ? '已置顶' : '已取消置顶', 'success');
  }

  function deleteNote() {
    if (!deletingId) return;
    notes = notes.filter(n => n.id !== deletingId);
    saveNotes();
    closeDeleteModal();
    renderList();
    showToast('备忘已删除', 'success');
  }

  // ── 事件绑定 ──
  function bindEvents() {
    // 新增按钮
    el.btnAdd.addEventListener('click', openAddModal);

    // 保存
    el.btnSave.addEventListener('click', saveNote);

    // 确认删除
    el.btnConfirmDelete.addEventListener('click', deleteNote);

    // 搜索
    el.searchInput.addEventListener('input', debounce(renderList, 200));

    // 分类过滤
    el.filterCategory.addEventListener('change', renderList);

    // 关闭编辑模态框（事件委托）
    el.modalNote.addEventListener('click', function(e) {
      if (e.target.closest('[data-action="close-modal"]')) {
        closeModal();
      }
    });

    // 关闭删除模态框（事件委托）
    el.modalDelete.addEventListener('click', function(e) {
      if (e.target.closest('[data-action="close-delete-modal"]')) {
        closeDeleteModal();
      }
    });

    // 卡片操作：编辑 / 删除（事件委托）
    el.list.addEventListener('click', function(e) {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      e.stopPropagation();
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === 'pin') togglePin(id);
      if (action === 'edit') openEditModal(id);
      if (action === 'delete') openDeleteModal(id);
    });

    // Esc 关闭模态框
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        if (el.modalNote.style.display !== 'none') closeModal();
        if (el.modalDelete.style.display !== 'none') closeDeleteModal();
      }
    });

    // Enter 保存（模态框内）
    el.modalNote.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        saveNote();
      }
    });
  }

  // ── 启动 ──
  init();
})();
