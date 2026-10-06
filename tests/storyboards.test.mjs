import assert from "node:assert/strict";
import test from "node:test";
import {
  NdjsonShotParser,
  buildImagePrompt,
  buildStoryboardMessages,
  createDownloadToken,
  generateStoryboardImage,
  handleStoryboardsRequest,
  validateImageGenerationInput,
  validateStoryboardInput,
  verifyDownloadToken,
} from "../server/storyboards.js";
import {
  formatAllShotsForClipboard,
  formatShotForClipboard,
} from "../src/storyboard-utils.js";

function makeShot(index) {
  return {
    shotNumber: String(index).padStart(2, "0"),
    visualDescription: `画面 ${index}`,
    characterAction: `动作 ${index}`,
    dialogueOrNarration: `台词 ${index}`,
    shotType: `镜头 ${index}`,
    visualPrompt: `提示词 ${index}`,
  };
}

function makeRequest(body) {
  return new Request("https://example.test/api/storyboards", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function upstreamSseFromChunks(chunks) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          const payload = JSON.stringify({
            choices: [{ delta: { content: chunk } }],
          });
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    }),
    { status: 200, headers: { "content-type": "text/event-stream" } },
  );
}

test("validates required input and supplies the default style", () => {
  const result = validateStoryboardInput({
    theme: "  逆袭  ",
    script: "  主角走进雨夜。 ",
    style: "",
  });

  assert.equal(result.theme, "逆袭");
  assert.equal(result.script, "主角走进雨夜。");
  assert.equal(result.style, "写实电影感、适合横屏短视频");
  assert.throws(
    () => validateStoryboardInput({ theme: "", script: "内容" }),
    /请填写短剧主题/,
  );
});

test("prompt locks the output to five NDJSON storyboard objects", () => {
  const messages = buildStoryboardMessages({
    theme: "测试主题",
    script: "测试剧本",
    style: "测试风格",
  });

  assert.match(messages[0].content, /恰好 5 行/);
  assert.match(messages[0].content, /shotNumber/);
  assert.match(messages[1].content, /测试主题/);
  assert.match(messages[1].content, /测试剧本/);
});

test("NDJSON parser handles objects split across stream chunks", () => {
  const received = [];
  const parser = new NdjsonShotParser((shot) => received.push(shot));
  const output = Array.from({ length: 5 }, (_, index) =>
    JSON.stringify(makeShot(index + 1)),
  ).join("\n");

  parser.push(output.slice(0, 37));
  parser.push(output.slice(37, 181));
  parser.push(output.slice(181));
  const result = parser.finish();

  assert.equal(result.length, 5);
  assert.deepEqual(received, result);
  assert.equal(result[4].shotNumber, "05");
});

test("API returns a clear configuration error when the key is missing", async () => {
  const response = await handleStoryboardsRequest(
    makeRequest({ theme: "主题", script: "剧本", style: "" }),
    {},
  );
  const payload = await response.json();

  assert.equal(response.status, 500);
  assert.equal(payload.code, "API_KEY_MISSING");
  assert.doesNotMatch(JSON.stringify(payload), /Bearer/);
});

test("API relays five validated shots as same-origin SSE events", async () => {
  const output =
    Array.from({ length: 5 }, (_, index) =>
      JSON.stringify(makeShot(index + 1)),
    ).join("\n") + "\n";
  const chunks = [output.slice(0, 51), output.slice(51, 217), output.slice(217)];
  let upstreamRequest;

  const response = await handleStoryboardsRequest(
    makeRequest({ theme: "主题", script: "剧本", style: "电影感" }),
    { DASHSCOPE_API_KEY: "test-key" },
    async (url, options) => {
      upstreamRequest = { url, options };
      return upstreamSseFromChunks(chunks);
    },
  );
  const payload = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/event-stream/);
  assert.match(upstreamRequest.url, /chat\/completions$/);
  assert.equal(
    JSON.parse(upstreamRequest.options.body).model,
    "qwen3.7-plus",
  );
  assert.equal((payload.match(/event: shot/g) || []).length, 5);
  assert.match(payload, /event: done/);
  assert.doesNotMatch(payload, /test-key/);
});

