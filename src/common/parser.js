const grayMatter = require('gray-matter');

function parseFrontmatter(content) {
  const parsed = grayMatter(content);
  return {
    content: parsed.content,
    data: parsed.data,
    raw: content
  };
}

function stringify(data, content) {
  return grayMatter.stringify(content, data);
}

module.exports = {
  parseFrontmatter,
  stringify
};
