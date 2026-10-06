const DEFAULT_BASE_URL =
  "https://dashscope.aliyuncs.com/compatible-mode/v1";
const DEFAULT_MODEL = "qwen3.7-plus";
const DEFAULT_IMAGE_ENDPOINT =
  "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";
const DEFAULT_IMAGE_MODEL = "qwen-image-2.0-pro-2026-06-22";
const DEFAULT_IMAGE_SIZE = "2688*1536";
const DEFAULT_STYLE = "写实电影感、适合横屏短视频";
const MAX_REQUEST_BYTES = 100_000;
const MAX_IMAGE_BYTES = 24 * 1024 * 1024;
const DOWNLOAD_TOKEN_TTL_MS = 24 * 60 * 60 * 1_000;
const MAX_IMAGE_PROMPT_CHARS = 2_200;

const SHOT_FIELDS = [
  "shotNumber",
  "visualDescription",
  "characterAction",
  "dialogueOrNarration",
  "shotType",
  "visualPrompt",
];

export class StoryboardError extends Error {
  constructor(code, message, status = 500, retryable = false) {
    super(message);
    this.name = "StoryboardError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

export function validateStoryboardInput(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new StoryboardError(
      "INVALID_INPUT",
      "请求内容格式不正确。",
      400,
      false,
    );
  }

  const theme = typeof value.theme === "string" ? value.theme.trim() : "";
  const script = typeof value.script === "string" ? value.script.trim() : "";
  const style = typeof value.style === "string" ? value.style.trim() : "";

  if (!theme) {
    throw new StoryboardError(
      "THEME_REQUIRED",
      "请填写短剧主题。",
      400,
      false,
    );
  }
  if (!script) {
    throw new StoryboardError(
      "SCRIPT_REQUIRED",
      "请填写剧本。",
      400,
      false,
    );
  }
  if (theme.length > 80) {
    throw new StoryboardError(
      "THEME_TOO_LONG",
      "短剧主题不能超过 80 个字符。",
      400,
      false,
    );
  }
  if (script.length > 20_000) {
    throw new StoryboardError(
      "SCRIPT_TOO_LONG",
      "剧本不能超过 20,000 个字符。",
      400,
      false,
    );
  }
  if (style.length > 400) {
    throw new StoryboardError(
      "STYLE_TOO_LONG",
      "风格偏好不能超过 400 个字符。",
      400,
      false,
    );
  }

  return {
    theme,
    script,
    style: style || DEFAULT_STYLE,
  };
}

export function buildStoryboardMessages({ theme, script, style }) {
  const system = `你是一位专业短剧导演和分镜师。请根据用户提供的短剧主题、剧本与风格偏好，生成恰好 5 条连续、可拍摄的短剧分镜。

输出协议：
1. 只输出 NDJSON，必须恰好 5 行；每行是一个完整、合法、单行 JSON 对象。
2. 不要输出 Markdown 代码块、解释、标题、空行或数组外壳。
3. 每个 JSON 对象必须且只能包含以下字段：
{"shotNumber":"01","visualDescription":"画面描述","characterAction":"人物动作","dialogueOrNarration":"台词或旁白","shotType":"镜头类型","visualPrompt":"画面提示词"}
4. shotNumber 按 01、02、03、04、05 排列。
5. 所有字段必须是非空字符串；字符串中的换行必须转义，不能真正换行。
6. 画面提示词应可直接用于图像生成，包含主体、环境、构图、光线、色彩、质感与横屏 16:9。
7. 五个镜头要有清晰的起承转合，并忠于用户剧本，不凭空改写核心人物关系。
8. 先在内部确定主要人物固定的年龄、脸型、发型、服装、体态与辨识特征，并在每一条涉及该人物的 visualPrompt 中完整重复这些特征，确保五张独立生成的图片尽量保持人物一致；不得使用“同上”“保持一致”等依赖上下文的表达。`;

  const user = `短剧主题：${theme}

剧本：
${script}

风格偏好：${style}

现在严格按协议输出 5 行 NDJSON。`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

function normalizeShot(value, expectedNumber) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new StoryboardError(
      "INVALID_MODEL_OUTPUT",
      "模型返回的分镜格式不完整，请重试。",
      502,
      true,
    );
  }

