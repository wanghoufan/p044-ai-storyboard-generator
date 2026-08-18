# 交接文档（HANDOFF）— AI 图文短剧分镜生成器

> 本文件依据规范模板 v2.3 的 `docs/handoff/HANDOFF.md` 生成；由 neat-freak 整理动作产出（2026-08-18）。

## 1. 项目概述
- 面向短视频创作者的图文分镜工作台：服务端先调用阿里云百炼 `qwen3.7-plus` 流式生成 5 条文字镜头，再调用 `qwen-image-2.0-pro` 为每条生成 16:9 横屏图片。
- 已 DONE（见文件夹命名 `DONE丨20260725`）。

## 2. 当前状态
- 完整 MVP 已完成，公网 Sites 版本已发布。
- 设计验收：`docs/qa/design-qa.md`（Design QA，final result: passed，已将分镜结果区改为“文字在上、图片在下”的 16:9 纵向流）。

## 3. 技术栈 / Source of Truth
- 框架：Vite（含服务端 Worker）。
- 配置：` .env` / `.env.example`（环境变量；`.env` 不提交 Git）；关键变量 `DASHSCOPE_API_KEY`、`DASHSCOPE_BASE_URL`、`DASHSCOPE_MODEL`、`DASHSCOPE_IMAGE_MODEL`、`DASHSCOPE_IMAGE_SIZE`（默认 2688*1536 / 16:9）。
- 关键目录：`public/`（含 demo 素材如 `public/demo-storyboard-frame-wide.png`、`implementation-storyboard-*.png` 等设计验收证据）、`dist/`（构建产物）、`index.html`、`vite.config.mjs`、`package.json`。
- 公网地址：`https://ai-storyboard-studio-2026.mortimerstephanie14.chatgpt.site`（Sites，生产环境变量由 Sites 托管）。

## 4. 文档地图（规范 v2.3）
| 文件 | 内容 |
|---|---|
| `docs/pm/PLAN.md` | 计划骨架（待补充） |
| `docs/qa/QA_CHECKLIST.md` | 回归清单（待补充） |
| `docs/qa/BUGS.md` | 缺陷跟踪（待补充） |
| `docs/qa/design-qa.md` | 设计验收报告（由根目录 `design-qa.md` 移入） |
| `docs/review/CODE_REVIEW.md` | 代码审查（待补充） |
| `docs/review/PRODUCT_BACKLOG.md` | 产品优化 backlog（待补充） |
| `docs/handoff/HANDOFF.md` | 本文件 |
| `docs/roles/*.md` | 角色规范骨架（待补充） |
| `scratch/` | 临时 / 冗余 / 备份（当前为空） |

## 5. 本次整理记录（2026-08-18）
- `design-qa.md` → `docs/qa/design-qa.md`。
- 新建全套规范骨架。
- 源码 / 依赖 / 构建目录（`src/`、`public/`、`dist/`、`node_modules/`、`.git/`、`.openai/`、`.pnpm-store/` 等）未动；`.env` / `.env.example` 作为配置保留在原位。

## 6. 已知事项 / 下一步
- 图片模型按张计费（默认一次 5 张，2 RPM 排队）；百炼图片链接约 24 小时失效，需在当前会话内下载。
- 当前版本无站内登录 / 额度 / 费用确认，任何拿到链接的人都能使用并产生 API 费用。
- 建议补全 `docs/pm/PLAN.md` 与 `docs/qa/QA_CHECKLIST.md`。

## 7. neat-freak 收尾记录（2026-08-18）

- 一致性核查：README.md 与代码事实一致；`docs/qa/design-qa.md` 结论 passed（16:9 改版 + 18 项自动测试通过）。
- ⚠️ 文档-代码差异：`AGENTS.md` 含通用模板「Build app UI in `src/`」并提及 `worker/`、`scripts/`、`tests/`，但本快照**无 `src/`、`worker/`、`scripts/`、`tests/`**，排除依赖后**无任何源码文件**，仅有 `dist/`（构建产物）、`index.html`、`vite.config.mjs`、`.env.example`。已在 `AGENTS.md` 补「项目结构事实」。
- 整理动作：根目录 3 张设计验收证据 PNG（`implementation-storyboard-*.png`）已移至 `docs/qa/`，与 design-qa.md 同处。
- 文档地图：规范骨架齐备；`QA_CHECKLIST.md` 已据 design-qa 建立基线；`BUGS/CODE_REVIEW/PRODUCT_BACKLOG` 经核查为空，当前无遗留问题。
- scratch/：仅 `.gitkeep`。
- 风险：本快照**只有构建产物、无可重建源码树**，版本交付需回溯原 ChatGPT Sites 项目（公网地址见 README）。