test("image input validation and prompt preserve visual identity details", () => {
  const input = validateImageGenerationInput({
    action: "generateImage",
    theme: "雨夜重逢",
    style: "悬疑、冷色调",
    seed: 9527,
    shot: makeShot(3),
  });
  const prompt = buildImagePrompt(input);

  assert.equal(input.shot.shotNumber, "03");
  assert.equal(input.seed, 9527);
  assert.match(prompt, /横屏 16:9/);
  assert.match(prompt, /人物/);
  assert.doesNotMatch(prompt, /台词 3/);
});

test("image API uses the native Qwen image endpoint and strict parameters", async () => {
  let upstreamRequest;
  const result = await generateStoryboardImage(
    {
      action: "generateImage",
      theme: "雨夜重逢",
      style: "悬疑",
      seed: 12345,
      shot: makeShot(2),
    },
    { DASHSCOPE_API_KEY: "test-key" },
    async (url, options) => {
      upstreamRequest = { url, options };
      return Response.json({
        output: {
          choices: [
            {
              message: {
                content: [
                  { image: "https://example.aliyuncs.com/result.png?Expires=1" },
                ],
              },
            },
          ],
        },
      });
    },
  );
  const body = JSON.parse(upstreamRequest.options.body);

  assert.match(upstreamRequest.url, /multimodal-generation\/generation$/);
  assert.equal(body.model, "qwen-image-2.0-pro-2026-06-22");
  assert.equal(body.parameters.size, "2688*1536");
  assert.equal(body.parameters.seed, 12345);
  assert.equal(body.parameters.n, 1);
  assert.equal(body.parameters.prompt_extend, false);
  assert.equal(body.parameters.watermark, false);
  assert.equal(result.shotNumber, "02");
  assert.equal(result.width, 2688);
  assert.equal(result.height, 1536);
  assert.ok(result.downloadToken);
  assert.doesNotMatch(JSON.stringify(result), /test-key/);
});

test("download tokens reject tampering and expiration", async () => {
  const token = await createDownloadToken(
    "https://example.aliyuncs.com/result.png",
    "04",
    "test-key",
    1_000,
  );
  const payload = await verifyDownloadToken(token, "test-key", 2_000);

  assert.equal(payload.shotNumber, "04");
  assert.equal(payload.url, "https://example.aliyuncs.com/result.png");
  await assert.rejects(
    verifyDownloadToken(`${token}x`, "test-key", 2_000),
    /修改|无效/,
  );
  await assert.rejects(
    verifyDownloadToken(token, "test-key", 90_000_000),
    /过期/,
  );
});

test("same endpoint dispatches image generation and secure downloads", async () => {
  let calls = 0;
  const env = { DASHSCOPE_API_KEY: "test-key" };
  const imageResponse = await handleStoryboardsRequest(
    makeRequest({
      action: "generateImage",
      theme: "主题",
      style: "电影感",
      seed: 9,
      shot: makeShot(1),
    }),
    env,
    async () =>
      Response.json({
        output: {
          choices: [
            {
              message: {
                content: [
                  { image: "https://example.aliyuncs.com/shot-01.png" },
                ],
              },
            },
          ],
        },
      }),
  );
  const imagePayload = await imageResponse.json();
  const downloadResponse = await handleStoryboardsRequest(
    makeRequest({
      action: "downloadImage",
      token: imagePayload.downloadToken,
    }),
    env,
    async () => {
      calls += 1;
      return new Response(new Uint8Array([137, 80, 78, 71]), {
        headers: { "content-type": "image/png" },
      });
    },
  );

  assert.equal(imageResponse.status, 200);
  assert.equal(downloadResponse.status, 200);
  assert.match(
    downloadResponse.headers.get("content-disposition"),
    /storyboard-01\.png/,
  );
  assert.equal(calls, 1);
});

