# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Before a release, run `npm run build` and `npm test`.

## Locked product decisions

- The selected visual source is the first generated concept: a dark cinematic director console with a left input rail and a right storyboard grid.
- The product language is Simplified Chinese. Use a charcoal base, electric cyan primary state, restrained violet accents, compact film-production density, and high text contrast.
- V1 generates exactly five text storyboards through a same-origin server proxy to Alibaba Cloud Model Studio, then automatically generates one 16:9 landscape image for each storyboard with qwen-image-2.0-pro-2026-06-22.
- Each storyboard card is a single-column reading flow: title and text details first, followed by a full-width 16:9 image and its actions.
- **BYOK（2026-10-06 用户拍板，覆盖旧的「Key 绝不出现在浏览器」口径）**：访问者自带百炼 API Key，费用记在访问者自己账号上。Key 存本机 `localStorage`，经 `x-dashscope-api-key` 请求头进入服务端，**只在本次请求内覆盖 env**。服务端不变量：不落盘、不写日志、不回显在响应里。`DASHSCOPE_API_KEY` 环境变量降级为本地开发兜底。
- V1 has no app-owned authentication, persistence, history, database, quota, or fee confirmation. Public hosting is live; do not claim access control that does not exist.

## Current release status

- 线上：`https://ai-storyboard-studio-zeta.vercel.app`（Vercel 项目 `ai-storyboard-studio`，`main` push 自动构建）。
- 接口实现：`api/storyboards.js`（Vercel Node 函数）与 `server/dev-middleware.mjs`（Vite 开发中间件）共用 `server/storyboards.js`。
- 原 ChatGPT Sites 通道（`worker/index.js`、`scripts/prepare-sites-build.mjs`、`.openai/hosting.json`）已停止发布，仅作遗留保留，验证走 `npm run build:sites && npm run test:sites`。
- 每次发布前跑 `npm run build` 与 `npm test`（17 项），push 后核验线上 `/api/storyboards` 无 Key 时返回 400。

## 项目结构事实（2026-10-06 核对）

- 源码齐全：`src/`（App.jsx、main.jsx、byok.js、storyboard-utils.js、styles.css）、`server/`（storyboards.js、dev-middleware.mjs）、`api/storyboards.js`、`tests/`（storyboards、byok、sites-worker）、`worker/`、`scripts/`。
- 2026-08-18 的归档提交曾把 `src/`、`server/`、`worker/`、`tests/`、`scripts/` 从版本库删除（纯删除，未改动内容），2026-10-06 从 `553a1bd` 原样恢复。
- 历史遗留：`public/demo-storyboard-frame.png` 代码零引用，未恢复；`-wide` 版本被 `src/App.jsx` 使用，已恢复。
- 双锁文件：`package-lock.json` 与 `pnpm-lock.yaml` 并存，Vercel 侧以 npm 为准（`package-lock.json` 已随本次改造同步）。
