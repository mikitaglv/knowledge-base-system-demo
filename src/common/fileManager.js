const fs = require('fs/promises');
const path = require('path');
const grayMatter = require('gray-matter');

const KNOWLEDGE_DIR = path.join(__dirname, '..', '..', 'knowledge');

async function ensureKnowledgeDir() {
  try {
    await fs.access(KNOWLEDGE_DIR);
  } catch {
    await fs.mkdir(KNOWLEDGE_DIR, { recursive: true });
  }
}

async function getAllFiles() {
  await ensureKnowledgeDir();
  const files = await fs.readdir(KNOWLEDGE_DIR);
  return files
    .filter(f => f.endsWith('.md'))
    .map(filename => {
      const filePath = path.join(KNOWLEDGE_DIR, filename);
      return {
        filename,
        path: filePath,
        name: path.basename(filename, '.md')
      };
    });
}

async function readFile(filename) {
  const filePath = path.join(KNOWLEDGE_DIR, filename);
  const content = await fs.readFile(filePath, 'utf-8');
  const parsed = grayMatter(content);
  return {
    filename,
    content: parsed.content,
    data: parsed.data,
    raw: content
  };
}

async function saveFile(filename, content) {
  const filePath = path.join(KNOWLEDGE_DIR, filename);
  await fs.writeFile(filePath, content, 'utf-8');
  return { success: true };
}

async function createFile(filename) {
  await ensureKnowledgeDir();
  const filePath = path.join(KNOWLEDGE_DIR, filename);
  const date = new Date().toISOString().split('T')[0];
  const template = `---
title: "${path.basename(filename, '.md')}"
date: ${date}
tags: []
---

`;
  await fs.writeFile(filePath, template, 'utf-8');
  return { success: true, filename };
}

async function deleteFile(filename) {
  const filePath = path.join(KNOWLEDGE_DIR, filename);
  await fs.unlink(filePath);
  return { success: true };
}

async function renameFile(oldName, newName) {
  const oldPath = path.join(KNOWLEDGE_DIR, oldName);
  const newPath = path.join(KNOWLEDGE_DIR, newName);
  await fs.rename(oldPath, newPath);

  const content = await fs.readFile(newPath, 'utf-8');
  const parsed = grayMatter(content);
  parsed.data.title = path.basename(newName, '.md');
  const updated = grayMatter.stringify(parsed.content, parsed.data);
  await fs.writeFile(newPath, updated, 'utf-8');

  return { success: true, filename: newName };
}

module.exports = {
  getAllFiles,
  readFile,
  saveFile,
  createFile,
  deleteFile,
  renameFile,
  ensureKnowledgeDir,
  KNOWLEDGE_DIR
};
