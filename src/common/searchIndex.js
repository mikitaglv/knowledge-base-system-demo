const lunr = require('lunr');
const path = require('path');
const grayMatter = require('gray-matter');
const fs = require('fs/promises');

class SearchIndex {
  constructor() {
    this.index = null;
    this.documents = [];
    this.knowledgeDir = path.join(__dirname, '..', '..', 'knowledge');
    this.isBuilding = false;
  }

  async buildIndex() {
    if (this.isBuilding) return this.documents;
    this.isBuilding = true;
    
    this.documents = [];
    let files;
    
    try {
      await fs.access(this.knowledgeDir);
      files = await fs.readdir(this.knowledgeDir);
    } catch {
      files = [];
    }

    const mdFiles = files.filter(f => f.endsWith('.md'));

    for (let i = 0; i < mdFiles.length; i++) {
      const filename = mdFiles[i];
      const filePath = path.join(this.knowledgeDir, filename);
      
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = grayMatter(content);
        
        this.documents.push({
          id: i,
          filename,
          title: parsed.data.title || path.basename(filename, '.md'),
          content: parsed.content,
          tags: parsed.data.tags || []
        });
      } catch (err) {
        console.error(`Error reading ${filename}:`, err);
      }
    }

    const docs = this.documents;
    
    try {
      if (docs.length > 0) {
        this.index = lunr(function() {
          this.ref('id');
          this.field('title', { boost: 10 });
          this.field('content');
          this.field('tags', { boost: 5 });

          docs.forEach(doc => {
            this.add(doc);
          });
        });
      } else {
        this.index = null;
      }
    } catch (err) {
      console.error('Error building lunr index:', err);
      this.index = null;
    }

    this.isBuilding = false;
    return this.documents;
  }

  search(query) {
    if (!this.index || !query) {
      return this.documents.map(doc => ({
        filename: doc.filename,
        title: doc.title,
        score: 0
      }));
    }

    const results = this.index.search(`${query}* ${query}`);
    return results.map(result => {
      const doc = this.documents.find(d => d.id === parseInt(result.ref));
      return {
        filename: doc.filename,
        title: doc.title,
        score: result.score
      };
    });
  }

  getAllTags() {
    const tagSet = new Set();
    this.documents.forEach(doc => {
      if (doc.tags && Array.isArray(doc.tags)) {
        doc.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }

  filterByTag(tag) {
    if (!tag) {
      return this.documents.map(doc => ({
        filename: doc.filename,
        title: doc.title,
        tags: doc.tags
      }));
    }

    return this.documents
      .filter(doc => doc.tags && doc.tags.includes(tag))
      .map(doc => ({
        filename: doc.filename,
        title: doc.title,
        tags: doc.tags
      }));
  }

  getDocuments() {
    return this.documents.map(doc => ({
      filename: doc.filename,
      title: doc.title,
      tags: doc.tags
    }));
  }
}

module.exports = new SearchIndex();
