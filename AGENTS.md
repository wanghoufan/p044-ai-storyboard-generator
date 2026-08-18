# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Locked product decisions

- The selected visual source is the first generated concept: a dark cinematic director console with a left input rail and a right storyboard grid.
- The product language is Simplified Chinese. Use a charcoal base, electric cyan primary state, restrained violet accents, compact film-production density, and high text contrast.
- V1 generates exactly five text storyboards through a same-origin server proxy to Alibaba Cloud Model Studio, then automatically generates one 16:9 landscape image for each storyboard with qwen-image-2.0-pro-2026-06-22.
- Each storyboard card is a single-column reading flow: title and text details first, followed by a full-width 16:9 image and its actions.
- Image results use signed, temporary download tokens and remain current-session only. Never expose the API key to browser code.
- V1 has no app-owned authentication, persistence, history, database, quota, or fee confirmation. Public hosting is live; do not claim access control that does not exist.

## Current release status

- As of 2026-07-31, Sites version 1 is publicly deployed at `https://ai-storyboard-studio-2026.mortimerstephanie14.chatgpt.site`.
- Production environment variables are managed by Sites. The local `.env` remains local-only and must never be copied into source, logs, or build artifacts.
- Before every later Sites release, run `npm test`, `npm run build`, and `npm run test:sites`; push the exact source state, save a Sites version from that commit, deploy the saved version, and verify the live page.

## 项目结构事实（neat-freak 2026-08-18 核对）

> 以下为当前快照的真实结构；上方通用「Prototype Instructions」中「Build app UI in `src/`」及 `worker/`、`scripts/`、`tests/` 在本快照中**不存在**。

- 排除依赖后，**本快照无任何源码文件**（无 `src/`、`worker/`、`scripts/`、`tests/`）
- 仅有：构建产物 `dist/`（含 `dist/client`、`dist/server`）、`index.html`、`vite.config.mjs`、`.env.example`
- 站点托管配置：`.openai/hosting.json`
- 设计事实源：深色导演控制台（首版生成概念）
- 说明：本快照为构建产物导出，重建需回溯原 ChatGPT Sites 项目（公网地址见 README）。
