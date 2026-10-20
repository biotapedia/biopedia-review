import { renderMarkdown } from './markdown.js';
import { conservationLabel, rankLabel, safeHttps, toxicityLabel } from './taxonomy.js';
import { isTaxonFile, loadPullFiles, loadPulls, loadTaxon, repositoryFromConfig } from './pr-api.js';

const $ = id => document.getElementById(id);
const state = { repository: '', pulls: [], page: 0, selected: null, selectionVersion: 0, busy: false };

function element(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function githubPullUrl(number) {
  return `https://github.com/${state.repository}/pull/${number}`;
}

function setQueueStatus(message) { $('queue-status').textContent = message; }
function setReviewStatus(message) { $('review-status').textContent = message; }

function renderPullList() {
  const list = $('pull-list');
  list.replaceChildren();
  $('queue-count').textContent = state.pulls.length ? `(${state.pulls.length}${state.pulls.length === state.page * 100 ? '+' : ''})` : '';
  for (const pull of state.pulls) {
    const button = element('button', 'pull-item');
    button.type = 'button';
    button.setAttribute('aria-current', pull.number === state.selected?.number ? 'true' : 'false');
    button.append(element('span', 'pull-number', `#${pull.number} · ${pull.draft ? '草稿' : '待审核'}`));
    button.append(element('strong', '', pull.title));
    button.append(element('span', 'pull-byline', `${pull.user?.login || '投稿者'} · 更新于 ${new Date(pull.updated_at).toLocaleDateString('zh-CN')}`));
    button.addEventListener('click', () => selectPull(pull));
    list.append(button);
  }
  $('load-more').hidden = state.pulls.length === 0 || state.pulls.length !== state.page * 100;
}

async function fetchPullPage(reset = false) {
  if (state.busy) return;
  state.busy = true;
  $('refresh').disabled = true;
  $('load-more').disabled = true;
  setQueueStatus('正在读取待审 PR…');
  try {
    const page = reset ? 1 : state.page + 1;
    const incoming = await loadPulls(state.repository, page);
    state.pulls = reset ? incoming : [...state.pulls, ...incoming];
    state.page = page;
    renderPullList();
    setQueueStatus(state.pulls.length ? `已显示 ${state.pulls.length} 个待审 PR` : '目前没有待审 PR。');
    if (reset) {
      const requested = Number(new URL(location.href).searchParams.get('pr'));
      const target = state.pulls.find(pull => pull.number === requested) || state.pulls[0];
      if (target) selectPull(target);
      else clearReview();
    }
  } catch (error) {
    setQueueStatus(`读取失败：${error.message}`);
  } finally {
    state.busy = false;
    $('refresh').disabled = false;
    $('load-more').disabled = false;
  }
}

function clearReview() {
  state.selected = null;
  $('review-empty').hidden = false;
  $('review-content').hidden = true;
}

function labeledValue(label, value) {
  const row = element('div', 'fact');
  row.append(element('dt', '', label), element('dd', '', String(value || '未填写')));
  return row;
}

function taxonPreview(taxon) {
  const preview = element('div', 'taxon-preview');
  const facts = element('div', 'taxon-facts');
  const badgeRow = element('div', 'badges');
  badgeRow.append(element('span', 'badge', rankLabel(taxon.rank)));
  if (conservationLabel(taxon.conservation_status)) badgeRow.append(element('span', 'badge', `${conservationLabel(taxon.conservation_status)} · ${taxon.conservation_status}`));
  if (toxicityLabel(taxon.toxicity)) badgeRow.append(element('span', 'badge', `毒性 · ${toxicityLabel(taxon.toxicity)}`));
  facts.append(badgeRow, element('h3', '', taxon.name_zh || taxon.scientific_name), element('p', 'scientific', taxon.scientific_name));
  const detail = element('dl', 'facts-list');
  detail.append(labeledValue('条目编号', taxon.id), labeledValue('上级分类', taxon.parent_id || '根目录'));
  if (Array.isArray(taxon.distribution) && taxon.distribution.length) detail.append(labeledValue('分布区域编号', taxon.distribution.join('、')));
  facts.append(detail);
  if (safeHttps(taxon.source_url)) {
    const source = element('a', 'source-link', '查看主要资料来源 ↗');
    source.href = safeHttps(taxon.source_url);
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    facts.append(source);
  }
  const figure = element('figure', 'taxon-figure');
  if (safeHttps(taxon.image_url)) {
    const image = element('img');
    image.src = safeHttps(taxon.image_url);
    image.alt = taxon.name_zh || taxon.scientific_name;
    image.loading = 'lazy';
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', () => image.replaceWith(element('span', 'image-fallback', '图片暂不可用')));
    figure.append(image);
  } else {
    figure.append(element('span', 'image-fallback', '此条目没有封面图'));
  }
  if (taxon.image_credit) figure.append(element('figcaption', '', `图片来源：${taxon.image_credit}`));
  preview.append(facts, figure);
  const prose = element('div', 'prose');
  prose.append(renderMarkdown(taxon.body || ''));
  preview.append(prose);
  return preview;
}

function renderEntry(result, index) {
  const { file, proposed, original, error } = result;
  const article = element('article', 'entry');
  article.id = `entry-${index + 1}`;
  const header = element('div', 'entry-heading');
  header.append(element('span', 'entry-status', file.status === 'added' ? '新增条目' : file.status === 'removed' ? '删除条目' : '修改条目'));
  header.append(element('span', 'entry-file', file.filename));
  article.append(header);
  if (error) {
    article.append(element('p', 'entry-error', `读取条目失败：${error.message}。请在 GitHub PR 查看。`));
    return article;
  }
  if (proposed) article.append(taxonPreview(proposed));
  if (original) {
    const old = element('details', 'previous-version');
    old.append(element('summary', '', proposed ? '查看修改前的条目' : '查看拟删除的原条目'));
    old.append(taxonPreview(original));
    article.append(old);
  }
  return article;
}

async function loadEntry(file, pull) {
  try {
    const proposed = file.status === 'removed' ? null : await loadTaxon(state.repository, file.filename, pull.head.sha);
    const original = file.status === 'added' ? null : await loadTaxon(state.repository, file.filename, pull.base.sha);
    return { file, proposed, original };
  } catch (error) {
    return { file, error };
  }
}

async function selectPull(pull) {
  const version = ++state.selectionVersion;
  state.selected = pull;
  renderPullList();
  const url = new URL(location.href);
  url.searchParams.set('pr', String(pull.number));
  history.replaceState(null, '', url);
  $('review-empty').hidden = true;
  $('review-content').hidden = false;
  $('review-label').textContent = `PULL REQUEST #${pull.number}${pull.draft ? ' / 草稿' : ''}`;
  $('review-name').textContent = pull.title;
  $('review-meta').textContent = `由 ${pull.user?.login || '投稿者'} 提交 · 目标分支 ${pull.base?.ref || 'main'}`;
  $('open-pull').href = githubPullUrl(pull.number);
  $('entries').replaceChildren();
  $('entry-nav').replaceChildren();
  $('pull-notes').hidden = !pull.body;
  $('pull-notes-body').replaceChildren(renderMarkdown(pull.body || ''));
  setReviewStatus('正在读取 PR 中的图鉴条目…');
  try {
    const files = (await loadPullFiles(state.repository, pull.number)).filter(isTaxonFile);
    if (version !== state.selectionVersion) return;
    if (!files.length) {
      setReviewStatus('这个 PR 没有修改 docs/taxa 下的条目；请在 GitHub 查看其他文件。');
      return;
    }
    const results = await Promise.all(files.map(file => loadEntry(file, pull)));
    if (version !== state.selectionVersion) return;
    setReviewStatus(`本次变更包含 ${files.length} 个图鉴条目。`);
    results.forEach((result, index) => {
      const item = result.proposed || result.original;
      const link = element('a', '', item?.name_zh || item?.scientific_name || result.file.filename.split('/').at(-1));
      link.href = `#entry-${index + 1}`;
      $('entry-nav').append(link);
      $('entries').append(renderEntry(result, index));
    });
  } catch (error) {
    if (version === state.selectionVersion) setReviewStatus(`读取失败：${error.message}。可以在 GitHub PR 查看。`);
  }
}

async function start() {
  $('refresh').addEventListener('click', () => fetchPullPage(true));
  $('load-more').addEventListener('click', () => fetchPullPage());
  try {
    const response = await fetch('./config.json');
    if (!response.ok) throw new Error('无法读取仓库配置');
    state.repository = repositoryFromConfig(await response.json());
    $('repository-link').href = `https://github.com/${state.repository}/pulls`;
    await fetchPullPage(true);
  } catch (error) {
    setQueueStatus(`初始化失败：${error.message}`);
  }
}

start();
