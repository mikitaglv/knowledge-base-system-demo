let files = [];
let currentFile = null;
let currentFilter = null;
let hasUnsavedChanges = false;
let isRefreshing = false;
let searchResults = null;
let searchTimeout = null;

const elements = {
  fileList: document.getElementById('file-list'),
  tagsList: document.getElementById('tags-list'),
  searchInput: document.getElementById('search-input'),
  editor: document.getElementById('editor'),
  currentFilename: document.getElementById('current-filename'),
  saveBtn: document.getElementById('save-btn'),
  deleteBtn: document.getElementById('delete-btn'),
  renameBtn: document.getElementById('rename-btn'),
  newFileBtn: document.getElementById('new-file-btn'),
  refreshBtn: document.getElementById('refresh-btn'),
  statusMessage: document.getElementById('status-message'),
  statusTags: document.getElementById('status-tags'),
  modalOverlay: document.getElementById('modal-overlay'),
  modalTitle: document.getElementById('modal-title'),
  modalInput: document.getElementById('modal-input'),
  modalClose: document.getElementById('modal-close'),
  modalCancel: document.getElementById('modal-cancel'),
  modalConfirm: document.getElementById('modal-confirm')
};

let modalCallback = null;

function showModal(title, placeholder, defaultValue = '', callback) {
  elements.modalTitle.textContent = title;
  elements.modalInput.placeholder = placeholder;
  elements.modalInput.value = defaultValue;
  elements.modalOverlay.classList.remove('hidden');
  elements.modalInput.focus();
  modalCallback = callback;
}

function hideModal() {
  elements.modalOverlay.classList.add('hidden');
  modalCallback = null;
}

function showStatus(message, duration = 3000) {
  elements.statusMessage.textContent = message;
  setTimeout(() => {
    if (elements.statusMessage.textContent === message) {
      elements.statusMessage.textContent = '';
    }
  }, duration);
}

function getFilteredFiles() {
  const query = elements.searchInput.value.toLowerCase().trim();
  let filtered = files;

  if (currentFilter) {
    filtered = filtered.filter(f => f.tags && f.tags.includes(currentFilter));
  }

  if (searchResults !== null) {
    filtered = filtered.filter(f => searchResults.has(f.filename));
  } else if (query) {
    filtered = filtered.filter(f => f.title.toLowerCase().includes(query));
  }

  return filtered;
}

function renderFileList() {
  const filtered = getFilteredFiles();
  
  if (filtered.length === 0) {
    elements.fileList.innerHTML = '<li class="empty-state">Файлы не найдены</li>';
    return;
  }

  elements.fileList.innerHTML = filtered.map(file => `
    <li data-filename="${file.filename}" class="${currentFile === file.filename ? 'active' : ''}">
      <div>
        <div class="file-title">${escapeHtml(file.title)}</div>
        ${file.tags && file.tags.length ? `<div class="file-tags">${file.tags.join(', ')}</div>` : ''}
      </div>
    </li>
  `).join('');

  elements.fileList.querySelectorAll('li[data-filename]').forEach(li => {
    li.addEventListener('click', () => selectFile(li.dataset.filename));
  });
}

