const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fileManager = require('../common/fileManager');
const searchIndex = require('../common/searchIndex');
const FileWatcher = require('../common/watcher');

let mainWindow = null;
let fileWatcher = null;

async function setupFileHandlers() {
  ipcMain.handle('files:getAll', async () => {
    try {
      await searchIndex.buildIndex();
      return { success: true, files: searchIndex.getDocuments() };
    } catch (err) {
      console.error('Error in getAll:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('file:read', async (_, filename) => {
    try {
      const file = await fileManager.readFile(filename);
      return { success: true, file };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('file:save', async (_, filename, content) => {
    try {
      await fileManager.saveFile(filename, content);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('file:create', async (_, filename) => {
    try {
      if (!filename.endsWith('.md')) {
        filename = filename + '.md';
      }
      const result = await fileManager.createFile(filename);
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('file:delete', async (_, filename) => {
    try {
      await fileManager.deleteFile(filename);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('file:rename', async (_, oldName, newName) => {
    try {
      if (!newName.endsWith('.md')) {
        newName = newName + '.md';
      }
      const result = await fileManager.renameFile(oldName, newName);
      return result;
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('search', async (_, query) => {
    try {
      const results = searchIndex.search(query);
      return { success: true, results };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('tags:getAll', async () => {
    try {
      const tags = searchIndex.getAllTags();
      return { success: true, tags };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('files:filterByTag', async (_, tag) => {
    try {
      const files = searchIndex.filterByTag(tag);
      return { success: true, files };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('files:refresh', async () => {
    try {
      await searchIndex.buildIndex();
      return { success: true, files: searchIndex.getDocuments(), tags: searchIndex.getAllTags() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  fileWatcher = new FileWatcher((data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('files:changed', data);
    }
  });
  fileWatcher.start();

  mainWindow.on('closed', () => {
    if (fileWatcher) {
      fileWatcher.stop();
    }
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await setupFileHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (fileWatcher) {
    fileWatcher.stop();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
