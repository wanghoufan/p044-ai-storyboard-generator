import { handleStoryboardsRequest } from "./storyboards.js";

export function readBody(req, limit = 100_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("REQUEST_TOO_LARGE"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export async function writeResponse(response, res) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));

  if (!response.body) {
    res.end();
    return;
  }

  const reader = response.body.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
  } finally {
    res.end();
  }
}

export function storyboardApiPlugin(serverEnv = process.env) {
  return {
    name: "storyboard-api",
    configureServer(server) {
      server.middlewares.use("/api/storyboards", async (req, res) => {
        const abortController = new AbortController();
        const abortRequest = () => {
          if (!res.writableEnded) abortController.abort();
        };
        req.on("aborted", abortRequest);
        res.on("close", abortRequest);

        try {
          const body = await readBody(req);
          const origin = `http://${req.headers.host || "localhost"}`;
          const request = new Request(`${origin}/api/storyboards`, {
            method: req.method,
            headers: req.headers,
            body:
              req.method === "GET" || req.method === "HEAD" ? undefined : body,
            signal: abortController.signal,
          });
          const response = await handleStoryboardsRequest(request, serverEnv);
          await writeResponse(response, res);
        } catch (error) {
          if (!res.headersSent) {
            res.statusCode = error?.message === "REQUEST_TOO_LARGE" ? 413 : 500;
            res.setHeader("content-type", "application/json; charset=utf-8");
          }
          if (!res.writableEnded) {
            res.end(
              JSON.stringify({
                code: "DEV_SERVER_ERROR",
                message: "本地服务无法处理该请求。",
                retryable: false,
              }),
            );
          }
        } finally {
          req.off("aborted", abortRequest);
          res.off("close", abortRequest);
        }
      });
    },
  };
}
