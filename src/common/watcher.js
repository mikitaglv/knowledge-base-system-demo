const chokidar = require('chokidar');
const path = require('path');

class FileWatcher {
  constructor(onChange) {
    this.watcher = null;
    this.knowledgeDir = path.join(__dirname, '..', '..', 'knowledge');
    this.onChange = onChange;
  }

  start() {
    if (this.watcher) {
      return;
    }

    this.watcher = chokidar.watch(this.knowledgeDir, {
      ignored: /^\./,
      persistent: true,
      ignoreInitial: true
    });

    this.watcher
      .on('add', (filePath) => {
        if (filePath.endsWith('.md')) {
          const filename = path.basename(filePath);
          this.onChange({ type: 'add', filename });
        }
      })
      .on('change', (filePath) => {
        if (filePath.endsWith('.md')) {
          const filename = path.basename(filePath);
          this.onChange({ type: 'change', filename });
        }
      })
      .on('unlink', (filePath) => {
        if (filePath.endsWith('.md')) {
          const filename = path.basename(filePath);
          this.onChange({ type: 'unlink', filename });
        }
      })
      .on('error', (error) => {
        console.error('Watcher error:', error);
      });
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}

module.exports = FileWatcher;
