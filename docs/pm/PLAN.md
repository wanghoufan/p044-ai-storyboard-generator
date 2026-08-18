# PLAN — AI 图文短剧分镜生成器

> 项目计划首版（neat-freak 2026-08-18，依据 README / docs/qa/design-qa 已验证事实）

## 1. 项目目标
面向短视频创作者的图文分镜工作台：服务端先调用阿里云百炼 `qwen3.7-plus` 按流式响应逐条展示 5 个文字镜头，再自动调用 `qwen-image-2.0-pro-2026-06-22` 为每个镜头生成一张 16:9 横屏图片。

## 2. 技术栈与架构（已验证）
- 前端 / 构建：Vite（`package.json`、`vite.config.mjs`、`worker/index.js`、`public/`）
- 模型：百炼 `qwen3.7-plus`（文字）、`qwen-image-2.0-pro-2026-06-22`（图片，16:9，默认 2688*1536）
- 配置：`.env`（`DASHSCOPE_API_KEY` 等），不提交版本库；浏览器仅访问本站 `/api/storyboards`，不接触 API Key
- 注意：本快照仅含 `dist/` 构建产物与 3 张设计证据图，源码树未在交付包内（已据实说明，未虚构源码目录）

## 3. 已交付 MVP（design-qa passed）
- 5 文字镜头流式展示 + 5 张 16:9 横屏图（图片 2 RPM 排队）
- 横版改版：文字在上、图片在下；桌面 793×446、移动 314×176，比例均 1.778，无横向溢出
- 放大预览（桌面宽屏上限 / 移动适配）、下载与重新生成按钮在图片下方
- 18 项自动测试 + 正式构建通过；浏览器控制台无错误

## 4. 下一步（PRODUCT_BACKLOG）
- 源码树补回 / 版本库整理（当前仅 dist）
- 百炼链接 24h 失效的本地缓存与批量下载

## 5. 验收基线
- `docs/qa/design-qa.md`：passed；`docs/qa/QA_CHECKLIST.md` 与 3 张实现证据图已归位 `docs/qa/`
