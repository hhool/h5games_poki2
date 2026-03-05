# tools/audit/

网络探活工具集 — 验证 `games.json` 和 `sitemap.xml` 的 URL 实际可达性。

## 工具列表

| 脚本 | 检查对象 | 说明 |
|---|---|---|
| `check-game-links.js` | `game.link` (CDN iframe URL) | HEAD/GET 探活，报告非 200 |
| `check-sitemap-urls.js` | `sitemap.xml` 每条 `<loc>` | GET 探活，报告非 200 |
| `check-img-src.js` | `game.imgSrc` (CDN 图标) | HEAD 探活，报告缺失/断链 |
| `check-seo-meta.js` | `dist/game/**/index.html` | 模拟 GSC / Bing 检测流程，离线 SEO 质检 |

---

## `check-seo-meta.js` — GSC / Bing 风格 SEO 质检

### 检测项（对标 Google Search Console + Bing Webmaster Tools）

| 检测项 | 对应平台信号 | ERROR 条件 | WARN 条件 |
|---|---|---|---|
| `TITLE` | GSC 覆盖率 / Bing 页面诊断 | 缺失或 <10 chars | 10–29 或 >70 chars |
| `DESC` | GSC「描述」/ Bing 元数据 | 缺失或 <50 chars | 50–99 chars 或 >165 chars |
| `CANONICAL` | GSC 规范化 URL | — | 无 canonical 标签 |
| `VIEWPORT` | GSC 移动设备易用性 | 无 viewport meta | 缺少 width=device-width |
| `NOINDEX` | GSC 已排除页面 | robots meta 含 noindex | — |
| `H1` | GSC 内容结构 | — | 无 h1 或存在多个 h1 |
| `OG:TITLE` | 社交卡片预览 | — | 缺失 |
| `OG:DESC` | 社交卡片预览 | — | 缺失 |
| `OG:IMAGE` | 社交卡片预览 | — | 缺失或非绝对 URL |
| `TWITTER` | Twitter 卡片 | — | 无 twitter:card |
| `JSON-LD` | GSC 富媒体搜索结果 | JSON 解析失败 | 无 ld+json 块 |
| `LD-TYPE` | GSC VideoGame 富结果 | 解析失败时 | @type 非 VideoGame/Game |
| `LD-NAME` | GSC 结构化数据一致性 | 解析失败时 | name 字段与 title 不匹配 |
| `TITLE-DUP` | GSC 重复标题 | — | title 与其他页面重复 |
| `DESC-DUP` | GSC 重复描述 | — | description 与其他页面重复 |
| `SITEMAP` | GSC 站点地图覆盖率 | — | canonical URL 不在 sitemap 中 |

### 快速使用

```bash
# 检查 dist/ 中所有游戏静态页（需先 npm run build）
npm run audit:seo

# 只看 ERROR / WARN
npm run audit:seo -- --only-errors

# 只检查前 20 个页面（快速抽查）
npm run audit:seo -- --limit=20

# 指定扫描目录
npm run audit:seo -- --dir=dist/game

# JSON 输出（便于管道 / CI 处理）
npm run audit:seo -- --json > /tmp/seo-audit.json

# 统计错误数（CI 用）
npm run audit:seo -- --json | node -e "const r=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));console.log(r.flatMap(p=>p.issues).filter(i=>i.sev==='ERROR').length,'errors')"
```

---

## 快速使用（所有工具）

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

**通用参数**（所有脚本均支持）：
- `--concurrency=N`  并发请求数，默认 10
- `--timeout=N`      单请求超时毫秒，默认 8000
- `--json`           输出完整 JSON 而非表格
- `--only-errors`    只打印失败项

**check-sitemap-urls.js 专用**：
- `--sitemap=PATH_OR_URL`  本地路径或 https:// URL，默认 `./sitemap.xml`

**check-seo-meta.js 专用**：
- `--dir=PATH`   扫描目录，默认 `dist/game`
- `--limit=N`    只检查前 N 个页面
- `--no-color`   关闭 ANSI 颜色

## 退出码

- `0` 全部通过
- `1` 有失败项（可用于 CI 阻断部署）
- `2` 工具自身错误（找不到文件等）

## 后续规划

- `check-howtoplay.js`：检查 howToPlay 内容质量（过于通用的内容标记）
- `pre-deploy.js`：一键跑所有 audit，全部通过才放行部署
