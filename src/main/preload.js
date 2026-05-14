const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getFiles: () => ipcRenderer.invoke('files:getAll'),
  readFile: (filename) => ipcRenderer.invoke('file:read', filename),
  saveFile: (filename, content) => ipcRenderer.invoke('file:save', filename, content),
  deleteFile: (filename) => ipcRenderer.invoke('file:delete', filename),
  renameFile: (oldName, newName) => ipcRenderer.invoke('file:rename', oldName, newName),
  createFile: (filename) => ipcRenderer.invoke('file:create', filename),
  search: (query) => ipcRenderer.invoke('search', query),
  getAllTags: () => ipcRenderer.invoke('tags:getAll'),
  filterByTag: (tag) => ipcRenderer.invoke('files:filterByTag', tag),
  refreshFiles: () => ipcRenderer.invoke('files:refresh'),
  onFilesChanged: (callback) => ipcRenderer.on('files:changed', (_, data) => callback(data))
});