  const shot = {};
  for (const field of SHOT_FIELDS) {
    if (typeof value[field] !== "string" || !value[field].trim()) {
      throw new StoryboardError(
        "INVALID_MODEL_OUTPUT",
        "模型返回的分镜缺少必要字段，请重试。",
        502,
        true,
      );
    }
    shot[field] = value[field].trim().slice(0, 2_000);
  }

  shot.shotNumber = String(expectedNumber).padStart(2, "0");
  return shot;
}

function validateImageShot(value) {
  const shotNumber =
    typeof value?.shotNumber === "string" ? value.shotNumber.trim() : "";
  const numericShot = Number.parseInt(shotNumber, 10);
  if (
    !Number.isInteger(numericShot) ||
    numericShot < 1 ||
    numericShot > 5
  ) {
    throw new StoryboardError(
      "INVALID_SHOT_NUMBER",
      "图片生成请求缺少有效的镜头编号。",
      400,
      false,
    );
  }
  return normalizeShot(value, numericShot);
}

export function validateImageGenerationInput(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new StoryboardError(
      "INVALID_IMAGE_INPUT",
      "图片生成请求格式不正确。",
      400,
      false,
    );
  }

  const theme = typeof value.theme === "string" ? value.theme.trim() : "";
  const style = typeof value.style === "string" ? value.style.trim() : "";
  const seed = Number(value.seed);

  if (!theme || theme.length > 80) {
    throw new StoryboardError(
      "INVALID_IMAGE_THEME",
      "图片生成请求中的短剧主题无效。",
      400,
      false,
    );
  }
  if (style.length > 400) {
    throw new StoryboardError(
      "INVALID_IMAGE_STYLE",
      "图片生成请求中的风格偏好过长。",
      400,
      false,
    );
  }
  if (
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed > 2_147_483_647
  ) {
    throw new StoryboardError(
      "INVALID_IMAGE_SEED",
      "图片生成请求中的随机种子无效。",
      400,
      false,
    );
  }

  return {
    theme,
    style: style || DEFAULT_STYLE,
    seed,
    shot: validateImageShot(value.shot),
  };
}

export function buildImagePrompt({ theme, style, shot }) {
  const prompt = [
    "为短剧分镜生成一张可直接用于拍摄参考的横屏画面。",
    `短剧主题：${theme}`,
    `整体风格：${style}`,
    `镜头编号：${shot.shotNumber}`,
    `核心画面：${shot.visualPrompt}`,
    `画面描述：${shot.visualDescription}`,
    `人物动作：${shot.characterAction}`,
    `镜头语言：${shot.shotType}`,
    "严格保持提示词中人物的年龄、脸型、发型、服装、体态和辨识特征。",
    "横屏 16:9 电影分镜构图，电影级光影，主体清晰，画面完整。",
    "画面中不得出现字幕、台词、旁白、界面文字、边框、Logo 或水印。",
  ].join("\n");

  return prompt.slice(0, MAX_IMAGE_PROMPT_CHARS);
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function signDownloadPayload(encodedPayload, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(encodedPayload),
    ),
  );
}

