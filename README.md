# AI 图文短剧分镜生成器

面向短视频创作者的图文分镜工作台。服务端先调用阿里云百炼 `qwen3.7-plus`，按流式响应逐条展示 5 个文字镜头；随后自动调用 `qwen-image-2.0-pro-2026-06-22`，为每个镜头生成一张 16:9 横屏图片。

线上地址：<https://ai-storyboard-studio-zeta.vercel.app>

## 使用方式（自带 Key）

1. 打开线上地址。
2. 在「百炼 API Key」里填入你自己的北京地域 API Key，点「保存」。
3. 填写短剧主题与剧本，点生成。

这把 Key 只保存在你当前浏览器的 `localStorage` 里，每次请求通过 `x-dashscope-api-key`
请求头带给服务端，服务端只在本次请求内使用它：不落盘、不写日志、不回显在响应里。
**产生的费用直接记在你自己的百炼账号上，本站不持有任何密钥，也无法替你付费。**

清除 Key：同一区块点「清除」。

## 本地运行

```bash
npm install
npm run dev
```

本地也可以改用环境变量兜底（便于不带浏览器 Key 调试）：复制 `.env.example` 为 `.env`
并填写 `DASHSCOPE_API_KEY`，此时请求头可以不带 Key。`.env` 已在 `.gitignore` 中，
不要提交。

可选环境变量：

- `DASHSCOPE_BASE_URL`：默认使用北京地域共享域名。
- `DASHSCOPE_MODEL`：默认固定为 `qwen3.7-plus`。
- `DASHSCOPE_IMAGE_ENDPOINT` / `DASHSCOPE_IMAGE_MODEL` / `DASHSCOPE_IMAGE_SIZE`：
  图片模型接口与尺寸，默认 `2688*1536`（横屏 16:9）。

图片模型按张计费，默认一次生成 5 张；页面会按 2 RPM 的限制逐张排队。百炼图片链接约
24 小时失效，请在当前会话内及时下载。

## 部署

Vercel（项目 `ai-storyboard-studio`，随 `main` 分支 push 自动构建）：

- 前端：`npm run build` 产出 `dist/client`
- 接口：`api/storyboards.js` Node 函数，复用 `server/storyboards.js`
- 配置：`vercel.json`

`worker/`、`scripts/prepare-sites-build.mjs`、`.openai/hosting.json` 是原 ChatGPT Sites
通道的遗留，已不参与默认构建，需要时可用 `npm run build:sites && npm run test:sites`
单独验证。

## 验证

```bash
npm run build
npm test
```

17 项测试覆盖输入校验、流式 NDJSON 解析、图片提示词与原生接口参数、下载签名、
防篡改校验、复制格式、BYOK 请求头链路（含 Key 不回显断言）与 Key 本地存储。
