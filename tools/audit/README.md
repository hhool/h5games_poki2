# tools/audit/

网络探活工具集 — 验证 `games.json` 和 `sitemap.xml` 的 URL 实际可达性。

## 工具列表

| 脚本 | 检查对象 | 说明 |
|---|---|---|
| `check-game-links.js` | `game.link` (CDN iframe URL) | HEAD/GET 探活，报告非 200 |
| `check-sitemap-urls.js` | `sitemap.xml` 每条 `<loc>` | GET 探活，报告非 200 |
| `check-img-src.js` | `game.imgSrc` (CDN 图标) | HEAD 探活，报告缺失/断链 |

## 快速使用

```bash
# 检查游戏 iframe 链接
npm run audit:links

# 检查 sitemap URL
npm run audit:sitemap

# 检查游戏图标 CDN
npm run audit:imgs

# 只看失败项
npm run audit:links -- --only-errors
npm run audit:sitemap -- --only-errors --sitemap=https://poki2.online/sitemap.xml

# JSON 输出（便于管道处理）
npm run audit:links -- --json > /tmp/link-audit.json
```

## 参数说明

**通用参数**（三个脚本均支持）：
- `--concurrency=N`  并发请求数，默认 10
- `--timeout=N`      单请求超时毫秒，默认 8000
- `--json`           输出完整 JSON 而非表格
- `--only-errors`    只打印失败项

**check-sitemap-urls.js 专用**：
- `--sitemap=PATH_OR_URL`  本地路径或 https:// URL，默认 `./sitemap.xml`

## 退出码

- `0` 全部通过
- `1` 有失败项（可用于 CI 阻断部署）
- `2` 工具自身错误（找不到文件等）

## 后续规划

- `check-howtoplay.js`：检查 howToPlay 内容质量（过于通用的内容标记）
- `pre-deploy.js`：一键跑所有 audit，全部通过才放行部署
