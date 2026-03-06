# SEO Roadmap — poki2.online
> Prioritized SEO Backlog（优先级排列的 SEO 待办列表）
> 本文件仅本地存档，不纳入版本管理。

---

## P0 ✅ 已完成

| # | 项目 | commit |
|---|---|---|
| 1 | GSC/Bing 风格离线 SEO 审计工具（`check-seo-meta.js`，13项检查） | `aa1e135` |
| 2 | DESC apostrophe 正则 bug 修复 | `aa1e135` |
| 3 | 双 H1 修复（game 页 hero-title 降级为 `<p>`） | `aa1e135` |
| 4 | 221 条 description 扩充至 130–158 chars | `cf62ba8` |
| 5 | 37 条短标题自动追加类型后缀 | `cf62ba8` |
| 6 | BreadcrumbList JSON-LD（pos2 指向 `/tag/{key}/`） | `cf62ba8` |
| 7 | VideoGame JSON-LD 增强字段（screenshot/offers/numberOfPlayers） | `cf62ba8` |
| 8 | Noscript 面包屑 + genre tag 内链 + 相关游戏 | `29dcf30` |
| 9 | 12 个静态 tag/category 页（CollectionPage JSON-LD） | `4e55e1d` |
| 10 | Sitemap image:image 扩展（219 game URL） | `cf62ba8` |
| 11 | Sitemap 纳入 12 个 tag URL（总计 237 条） | `4e55e1d` |
| 12 | robots.txt Bingbot Crawl-delay:5 + AI 爬虫屏蔽 | `e4d11d6` |
| 13 | 构建流程加入 generate:tagpages | `e4d11d6` |
| 14 | dev_seo → main 合并 | `3d2d88e` |
| 15 | 游戏图标 `<link rel=preload fetchpriority=high>`（LCP 优化） | `9d3f85d` |
| 16 | `#game-iframe loading=lazy` | `9d3f85d` |
| 17 | TAG_META / TAG_ORDER 与 12 tag 页对齐（加 adventure/multiplayer/arcade/platformer） | `5fc104b` |

---

## P1 ✅ 富结果（全部完成）

| # | 项目 | commit |
|---|---|---|
| 1 | **FAQPage JSON-LD** — `games.json` 加 `howToPlay` 字段，221 游戏页注入 FAQPage schema | `c312c4a` |
| 2 | **首页 + 游戏页 noscript 静态内链** — 前20游戏 + 12个 `/tag/*/` 链接 | `9ae4980` / `3a20b61` |
| 3 | **Tag 页互链** — 每个 tag 页底部 Related Categories（11个交叉链接） | `72c0c30` |
| 4 | **WebSite + SearchAction JSON-LD** — 首页已注入，触发 Google Sitelinks Search Box | 已存在 |
| 5 | **Tag 页真实 H1** — `<p class="hero-title">` 升级为 `<h1>` | `a3bcced` |
| 6 | **Tag 页可见 intro 段落** — H1 下方注入分类描述 + 游戏数量 | `19d6918` |

- [x] **SiteNavigationElement JSON-LD** — 首页 12个 tag 分类导航，`ItemList` + `SiteNavigationElement`，`commit 7290440` ✅

## P2 ✅ CWV / 性能（全部完成）

| # | 项目 | commit | 效果 |
|---|---|---|---|
| 6 | **`_headers` 长缓存** — `/js/*` `/css/*` `max-age=31536000, immutable` | `a3bcced` | ✅ |
| 7 | **首页 Hero 6张图 preload** — `fetchpriority=high` + 补全 preconnect | `2ee0d81` | ✅ |
| 8 | **Service Worker 预缓存修复** — v3，正确文件名 style.css / app.js | `2ee0d81` | ✅ |
| 9 | **构建管道修复** — rollup→app.js（-56%），cssnano→style.css（-31%），defer JS（-37~54%） | `98249cc` | ✅ |

## P3 — 数据追踪

- [ ] 9. **Google Analytics 4** — 接入 GA4，与 GSC 联动
- [ ] 10. **Microsoft Clarity** — 热力图 + 会话录制，配合 Bing Webmaster

## P4 ✅ 社交分享

| # | 项目 | commit |
|---|---|---|
| 11 | **Tag 页 og:image 个性化** — 每个分类使用首张 featured 游戏图（原为通用 icon-512.png） | `4bad74d` |
| — | 游戏页 og:image / og:title / og:description 已个性化 | 已存在 |

## P5 — 结构化数据扩展

- [x] 12. **SiteNavigationElement JSON-LD** — 首页 12个 tag 分类，`commit 7290440` ✅
- [ ] 13. **VideoObject JSON-LD** — 有 gameplay 视频时注入
- [ ] 14. **游戏页 noscript 截图 `<img>`** — 丰富 Google Image 索引

## P6 — 内容质量

- [ ] 15. **404 页优化** — 加热门游戏推荐 + 分类链接
- [ ] 16. **about / contact / privacy meta description 补全**
- [ ] 17. **`lastmod` 自动化** — 读文件实际修改时间替代硬编码

## P7 ✅ Tag 页分页

| # | 项目 | commit |
|---|---|---|
| 18 | **idle(86→ 4页) / puzzle(44→ 2页) 分页** — `rel=prev/next`、canonical 自指、`Page N` title | `8199db5` |
| 19 | **分页页纳入 sitemap** — 新增 5 个 URL（idle/2,3,4 + puzzle/2），priority 0.5 | `8199db5` |