test("image API maps rate limits and malformed model responses", async () => {
  const body = {
    action: "generateImage",
    theme: "主题",
    style: "电影感",
    seed: 18,
    shot: makeShot(1),
  };
  const limited = await handleStoryboardsRequest(
    makeRequest(body),
    { DASHSCOPE_API_KEY: "test-key" },
    async () =>
      new Response("limited", {
        status: 429,
        headers: { "retry-after": "30" },
      }),
  );
  const limitedPayload = await limited.json();

  assert.equal(limited.status, 429);
  assert.equal(limitedPayload.code, "RATE_LIMITED");
  assert.equal(limitedPayload.retryAfterMs, 30_000);

  const malformed = await handleStoryboardsRequest(
    makeRequest(body),
    { DASHSCOPE_API_KEY: "test-key" },
    async () => Response.json({ output: { choices: [] } }),
  );
  const malformedPayload = await malformed.json();

  assert.equal(malformed.status, 502);
  assert.equal(malformedPayload.code, "INVALID_IMAGE_RESPONSE");
});

test("image API preserves sanitized Bailian diagnostics and network failures", async () => {
  const body = {
    action: "generateImage",
    theme: "主题",
    style: "电影感",
    seed: 18,
    shot: makeShot(1),
  };
  const rejected = await handleStoryboardsRequest(
    makeRequest(body),
    { DASHSCOPE_API_KEY: "test-key" },
    async () =>
      Response.json(
        {
          code: "InvalidParameter",
          message: "size is invalid for sk-secret-value",
          request_id: "request-123",
        },
        { status: 400 },
      ),
  );
  const rejectedPayload = await rejected.json();

  assert.equal(rejected.status, 502);
  assert.equal(rejectedPayload.code, "BAILIAN_REQUEST_FAILED");
  assert.equal(rejectedPayload.providerCode, "InvalidParameter");
  assert.equal(rejectedPayload.requestId, "request-123");
  assert.match(rejectedPayload.message, /size is invalid/);
  assert.doesNotMatch(JSON.stringify(rejectedPayload), /sk-secret-value/);

  const networkFailure = await handleStoryboardsRequest(
    makeRequest(body),
    { DASHSCOPE_API_KEY: "test-key" },
    async () => {
      throw new TypeError("fetch failed");
    },
  );
  const networkPayload = await networkFailure.json();

  assert.equal(networkFailure.status, 502);
  assert.equal(networkPayload.code, "IMAGE_NETWORK_ERROR");
  assert.match(networkPayload.message, /连接百炼图片服务失败/);
});

test("download action rejects forged tokens without fetching upstream", async () => {
  let calls = 0;
  const response = await handleStoryboardsRequest(
    makeRequest({ action: "downloadImage", token: "forged.token" }),
    { DASHSCOPE_API_KEY: "test-key" },
    async () => {
      calls += 1;
      return new Response("should not run");
    },
  );
  const payload = await response.json();

  assert.equal(response.status, 403);
  assert.equal(payload.code, "INVALID_DOWNLOAD_TOKEN");
  assert.equal(calls, 0);
});

test("clipboard formatting includes every required storyboard field", () => {
  const shot = makeShot(1);
  const single = formatShotForClipboard(shot);
  const all = formatAllShotsForClipboard([shot, makeShot(2)]);

  assert.match(single, /镜头 01/);
  assert.match(single, /画面描述：画面 1/);
  assert.match(single, /人物动作：动作 1/);
  assert.match(single, /台词或旁白：台词 1/);
  assert.match(single, /镜头类型：镜头 1/);
  assert.match(single, /画面提示词：提示词 1/);
  assert.match(all, /镜头 02/);
});