export async function createDownloadToken(
  imageUrl,
  shotNumber,
  secret,
  now = Date.now(),
) {
  const payload = {
    url: imageUrl,
    shotNumber,
    exp: now + DOWNLOAD_TOKEN_TTL_MS,
  };
  const encodedPayload = bytesToBase64Url(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const signature = bytesToBase64Url(
    await signDownloadPayload(encodedPayload, secret),
  );
  return `${encodedPayload}.${signature}`;
}

export async function verifyDownloadToken(
  token,
  secret,
  now = Date.now(),
) {
  if (typeof token !== "string" || token.length > 8_000) {
    throw new StoryboardError(
      "INVALID_DOWNLOAD_TOKEN",
      "图片下载凭证无效。",
      403,
      false,
    );
  }

  const [encodedPayload, providedSignature, extra] = token.split(".");
  if (!encodedPayload || !providedSignature || extra) {
    throw new StoryboardError(
      "INVALID_DOWNLOAD_TOKEN",
      "图片下载凭证无效。",
      403,
      false,
    );
  }

  const expectedSignature = bytesToBase64Url(
    await signDownloadPayload(encodedPayload, secret),
  );
  if (providedSignature !== expectedSignature) {
    throw new StoryboardError(
      "INVALID_DOWNLOAD_TOKEN",
      "图片下载凭证无效或已被修改。",
      403,
      false,
    );
  }

  let payload;
  try {
    payload = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(encodedPayload)),
    );
  } catch {
    throw new StoryboardError(
      "INVALID_DOWNLOAD_TOKEN",
      "图片下载凭证无法解析。",
      403,
      false,
    );
  }

  if (
    typeof payload?.url !== "string" ||
    !Number.isFinite(payload?.exp) ||
    payload.exp <= now ||
    !/^0[1-5]$/.test(payload?.shotNumber || "")
  ) {
    throw new StoryboardError(
      "DOWNLOAD_TOKEN_EXPIRED",
      "图片下载凭证已过期，请重新生成图片。",
      410,
      false,
    );
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(payload.url);
  } catch {
    throw new StoryboardError(
      "INVALID_DOWNLOAD_URL",
      "图片下载地址无效。",
      403,
      false,
    );
  }
  if (parsedUrl.protocol !== "https:") {
    throw new StoryboardError(
      "INVALID_DOWNLOAD_URL",
      "图片下载地址不安全。",
      403,
      false,
    );
  }

  return payload;
}

export class NdjsonShotParser {
  constructor(onShot) {
    this.buffer = "";
    this.shots = [];
    this.onShot = onShot;
  }

