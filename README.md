# AI 图文短剧分镜生成器

面向短视频创作者的图文分镜工作台。服务端先调用阿里云百炼 `qwen3.7-plus`，按流式响应逐条展示 5 个文字镜头；随后自动调用 `qwen-image-2.0-pro-2026-06-22`，为每个镜头生成一张 16:9 横屏图片。

## 配置

1. 复制 `.env.example` 为 `.env`。
2. 在 `.env` 中填写北京地域的 `DASHSCOPE_API_KEY`。
3. 不要把 `.env` 提交到版本库；浏览器只访问本站 `/api/storyboards`，不会接触 API Key。

可选配置：

- `DASHSCOPE_BASE_URL`：默认使用北京地域共享域名，可替换为业务空间专属域名。
- `DASHSCOPE_MODEL`：默认固定为 `qwen3.7-plus`。
- `DASHSCOPE_IMAGE_ENDPOINT`：图片模型使用的百炼原生多模态接口。
- `DASHSCOPE_IMAGE_MODEL`：默认固定为 `qwen-image-2.0-pro-2026-06-22`。
- `DASHSCOPE_IMAGE_SIZE`：默认 `2688*1536`，即横屏 16:9。

图片模型按张计费，默认一次生成 5 张；页面会按 2 RPM 的限制逐张排队。百炼图片链接约 24 小时失效，请在当前会话内及时下载。

## 公网版本

截至 2026-07-31，Sites 版本 1 已公开发布：

https://ai-storyboard-studio-2026.mortimerstephanie14.chatgpt.site

生产环境变量由 Sites 托管，本地 `.env` 不会随源码或构建产物发布。当前版本没有站内登录、使用额度或费用确认；任何拿到链接的人都可以使用生成能力，并可能产生百炼 API 费用。

## 本地运行

```bash
pnpm install
pnpm dev
```

## 验证

```bash
pnpm test
pnpm build
pnpm test:sites
```

自动化测试覆盖输入校验、流式 NDJSON 解析、图片提示词与原生接口参数、下载签名、防篡改校验、复制格式和生产 Worker 路由。