function renderTags() {
  const allTags = new Set();
  files.forEach(f => {
    if (f.tags && Array.isArray(f.tags)) {
      f.tags.forEach(t => allTags.add(t));
    }
  });

  const tags = Array.from(allTags).sort();

  if (tags.length === 0) {
    elements.tagsList.innerHTML = '<span class="empty-state">Нет тегов</span>';
    return;
  }

  elements.tagsList.innerHTML = tags.map(tag => 
    `<span class="tag ${currentFilter === tag ? 'active' : ''}" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</span>`
  ).join('');

  elements.tagsList.querySelectorAll('.tag').forEach(tagEl => {
    tagEl.addEventListener('click', () => {
      const tag = tagEl.dataset.tag;
      if (currentFilter === tag) {
        currentFilter = null;
      } else {
        currentFilter = tag;
      }
      renderFileList();
      renderTags();
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function loadFiles() {
  const result = await window.api.getFiles();
  if (result.success) {
    files = result.files;
    renderFileList();
    renderTags();
  } else {
    showStatus('Ошибка загрузки файлов: ' + result.error);
  }
}

async function selectFile(filename) {
  if (hasUnsavedChanges) {
    const confirmSwitch = confirm('У вас есть несохранённые изменения. Переключиться на другой файл?');
    if (!confirmSwitch) return;
  }

  const result = await window.api.readFile(filename);
  if (result.success) {
    currentFile = filename;
    elements.editor.value = result.file.raw;
    elements.editor.disabled = false;
    elements.currentFilename.textContent = result.file.data.title || filename;
    elements.saveBtn.disabled = false;
    elements.deleteBtn.disabled = false;
    elements.renameBtn.disabled = false;
    
    const tags = result.file.data.tags || [];
    elements.statusTags.textContent = tags.length ? `Теги: ${tags.join(', ')}` : '';
    
    hasUnsavedChanges = false;
    renderFileList();
    showStatus('Файл загружен');
  } else {
    showStatus('Ошибка чтения файла: ' + result.error);
  }
}

async function saveFile() {
  if (!currentFile) return;

  const content = elements.editor.value;
  const result = await window.api.saveFile(currentFile, content);
  
  if (result.success) {
    hasUnsavedChanges = false;
    showStatus('Файл сохранён');
    const refreshResult = await window.api.refreshFiles();
    if (refreshResult.success) {
      files = refreshResult.files;
      renderFileList();
      renderTags();
    }
  } else {
    showStatus('Ошибка сохранения: ' + result.error);
  }
}

async function createFile() {
  showModal('Создание файла', 'Введите название файла', '', async (name) => {
    if (!name.trim()) {
      showStatus('Введите название файла');
      return;
    }

    const filename = name.trim() + '.md';
    const result = await window.api.createFile(filename);
    
    hideModal();
    
    if (result.success) {
      showStatus('Файл создан');
      const refreshResult = await window.api.refreshFiles();
      if (refreshResult.success) {
        files = refreshResult.files;
        renderFileList();
        renderTags();
      }
      await selectFile(filename);
    } else {
      hideModal();
      showStatus('Ошибка создания файла: ' + result.error);
    }
  });
}

async function deleteFile() {
  if (!currentFile) return;

  const confirmDelete = confirm(`Удалить файл "${currentFile}"?`);
  if (!confirmDelete) return;

  const result = await window.api.deleteFile(currentFile);
  
  if (result.success) {
    currentFile = null;
    elements.editor.value = '';
    elements.editor.disabled = true;
    elements.currentFilename.textContent = 'Файл не выбран';
    elements.saveBtn.disabled = true;
    elements.deleteBtn.disabled = true;
    elements.renameBtn.disabled = true;
    elements.statusTags.textContent = '';
    hasUnsavedChanges = false;
    
    showStatus('Файл удалён');
    const refreshResult = await window.api.refreshFiles();
    if (refreshResult.success) {
      files = refreshResult.files;
      renderFileList();
      renderTags();
    }
  } else {
    showStatus('Ошибка удаления: ' + result.error);
  }
}

async function renameFile() {
  if (!currentFile) return;

  const oldName = currentFile.replace('.md', '');
  
  showModal('Переименование файла', 'Введите новое название', oldName, async (newName) => {
    if (!newName.trim()) {
      showStatus('Введите название файла');
      return;
    }

    const result = await window.api.renameFile(currentFile, newName.trim() + '.md');
    
    if (result.success) {
      hideModal();
      showStatus('Файл переименован');
      currentFile = result.filename;
      const refreshResult = await window.api.refreshFiles();
      if (refreshResult.success) {
        files = refreshResult.files;
        renderFileList();
        renderTags();
      }
      await selectFile(currentFile);
    } else {
      hideModal();
      showStatus('Ошибка переименования: ' + result.error);
    }
  });
}

async function refreshFiles() {
  if (isRefreshing) return;
  isRefreshing = true;
  
  try {
    const result = await window.api.refreshFiles();
    if (result.success) {
      files = result.files;
      renderFileList();
      renderTags();
      showStatus('Список файлов обновлён');
    } else {
      showStatus('Ошибка обновления: ' + result.error);
    }
  } finally {
    isRefreshing = false;
  }
}

async function performSearch() {
  const lastQuery = elements.searchInput.value.trim();
  if (!lastQuery) {
    searchResults = null;
    renderFileList();
    return;
  }
  const result = await window.api.search(lastQuery);
  if (result.success && elements.searchInput.value.trim() === lastQuery) {
    searchResults = new Set(result.results.map(r => r.filename));
  } else if (!result.success) {
    searchResults = null;
  }
  renderFileList();
}

elements.searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  const query = elements.searchInput.value.trim();
  if (!query) {
    searchResults = null;
    renderFileList();
    return;
  }
  searchResults = null;
  renderFileList();
  searchTimeout = setTimeout(performSearch, 200);
});

elements.newFileBtn.addEventListener('click', createFile);
elements.saveBtn.addEventListener('click', saveFile);
elements.deleteBtn.addEventListener('click', deleteFile);
elements.renameBtn.addEventListener('click', renameFile);
elements.refreshBtn.addEventListener('click', refreshFiles);

elements.editor.addEventListener('input', () => {
  hasUnsavedChanges = true;
});

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    if (!elements.saveBtn.disabled) {
      saveFile();
    }
  }
});

elements.modalClose.addEventListener('click', hideModal);
elements.modalCancel.addEventListener('click', hideModal);

elements.modalConfirm.addEventListener('click', () => {
  if (modalCallback) {
    modalCallback(elements.modalInput.value);
  }
});

elements.modalInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    elements.modalConfirm.click();
  } else if (e.key === 'Escape') {
    hideModal();
  }
});

elements.modalOverlay.addEventListener('click', (e) => {
  if (e.target === elements.modalOverlay) {
    hideModal();
  }
});

window.api.onFilesChanged((data) => {
  console.log('Files changed:', data);
  refreshFiles();
});

refreshFiles();