  push(delta) {
    this.buffer += delta;
    let newlineIndex = this.buffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);
      this.consumeLine(line);
      newlineIndex = this.buffer.indexOf("\n");
    }
  }

  finish() {
    if (this.buffer.trim()) {
      this.consumeLine(this.buffer);
      this.buffer = "";
    }

    if (this.shots.length !== 5) {
      throw new StoryboardError(
        "INCOMPLETE_MODEL_OUTPUT",
        `模型只生成了 ${this.shots.length} 条有效分镜，请重试。`,
        502,
        true,
      );
    }
    return this.shots;
  }

  consumeLine(rawLine) {
    const line = rawLine.trim();
    if (!line || line === "```" || line.toLowerCase() === "```json") {
      return;
    }
    if (this.shots.length >= 5) {
      throw new StoryboardError(
        "INVALID_MODEL_OUTPUT",
        "模型返回了多余的分镜内容，请重试。",
        502,
        true,
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw new StoryboardError(
        "INVALID_MODEL_OUTPUT",
        "模型返回的分镜无法解析，请重试。",
        502,
        true,
      );
    }

    const shot = normalizeShot(parsed, this.shots.length + 1);
    this.shots.push(shot);
    this.onShot?.(shot, this.shots.length);
  }
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function sanitizeProviderText(value, maxLength = 240) {
  if (typeof value !== "string") return "";
  return value
    .replace(/sk-[A-Za-z0-9._-]+/gi, "[已隐藏密钥]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

async function readUpstreamError(upstream) {
  try {
    const payload = await upstream.json();
    return {
      providerCode: sanitizeProviderText(payload?.code, 80),
      providerMessage: sanitizeProviderText(payload?.message),
      requestId: sanitizeProviderText(
        payload?.request_id || payload?.requestId,
        100,
      ),
    };
  } catch {
    return {};
  }
}

function mapUpstreamError(status, provider = {}) {
  const providerSuffix = provider.providerMessage
    ? ` 百炼返回：${provider.providerMessage}`
    : "";
  if (status === 401 || status === 403) {
    const error = new StoryboardError(
      "BAILIAN_AUTH_ERROR",
      `百炼 API Key 无效或没有模型调用权限。${providerSuffix}`,
      502,
      false,
    );
    Object.assign(error, provider);
    return error;
  }
  if (status === 429) {
    const error = new StoryboardError(
      "RATE_LIMITED",
      `百炼请求过于频繁，请稍后重试。${providerSuffix}`,
      429,
      true,
    );
    Object.assign(error, provider);
    return error;
  }
  if (status >= 500) {
    const error = new StoryboardError(
      "BAILIAN_UNAVAILABLE",
      `百炼服务暂时不可用，请稍后重试。${providerSuffix}`,
      503,
      true,
    );
    Object.assign(error, provider);
    return error;
  }
  const error = new StoryboardError(
    "BAILIAN_REQUEST_FAILED",
    `百炼拒绝了本次请求，请检查服务配置。${providerSuffix}`,
    502,
    true,
  );
  Object.assign(error, provider);
  return error;
}

function parseImageSize(size) {
  const match = /^(\d+)\*(\d+)$/.exec(size);
  if (!match) return { width: 2688, height: 1536 };
  return { width: Number(match[1]), height: Number(match[2]) };
}

export async function generateStoryboardImage(
  rawInput,
  env = {},
  fetchImpl = fetch,
  signal,
) {
  const input = validateImageGenerationInput(rawInput);
  const apiKey = env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new StoryboardError(
      "API_KEY_MISSING",
      "服务端尚未配置 DASHSCOPE_API_KEY。",
      500,
      false,
    );
  }

  const model = env.DASHSCOPE_IMAGE_MODEL || DEFAULT_IMAGE_MODEL;
  const endpoint =
    env.DASHSCOPE_IMAGE_ENDPOINT || DEFAULT_IMAGE_ENDPOINT;
  const size = env.DASHSCOPE_IMAGE_SIZE || DEFAULT_IMAGE_SIZE;
  const prompt = buildImagePrompt(input);
  let upstream;
  try {
    upstream = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: {
          messages: [
            {
              role: "user",
              content: [{ text: prompt }],
            },
          ],
        },
        parameters: {
          n: 1,
          size,
          seed: input.seed,
          prompt_extend: false,
          watermark: false,
          negative_prompt:
            "低分辨率，低画质，人物身份变化，服装变化，脸部不一致，肢体畸形，手指畸形，模糊，过度光滑，AI感，构图混乱，字幕，台词，文字，Logo，水印，边框。",
        },
      }),
      signal,
    });
  } catch (error) {
    if (signal?.aborted || error?.name === "AbortError") {
      throw new StoryboardError(
        "IMAGE_REQUEST_CANCELLED",
        "图片生成已停止。",
        499,
        false,
      );
    }
    throw new StoryboardError(
      "IMAGE_NETWORK_ERROR",
      "连接百炼图片服务失败，请检查网络后重试。",
      502,
      true,
    );
  }

  if (!upstream.ok) {
    const provider = await readUpstreamError(upstream);
    const error = mapUpstreamError(upstream.status, provider);
    const retryAfter = Number(upstream.headers.get("retry-after") || 0);
    if (retryAfter > 0) error.retryAfterMs = retryAfter * 1_000;
    throw error;
  }

  let payload;
  try {
    payload = await upstream.json();
  } catch {
    throw new StoryboardError(
      "INVALID_IMAGE_RESPONSE",
      "图片模型返回了无法解析的结果。",
      502,
      true,
    );
  }

  const content = payload?.output?.choices?.[0]?.message?.content;
  const imageUrl = Array.isArray(content)
    ? content.find((item) => typeof item?.image === "string")?.image
    : "";
  let parsedUrl;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    throw new StoryboardError(
      "INVALID_IMAGE_RESPONSE",
      "图片模型没有返回有效图片。",
      502,
      true,
    );
  }
  if (parsedUrl.protocol !== "https:") {
    throw new StoryboardError(
      "INVALID_IMAGE_RESPONSE",
      "图片模型返回了不安全的图片地址。",
      502,
      false,
    );
  }

  const downloadToken = await createDownloadToken(
    imageUrl,
    input.shot.shotNumber,
    apiKey,
  );
  const dimensions = parseImageSize(size);
  return {
    shotNumber: input.shot.shotNumber,
    imageUrl,
    downloadToken,
    model,
    ...dimensions,
  };
}

