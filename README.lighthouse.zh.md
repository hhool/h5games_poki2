项目当前进度（自动记录）

日期: 2026-03-07

已完成：
- Run performance audit (Lighthouse) — 报告: dist/lighthouse-report.html
- Minify & bundle CSS/JS (Rollup/PostCSS)
- Optimize images (WebP generation + detection script)
- Enable CDN & caching headers (/_headers 已更新)
- Measure & iterate (Lighthouse)
- Add manifest-based SW generator (`scripts/generate-sw.js`)
- Create `scripts/generate-sw.js`
- Wire `generate:sw` into `package.json` build
- Run generator and verify `dist/sw.js`
- Create SW validate script (`scripts/validate-sw.js`)
- Add `validate:sw` npm script
- Run validation and fix issues
- Enhance `validate-sw` to check HTTP accessibility (`--http`)
- Precompression (generate .gz and .br) and integrate into build (`scripts/precompress.js`)

待完成 / 建议优先级：
1. Enable Brotli/Gzip and HTTP/2 — 部署验证 CDN/Pages 是否正确返回 .br/.gz 并启用 HTTP/2（高）
2. Review service-worker cache (deepen) — 考虑将更多页面/资源加入 precache 或使用 runtime cache 策略（中）
3. Reduce main-thread (code-splitting & lazy-load) — 切分 `js/app.js` 减少主线程执行时间（高）
4. Fix external CORS image failures — 移除/替换或代理外部资源（中）
5. Add all game pages to precache (optional) — 注意安装体积与首次安装时延（低/可选）
6. Deploy & verify headers, precompressed delivery, and SW registration — 在生产环境验证效果（高）
7. Add `validate:sw` to CI pre-deploy — 在部署管线中运行校验（中）
8. Further compress/resize large images and ensure lazy-loading — 进一步降低图片传输体积（中）

备注：相关脚本与改动已提交到工作区，包括 `scripts/hash-assets.js`（rev 逻辑）、`scripts/generate-sw.js`、`scripts/validate-sw.js`、`scripts/precompress.js`、以及对 `package.json` 的构建流水线更新。
