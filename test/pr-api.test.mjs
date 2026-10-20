import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeGithubContent, isTaxonFile, repositoryFromConfig } from '../site/pr-api.js';

test('repository configuration accepts only an owner and repository', () => {
  assert.equal(repositoryFromConfig({ repository: 'biotapedia/biopedia-data' }), 'biotapedia/biopedia-data');
  assert.throws(() => repositoryFromConfig({ repository: 'https://example.org/other' }), /仓库配置无效/);
});

test('only Markdown taxon files enter the review preview', () => {
  assert.equal(isTaxonFile({ filename: 'docs/taxa/panthera-uncia.md' }), true);
  assert.equal(isTaxonFile({ filename: 'docs/species.json' }), false);
  assert.equal(isTaxonFile({ filename: 'scripts/issue-to-pr.mjs' }), false);
});

test('GitHub content decodes Chinese front matter and the article body', () => {
  const markdown = '---\nid: "test-species"\nrank: "species"\nscientific_name: "Test species"\nname_zh: "测试物种"\n---\n\n这是正文。';
  const content = Buffer.from(markdown).toString('base64');
  const taxon = decodeGithubContent({ encoding: 'base64', content });
  assert.equal(taxon.name_zh, '测试物种');
  assert.equal(taxon.body, '这是正文。');
  assert.throws(() => decodeGithubContent({ encoding: 'none' }), /未返回可读取/);
});
