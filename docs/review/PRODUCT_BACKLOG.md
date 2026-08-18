# Product Backlog — AI 图文短剧分镜生成器

> 产品优化 backlog 首版（neat-freak 2026-08-18，依据 README 已记载方向）

## 产品能力
- [ ] 分镜数 / 比例可配置（当前固定 5 张、16:9）
- [ ] 批量下载与本地缓存（应对百炼链接 24h 失效）
- [ ] 登录 / 额度 / 费用确认（README 注明当前无，存在费用滥用风险）

## 工程与运维
- [ ] 源码树补回并纳入版本库（当前仅 dist）
- [ ] CI：`pnpm test/build/test:sites` 固化
- [ ] 百炼调用成本监控与限速策略

## 验收边界
- 浏览器只访问 `/api/storyboards`，API Key 不进前端 bundle（README 约束）。
