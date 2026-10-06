import { handleStoryboardsRequest } from "../server/storyboards.js";
import { readBody, writeResponse } from "../server/dev-middleware.mjs";

// 图片模型单张生成可能超过 10 秒，给足余量。
export const maxDuration = 60;

export default async function handler(req, res) {
  const abortController = new AbortController();
  const abortRequest = () => {
    if (!res.writableEnded) abortController.abort();
  };
  req.on("aborted", abortRequest);
  res.on("close", abortRequest);

  try {
    const body = await readBody(req);
    const origin = `https://${req.headers.host || "localhost"}`;
    const request = new Request(`${origin}/api/storyboards`, {
      method: req.method,
      headers: req.headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
      signal: abortController.signal,
    });
    const response = await handleStoryboardsRequest(request, process.env);
    await writeResponse(response, res);
  } catch (error) {
    if (!res.headersSent) {
      res.statusCode = error?.message === "REQUEST_TOO_LARGE" ? 413 : 500;
      res.setHeader("content-type", "application/json; charset=utf-8");
    }
    if (!res.writableEnded) {
      res.end(
        JSON.stringify({
          code: "SERVER_ERROR",
          message: "服务无法处理本次请求。",
          retryable: false,
        }),
      );
    }
  } finally {
    req.off("aborted", abortRequest);
    res.off("close", abortRequest);
  }
}
