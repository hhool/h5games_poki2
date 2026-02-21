# GSC 路径迁移与 Cloudflare 最小闭环部署说明

目的
-- 将旧的 query-style 游戏链接（例如 `?play-2048`）迁移为路径式 `/games/2048/`，并通过 Cloudflare Worker 做 301 重定向，确保 Google 能更好地收录每个游戏细节页。

包含文件
- `tools/convert_sitemap.py`：把 `sitemap.xml` 中的 query 样式条目转换为 `/games/<slug>/` 并输出 `sitemap.new.xml` 与 `redirects-old-query.txt`。
- `workers/redirect-query-to-path/index.js`：Cloudflare Worker，匹配 query 并 301 重定向到新路径。
- `wrangler.toml`：wrangler 部署示例（含占位符 `YOUR_ACCOUNT_ID` 与 `route`），请编辑后再发布。

快速使用（最小闭环测试）

1) 生成新 sitemap

```bash
python3 tools/convert_sitemap.py
```

- 结果：生成 `sitemap.new.xml` 和 `redirects-old-query.txt`。检查 `redirects-old-query.txt`，确认映射无误。

2) 在测试环境部署 Worker（Dashboard 或 wrangler）

- Dashboard（快速）
  - 进入 Cloudflare Dashboard → Workers → Create script。
  - 粘贴 `workers/redirect-query-to-path/index.js` 内容并保存。
  - 在 Routes 中添加测试子域（如 `https://test.your-domain/*`）进行绑定。

- wrangler（CLI）
  - 安装并登录：
    ```bash
    npm install -g wrangler
    wrangler login
    ```
  - 编辑 `wrangler.toml`：替换 `YOUR_ACCOUNT_ID` 与 `route`（先用测试子域）。
  - 发布：
    ```bash
    wrangler publish
    ```

3) 验证重定向

```bash
curl -I 'https://test.your-domain/?play-2048'
# 应返回 301 Location: https://test.your-domain/games/2048/
```

4) 上传并提交 sitemap 到 Google Search Console

- 把 `sitemap.new.xml` 放到站点根（或重命名为 `sitemap.xml`）。
- 在 GSC → Sitemaps 提交新的 sitemap 路径。

5) URL Inspection 与抓取验证

- 在 GSC 用 URL Inspection 对若干 `/games/<slug>/` 请求抓取，选择 "Request Indexing" 并查看渲染结果是否包含文本/JSON-LD（非空白）。

注意事项
- `_headers` 可控制响应头，但无法基于 query-string 做重定向，因此需要 Worker/Pages Function。  
- 简单的 301 重定向通常落在 Cloudflare Workers 的免费配额内，但高流量或复杂脚本可能需付费。  
- 先在测试子域验证，确认无误再绑定生产路由并提交 sitemap。  

回滚
- 如果不想立即在仓库推送，本地已提交在分支 `dev_gsc`；如需撤销最近提交（保留工作区），可以运行：

```bash
git reset --soft HEAD~1
```

支持
- 需要我把 `wrangler.toml` 填上 `account_id`、或把 Worker 发布到 workers.dev 并做快捷测试吗？回复 `发布` 或 `填写 account`。