## P8 ✅ 子域屏蔽

| # | 项目 | 状态 |
|---|---|---|
| 21 | **CDN 子域 noindex** — 全部 25 个 shard 加 `X-Robots-Tag: noindex, follow` | ✅ 线上验证通过 |
| 22 | **Shard 子站 robots.txt** — `Disallow: /*/` 阻止 Googlebot 爬取游戏子目录 | ✅ |
| 23 | **Shard canonical 修正** — 全部 494 个 shard 游戏页 canonical/og:url/JSON-LD url 修正为 `/game/{letter}/{slug}/`；14 个历史遗漏 canonical 补全 | ✅ |
| 24 | **sitemap_index.xml** — 汇总所有子站 sitemap | — 可选 |

## A11y ✅ 无障碍

| # | 项目 | commit | 效果 |
|---|---|---|---|
| 1 | **Badge 对比度修复** — badge-new/hot/popular 全部通过 WCAG AA 4.5:1 | `b722a4a` | new 5.06:1 / hot 5.15:1 / popular 6.65:1 |

## P9 — 评分 / UGC

- [ ] 25. **AggregateRating JSON-LD** — LocalStorage 点赞数注入
- [ ] 26. **用户短评区**（静态渲染，爬虫可见）

## P10 — 基础设施

- [ ] 27. **Cloudflare Cache Rules** — `/game/*` Edge Cache TTL
- [ ] 28. **Brotli 压缩验证**
- [ ] 29. **HTTP/3 QUIC 启用确认**

## P11 — 多语言

- [ ] 30. **`hreflang` 标签预置**（中文 / 西班牙语计划时启用）
- [ ] 31. **多语言 description 字段**（`description_zh` / `description_es`）

## P12 — 关键词优化

- [ ] 32. **GSC 搜索词导出 → 反向优化 description**
- [ ] 33. **低 CTR 游戏页 title A/B 测试**
- [ ] 34. **长尾词扩充**（"free online X game no download"）

## P13 — 外链 / 品牌

- [ ] 35. 提交到 Indie DB / itch.io / AlternativeTo 目录
- [ ] 36. 开发者主页外链
- [ ] 37. Wikipedia / Fandom 词条补充链接

## P14 — 移动端专项

- [ ] 38. **PWA manifest `shortcuts`** 指向热门 tag 页
- [ ] 39. **移动端 Core Web Vitals 专项测试**
- [ ] 40. **AMP 评估**（游戏详情页轻量版本）

## P15 — 视频 SEO

- [ ] 41. **Gameplay 视频录制流程**（每款30秒）
- [ ] 42. **YouTube 频道 + 描述含站点链接**
- [ ] 43. **视频 sitemap**（`<video:video>` 扩展）

## P16 — 监控 / CI

- [ ] 44. **SEO audit CI** — GitHub Actions 定时跑 `check-seo-meta.js`
- [ ] 45. **死链监控**（404 自动告警）
- [ ] 46. **sitemap 健康检查 cron**（定时 ping GSC Sitemap API）
- [ ] 47. **CWV 回归告警**（LCP > 2.5s 触发通知）
- [ ] 48. **索引量趋势监控**（GSC API 自动抓取存 CSV）

## P17 — 内容扩展

- [ ] 49. **游戏攻略页**（`/guide/{slug}/`，静态生成）
- [ ] 50. **每周精选游戏文章页**（`/picks/week-YYYY-WW/`）
- [ ] 51. **游戏类型介绍长文页**（`/about/puzzle-games/`，E-E-A-T）
- [ ] 52. **新游戏上线 changelog 页**（`/changelog/`）

## P18 — 数据驱动

- [ ] 53. **搜索趋势监控**（Google Trends API + games.json 关联）
- [ ] 54. **季节性游戏推荐**（时令标签）
- [ ] 55. **相关游戏算法升级**（TF-IDF 替代 tag-score）
- [ ] 56. **TAG_ORDER 动态排序**（按用户行为数据调整）

## P19 — 竞品分析

- [ ] 57. **Poki.com 关键词覆盖缺口分析**
- [ ] 58. **CrazyGames.com 结构化数据对比**
- [ ] 59. **竞品 backlink profile 分析**

## P20 — 长期战略

- [ ] 60. **独立博客子域**（`blog.poki2.online`，SEO 内容营销）
- [ ] 61. **游戏嵌入代码生成**（`<iframe>` embed，产生外链）
- [ ] 62. **品牌 Knowledge Panel 申请**（Wikidata 条目）
- [ ] 63. **年度 SEO ROI 复盘**（GSC + GA4，策略迭代）

---

## 当前状态

| 指标 | 数值 |
|---|---|
| 游戏页 | 219 |
| Tag 页 | 12 |
| Sitemap 总 URL | 237 |
| 审计错误 | 0 |
| 审计警告 | 0 |
| 分支 | main = dev_seo = `8199db5` |
| 最后部署 | 2026-03-06 |
| Shard 子站 noindex | 25/25 ✅ 线上验证 |
| JS 体积 | 49 KB（原 112 KB，−56%） |
| CSS 体积 | 37 KB（原 53 KB，−31%） |
| Badge 对比度 | WCAG AA ✅（new 5.06:1 / hot 5.15:1 / popular 6.65:1） |
| 验证文件 | `google65c93755d768ab97.html` / `BingSiteAuth.xml` |

## 待处理 ⚠️

| 优先级 | 项目 |
|---|---|
| 低 | **P3** GA4 / Clarity 接入 |