async function downloadStoryboardImage(
  token,
  env = {},
  fetchImpl = fetch,
) {
  const apiKey = env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new StoryboardError(
      "API_KEY_MISSING",
      "服务端尚未配置 DASHSCOPE_API_KEY。",
      500,
      false,
    );
  }
  const payload = await verifyDownloadToken(token, apiKey);
  const upstream = await fetchImpl(payload.url, {
    headers: { accept: "image/png,image/*" },
  });
  if (!upstream.ok) {
    throw new StoryboardError(
      "IMAGE_DOWNLOAD_FAILED",
      "图片临时地址已失效，请重新生成后再下载。",
      502,
      true,
    );
  }

  const contentType = upstream.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("image/")) {
    throw new StoryboardError(
      "INVALID_IMAGE_DOWNLOAD",
      "下载地址没有返回有效图片。",
      502,
      false,
    );
  }

  const bytes = await upstream.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new StoryboardError(
      "IMAGE_DOWNLOAD_TOO_LARGE",
      "图片文件为空或超过下载大小限制。",
      502,
      false,
    );
  }

  return new Response(bytes, {
    status: 200,
    headers: {
      "content-type": contentType,
      "content-length": String(bytes.byteLength),
      "content-disposition": `attachment; filename="storyboard-${payload.shotNumber}.png"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

async function readRequestJson(request) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_REQUEST_BYTES) {
    throw new StoryboardError(
      "REQUEST_TOO_LARGE",
      "提交的内容过长。",
      413,
      false,
    );
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BYTES) {
    throw new StoryboardError(
      "REQUEST_TOO_LARGE",
      "提交的内容过长。",
      413,
      false,
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new StoryboardError(
      "INVALID_JSON",
      "请求内容不是有效的 JSON。",
      400,
      false,
    );
  }
}

function encodeSse(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function consumeOpenAiStream(body, onDelta) {
  if (!body) {
    throw new StoryboardError(
      "EMPTY_UPSTREAM_STREAM",
      "百炼没有返回可读取的内容。",
      502,
      true,
    );
  }

  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const lines = buffer.split(/\r?\n/);
    buffer = done ? "" : lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;

      let event;
      try {
        event = JSON.parse(payload);
      } catch {
        continue;
      }

      const delta = event?.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta) {
        onDelta(delta);
      }
    }

    if (done) break;
  }
}

function storyboardErrorResponse(error, fallbackMessage = "无法处理本次请求。") {
  const known =
    error instanceof StoryboardError
      ? error
      : new StoryboardError(
          "INVALID_REQUEST",
          fallbackMessage,
          400,
          false,
        );
  return jsonResponse(
    {
      code: known.code,
      message: known.message,
      retryable: known.retryable,
      ...(known.retryAfterMs ? { retryAfterMs: known.retryAfterMs } : {}),
      ...(known.providerCode ? { providerCode: known.providerCode } : {}),
      ...(known.requestId ? { requestId: known.requestId } : {}),
    },
    known.status,
  );
}

export async function handleStoryboardsRequest(
  request,
  env = {},
  fetchImpl = fetch,
) {
  if (request.method !== "POST") {
    return jsonResponse(
      {
        code: "METHOD_NOT_ALLOWED",
        message: "仅支持 POST 请求。",
        retryable: false,
      },
      405,
    );
  }

  const apiKey = env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    return jsonResponse(
      {
        code: "API_KEY_MISSING",
        message: "服务端尚未配置 DASHSCOPE_API_KEY。",
        retryable: false,
      },
      500,
    );
  }

  let rawInput;
  try {
    rawInput = await readRequestJson(request);
  } catch (error) {
    return storyboardErrorResponse(error);
  }

  if (rawInput?.action === "generateImage") {
    try {
      return jsonResponse(
        await generateStoryboardImage(
          rawInput,
          env,
          fetchImpl,
          request.signal,
        ),
      );
    } catch (error) {
      return storyboardErrorResponse(error, "图片生成请求失败。");
    }
  }

  if (rawInput?.action === "downloadImage") {
    try {
      return await downloadStoryboardImage(
        rawInput.token,
        env,
        fetchImpl,
      );
    } catch (error) {
      return storyboardErrorResponse(error, "图片下载请求失败。");
    }
  }

  if (rawInput?.action) {
    return jsonResponse(
      {
        code: "UNKNOWN_ACTION",
        message: "不支持该操作。",
        retryable: false,
      },
      400,
    );
  }

  let input;
  try {
    input = validateStoryboardInput(rawInput);
  } catch (error) {
    return storyboardErrorResponse(error);
  }

  const model = env.DASHSCOPE_MODEL || DEFAULT_MODEL;
  const baseUrl = (env.DASHSCOPE_BASE_URL || DEFAULT_BASE_URL).replace(
    /\/+$/,
    "",
  );
  const encoder = new TextEncoder();
  const upstreamAbort = new AbortController();
  const abortUpstream = () => upstreamAbort.abort();
  request.signal?.addEventListener("abort", abortUpstream, { once: true });

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event, data) => {
        if (!closed) controller.enqueue(encoder.encode(encodeSse(event, data)));
      };
      const close = () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      };

      try {
        send("status", {
          phase: "connecting",
          message: "正在连接百炼",
          current: 0,
          total: 5,
          model,
        });

        const upstream = await fetchImpl(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model,
            stream: true,
            enable_thinking: false,
            temperature: 0.75,
            max_tokens: 3_500,
            messages: buildStoryboardMessages(input),
          }),
          signal: upstreamAbort.signal,
        });

        if (!upstream.ok) throw mapUpstreamError(upstream.status);

        send("status", {
          phase: "calling",
          message: `正在调用 ${model}`,
          current: 1,
          total: 5,
          model,
        });

        const parser = new NdjsonShotParser((shot, count) => {
          send("shot", shot);
          send("status", {
            phase: count === 5 ? "finalizing" : "generating",
            message:
              count === 5
                ? "正在整理分镜"
                : `正在生成第 ${count + 1} / 5 个镜头`,
            current: Math.min(count + 1, 5),
            total: 5,
            model,
          });
        });

        await consumeOpenAiStream(upstream.body, (delta) => parser.push(delta));
        const shots = parser.finish();
        send("done", {
          shots,
          message: "5 条分镜生成完成",
          model,
        });
        close();
      } catch (error) {
        if (upstreamAbort.signal.aborted || request.signal?.aborted) {
          close();
          return;
        }

        const known =
          error instanceof StoryboardError
            ? error
            : new StoryboardError(
                "NETWORK_ERROR",
                "连接百炼时发生网络错误，请重试。",
                502,
                true,
              );
        send("error", {
          code: known.code,
          message: known.message,
          retryable: known.retryable,
        });
        close();
      } finally {
        request.signal?.removeEventListener("abort", abortUpstream);
      }
    },
    cancel() {
      upstreamAbort.abort();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-store",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
