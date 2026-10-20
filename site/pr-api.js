import { parseFrontMatter } from './markdown.js';

const taxonFile = /^docs\/taxa\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;

export function repositoryFromConfig(config) {
  if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(config?.repository || '')) {
    throw new Error('仓库配置无效');
  }
  return config.repository;
}

export function isTaxonFile(file) {
  return taxonFile.test(file?.filename || '');
}

export function decodeGithubContent(payload) {
  if (payload?.encoding !== 'base64' || typeof payload.content !== 'string') {
    throw new Error('GitHub 未返回可读取的条目内容');
  }
  const bytes = Uint8Array.from(atob(payload.content.replace(/\s/g, '')), character => character.charCodeAt(0));
  return parseFrontMatter(new TextDecoder().decode(bytes));
}

export async function githubGet(repository, path) {
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
    headers: { Accept: 'application/vnd.github+json' }
  });
  if (!response.ok) {
    const detail = response.status === 403 ? '请求过于频繁或访问受限，请稍后再试' : `GitHub 返回 HTTP ${response.status}`;
    throw new Error(detail);
  }
  return response.json();
}

export async function loadPulls(repository, page = 1) {
  return githubGet(repository, `/pulls?state=open&sort=updated&direction=desc&per_page=100&page=${page}`);
}

export async function loadPullFiles(repository, number) {
  const files = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await githubGet(repository, `/pulls/${number}/files?per_page=100&page=${page}`);
    files.push(...batch);
    if (batch.length < 100) return files;
  }
  throw new Error('这个 PR 修改的文件过多，请在 GitHub 查看完整文件列表');
}

export async function loadTaxon(repository, filename, ref) {
  if (!taxonFile.test(filename) || !/^[a-f0-9]{40}$/.test(ref)) throw new Error('条目路径或版本无效');
  const encodedPath = filename.split('/').map(encodeURIComponent).join('/');
  const payload = await githubGet(repository, `/contents/${encodedPath}?ref=${ref}`);
  return decodeGithubContent(payload);
}
