# 万物图鉴 · 投稿审核预览

独立的只读审核站点。它从 `biotapedia/biopedia-data` 的公开 GitHub API 读取待审 Pull Request，渲染 `docs/taxa/*.md` 条目的提议版本、图片来源、正文和 PR 说明。审核意见与最终合并在 GitHub PR 页面完成。此站点不请求或保存 GitHub 凭据，也不修改数据仓库。

## 本地运行

在仓库根目录运行 `python3 -m http.server 8000 -d site`，打开 `http://localhost:8000/`。直接以 `file://` 打开会阻止读取 `config.json`。

运行 `npm test` 检查 PR 路径过滤与条目解析。部署时使用本仓库的 GitHub Pages workflow；在仓库 **Settings → Pages** 中选择 **GitHub Actions** 作为发布来源。发布目录仅为 `site/`。

## 数据来源和边界

- `site/config.json` 指定要读取的公开数据仓库。若仓库改名，在这里更新。
- 页面不接触 `biopedia-web` 的部署，也不向 `biopedia-data` 写入任何内容。
- 公开 GitHub API 的匿名请求有速率限制；读取受限时页面显示错误，可稍后重试或打开 GitHub PR。
- 页面优先预览 `docs/taxa/*.md`，生成的索引文件不进入条目预览。修改过的条目可展开查看修改前的版本。
- 页面默认列出开放中的 PR；使用 `?pr=编号` 可直接预览指定 PR，包括已合并的历史 PR。
- 条目和 PR 正文按安全的 Markdown 子集渲染；原始 HTML 不执行。
