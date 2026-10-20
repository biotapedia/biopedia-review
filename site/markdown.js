import { safeHttps } from './taxonomy.js';

// Community Markdown is rendered with DOM nodes. Raw HTML stays plain text.
export function parseFrontMatter(text) {
  const normalized = text.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error('条目缺少元数据');
  const metadata = {};
  for (const line of match[1].split('\n')) {
    if (!line.trim()) continue;
    const pair = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!pair) throw new Error('条目元数据格式错误');
    metadata[pair[1]] = JSON.parse(pair[2]);
  }
  return { ...metadata, body: match[2].trim() };
}

const inlinePattern = /!\[((?:\\.|[^\]\\])*)\]\(([^)\s]+)\)|\[((?:\\.|[^\]\\])+)\]\(([^)\s]+)\)|\*\*((?:\\.|[^\\])+?)\*\*|__((?:\\.|[^\\])+?)__|\*((?:\\.|[^*\n\\])+)\*|_((?:\\.|[^_\n\\])+)_|`([^`\n]+)`|\\([!-\/:-@[-`{-~])/g;
const imagePattern = /!\[(?:\\.|[^\]\\])*\]\(([^)\s]+)\)/g;
const entities = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };
const decodeEntities = text => text.replace(/&(amp|lt|gt|quot|#39);/g, (_, name) => entities[name]);
const plainText = text => decodeEntities(text.replace(/\\([!-\/:-@[-`{-~])/g, '$1'));
const textNode = text => document.createTextNode(decodeEntities(text));

export function markdownImageUrls(source) {
  return [...source.matchAll(imagePattern)].map(match => match[1]);
}

function appendInline(parent, source, depth = 0) {
  if (depth > 6) {
    parent.append(document.createTextNode(plainText(source)));
    return;
  }
  let cursor = 0;
  for (const match of source.matchAll(inlinePattern)) {
    parent.append(textNode(source.slice(cursor, match.index)));
    if (match[1] !== undefined) {
      const url = safeHttps(match[2]);
      if (url) {
        const image = document.createElement('img');
        image.src = url;
        image.alt = plainText(match[1]);
        image.loading = 'lazy';
        image.decoding = 'async';
        image.referrerPolicy = 'no-referrer';
        parent.append(image);
      } else {
        parent.append(document.createTextNode(match[0]));
      }
    } else if (match[3] !== undefined) {
      const url = safeHttps(match[4]);
      if (url) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        appendInline(link, match[3], depth + 1);
        parent.append(link);
      } else {
        parent.append(document.createTextNode(match[0]));
      }
    } else if (match[5] !== undefined || match[6] !== undefined) {
      const strong = document.createElement('strong');
      appendInline(strong, match[5] ?? match[6], depth + 1);
      parent.append(strong);
    } else if (match[7] !== undefined || match[8] !== undefined) {
      const emphasis = document.createElement('em');
      appendInline(emphasis, match[7] ?? match[8], depth + 1);
      parent.append(emphasis);
    } else if (match[9] !== undefined) {
      const code = document.createElement('code');
      code.textContent = match[9];
      parent.append(code);
    } else {
      parent.append(document.createTextNode(match[10]));
    }
    cursor = match.index + match[0].length;
  }
  parent.append(textNode(source.slice(cursor)));
}

export function renderMarkdown(source) {
  const fragment = document.createDocumentFragment();
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const isBlockStart = line => /^(?:#{1,3}\s+|[-*+]\s+|\d+[.)]\s+|>\s?|```|(?:-{3,}|\*{3,})\s*$)/.test(line);
  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    if (line.startsWith('```')) {
      const codeLines = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.textContent = codeLines.join('\n');
      pre.append(code);
      fragment.append(pre);
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const element = document.createElement(`h${heading[1].length}`);
      appendInline(element, heading[2]);
      fragment.append(element);
      index += 1;
    } else if (/^[-*+]\s+/.test(line)) {
      const list = document.createElement('ul');
      while (index < lines.length && /^[-*+]\s+/.test(lines[index])) {
        const item = document.createElement('li');
        appendInline(item, lines[index].replace(/^[-*+]\s+/, ''));
        list.append(item);
        index += 1;
      }
      fragment.append(list);
    } else if (/^\d+[.)]\s+/.test(line)) {
      const list = document.createElement('ol');
      while (index < lines.length && /^\d+[.)]\s+/.test(lines[index])) {
        const item = document.createElement('li');
        appendInline(item, lines[index].replace(/^\d+[.)]\s+/, ''));
        list.append(item);
        index += 1;
      }
      fragment.append(list);
    } else if (/^>\s?/.test(line)) {
      const quoteLines = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }
      const quote = document.createElement('blockquote');
      appendInline(quote, quoteLines.join(' '));
      fragment.append(quote);
    } else if (/^(?:-{3,}|\*{3,})\s*$/.test(line)) {
      fragment.append(document.createElement('hr'));
      index += 1;
    } else {
      const paragraphLines = [line];
      index += 1;
      while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) {
        paragraphLines.push(lines[index]);
        index += 1;
      }
      const paragraph = document.createElement('p');
      appendInline(paragraph, paragraphLines.join(' '));
      fragment.append(paragraph);
    }
  }
  return fragment;
}
