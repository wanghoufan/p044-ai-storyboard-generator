import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowsClockwise,
  CheckCircle,
  Copy,
  DownloadSimple,
  FilmSlate,
  HourglassMedium,
  ImageSquare,
  Lightning,
  MagnifyingGlassPlus,
  SpinnerGap,
  Stop,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import {
  copyText,
  formatAllShotsForClipboard,
  formatShotForClipboard,
  readEventStream,
} from "./storyboard-utils.js";

const DEFAULT_FORM = {
  theme: "",
  script: "",
  style: "",
};

const STYLE_PRESETS = [
  "爱情",
  "科幻",
  "悬疑",
  "喜剧",
  "都市",
  "古装",
  "奇幻",
  "动作",
  "现实主义",
  "治愈",
];

const DEMO_FORM = {
  theme: "逆袭归来：外卖员的百万人生",
  script:
    "外卖员林浩在雨夜被前女友嘲笑。一次送餐让他意外结识投资人，并凭借敏锐洞察抓住创业机会。曾经嘲笑他的人再次出现时，他已经站在新的起点。",
  style: "现实励志，冷色调，节奏紧凑，横屏 16:9",
};

const DEMO_SHOTS = [
  {
    shotNumber: "01",
    visualDescription:
      "雨夜街道，林浩骑着电动车穿过车流，路面反射冷蓝霓虹。",
    characterAction: "林浩低头骑行，握紧车把，加快速度。",
    dialogueOrNarration: "旁白：生活不易，但我从未放弃。",
    shotType: "大全景 / 跟拍",
    visualPrompt:
      "28岁亚洲男性，短黑发，清瘦脸型，蓝色外卖服，雨夜城市街道，冷蓝霓虹，写实电影感，横屏 16:9",
  },
  {
    shotNumber: "02",
    visualDescription:
      "豪车驶过溅起大片水花，林浩停在路边，雨水顺着脸颊落下。",
    characterAction: "林浩抹去脸上的雨水，短暂沉默后继续前行。",
    dialogueOrNarration: "前女友：你看看你，送外卖能有什么出息？",
    shotType: "中景 / 侧面",
    visualPrompt:
      "28岁亚洲男性，短黑发，清瘦脸型，蓝色外卖服，豪车溅水，雨夜，强烈明暗对比，真实质感，横屏 16:9",
  },
  ...[3, 4, 5].map((number) => ({
    shotNumber: String(number).padStart(2, "0"),
    visualDescription: "故事冲突继续推进，人物处于关键情节之中。",
    characterAction: "人物以明确动作回应当前冲突。",
    dialogueOrNarration: "旁白：机会总会留给没有放弃的人。",
    shotType: "中近景 / 稳定器",
    visualPrompt:
      "28岁亚洲男性，短黑发，清瘦脸型，蓝色外卖服，写实电影感，清晰主体，横屏 16:9",
  })),
];

const DEMO_IMAGE_STATES = {
  "01": {
    status: "success",
    shotNumber: "01",
    imageUrl: "/demo-storyboard-frame-wide.png",
    model: "qwen-image-2.0-pro-2026-06-22",
    width: 2688,
    height: 1536,
  },
  "02": {
    status: "error",
    message: "图片生成暂时失败，可在队列完成后单独重试。",
  },
  "03": {
    status: "generating",
    message: "正在调用 qwen-image，3 / 5",
  },
  "04": { status: "queued", message: "已加入图片生成队列" },
  "05": { status: "queued", message: "已加入图片生成队列" },
};

const DETAIL_FIELDS = [
  ["画面描述", "visualDescription", "wide"],
  ["人物动作", "characterAction"],
  ["台词或旁白", "dialogueOrNarration"],
  ["镜头类型", "shotType"],
  ["画面提示词", "visualPrompt", "wide prompt"],
];

const TEXT_PHASES = new Set([
  "connecting",
  "calling",
  "generating",
  "finalizing",
]);
const IMAGE_PHASES = new Set([
  "image_queue",
  "image_waiting",
  "image_generating",
]);
const IMAGE_INTERVAL_MS = 30_000;

function getDemoMode() {
  return (
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("demo") === "streaming"
  );
}

function SkeletonLines({ wide = false }) {
  return (
    <span className={`skeleton-lines${wide ? " skeleton-lines--wide" : ""}`}>
      <span />
      <span />
      <span />
    </span>
  );
}

function StatusIndicator({ phase, message }) {
  const complete = phase === "complete";
  const error = phase === "error";
  return (
    <div className={`status-indicator status-indicator--${phase}`}>
      <span className="status-icon" aria-hidden="true">
        {complete ? (
          <CheckCircle weight="fill" size={18} />
        ) : error ? (
          <WarningCircle weight="fill" size={18} />
        ) : (
          <SpinnerGap className={phase !== "idle" ? "spin" : ""} size={18} />
        )}
      </span>
      <span>{message}</span>
    </div>
  );
}

function ImageStage({
  number,
  shot,
  imageState,
  onPreview,
  onDownload,
  onRetry,
  disabled,
}) {
  const status = imageState?.status || (shot ? "waiting" : "waiting_text");

  if (status === "success") {
    return (
      <div className="story-image-wrap">
        <button
          type="button"
          className="story-image-button"
          onClick={() => onPreview(imageState)}
          aria-label={`放大镜头 ${number} 图片`}
        >
          <img
            src={imageState.imageUrl}
            alt={`镜头 ${number} 生成画面`}
            loading="lazy"
          />
          <span className="image-zoom">
            <MagnifyingGlassPlus size={18} />
            放大
          </span>
        </button>
        <div className="image-actions">
          <button
            type="button"
            onClick={() => onDownload(imageState)}
            aria-label={`下载镜头 ${number} 图片`}
          >
            <DownloadSimple size={17} />
            下载
          </button>
          <button
            type="button"
            onClick={() => onRetry(shot)}
            disabled={disabled}
            aria-label={`重新生成镜头 ${number} 图片`}
          >
            <ArrowsClockwise size={17} />
            重生成
          </button>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="image-placeholder image-placeholder--error">
        <WarningCircle weight="fill" size={28} />
        <strong>图片生成失败</strong>
        <p>{imageState.message}</p>
        <button
          type="button"
          className="image-retry-button"
          onClick={() => onRetry(shot)}
          disabled={disabled}
        >
          <ArrowsClockwise size={17} />
          重新生成
        </button>
      </div>
    );
  }

  const generating = status === "generating" || status === "retrying";
  const waiting = status === "queued" || status === "waiting_rate";

  return (
    <div
      className={`image-placeholder${
        generating ? " image-placeholder--generating" : ""
      }`}
    >
      <span className="image-placeholder-icon">
        {generating ? (
          <SpinnerGap className="spin" size={30} />
        ) : waiting ? (
          <HourglassMedium size={29} />
        ) : (
          <ImageSquare size={30} />
        )}
      </span>
      <strong>
        {generating
          ? "正在生成画面"
          : waiting
            ? "等待图片队列"
            : shot
              ? "等待生成图片"
              : "等待文字分镜"}
      </strong>
      <p>
        {imageState?.message ||
          (shot ? "文字完成后将自动生成 16:9 画面" : "分镜生成后显示画面")}
      </p>
      {generating && <span className="image-scan-line" />}
    </div>
  );
}

function StoryboardCard({
  number,
  shot,
  imageState,
  activeText,
  onCopy,
  copied,
  onPreview,
  onDownload,
  onRetry,
  disabled,
}) {
  const numberLabel = String(number).padStart(2, "0");
  return (
    <article
      className={`storyboard-card${activeText ? " is-active" : ""}${
        shot ? " has-text" : ""
      }${imageState?.status === "success" ? " has-image" : ""}`}
      aria-label={`镜头 ${numberLabel}`}
    >
      <div className="storyboard-copy">
        <header className="card-heading">
          <div>
            <span className="card-kicker">STORYBOARD FRAME {numberLabel}</span>
            <h3>{shot ? shot.shotType : "镜头内容生成中"}</h3>
          </div>
          <button
            type="button"
            className="icon-button card-copy-button"
            aria-label={
              copied
                ? `镜头 ${numberLabel} 已复制`
                : `复制镜头 ${numberLabel}`
            }
            onClick={() => shot && onCopy(shot)}
            disabled={!shot}
          >
            {copied ? (
              <CheckCircle weight="fill" size={19} />
            ) : (
              <Copy size={19} />
            )}
          </button>
        </header>

        <div className="detail-grid">
          {shot
            ? DETAIL_FIELDS.map(([label, key, modifier]) => (
                <section
                  className={`detail-item${
                    modifier ? ` detail-item--${modifier.replace(" ", " detail-item--")}` : ""
                  }`}
                  key={key}
                >
                  <span>{label}</span>
                  <p>{shot[key]}</p>
                </section>
              ))
            : DETAIL_FIELDS.map(([label, key, modifier]) => (
                <section
                  className={`detail-item${
                    modifier ? ` detail-item--${modifier.replace(" ", " detail-item--")}` : ""
                  }`}
                  key={key}
                >
                  <span>{label}</span>
                  <SkeletonLines wide={key === "visualPrompt"} />
                </section>
              ))}
        </div>
      </div>

      <div className="storyboard-visual">
        <div className="visual-number">
          <span>SHOT</span>
          <strong>{numberLabel}</strong>
        </div>
        <ImageStage
          number={numberLabel}
          shot={shot}
          imageState={imageState}
          onPreview={onPreview}
          onDownload={onDownload}
          onRetry={onRetry}
          disabled={disabled}
        />
      </div>

      {activeText && (
        <div className="card-stream-state">
          <span>文字生成中</span>
          <span className="stream-bar" />
        </div>
      )}
    </article>
  );
}

function abortableDelay(milliseconds, signal) {
  if (milliseconds <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, milliseconds);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function readJsonResponse(response) {
  let payload = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  if (!response.ok) {
    const error = new Error(payload.message || "请求失败，请稍后重试。");
    error.code = payload.code;
    error.retryable = payload.retryable;
    error.retryAfterMs = payload.retryAfterMs;
    throw error;
  }
  return payload;
}

function createSeed() {
  const values = new Uint32Array(1);
  window.crypto.getRandomValues(values);
  return values[0] % 2_147_483_648;
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function App() {
  const demoMode = useMemo(getDemoMode, []);
  const [form, setForm] = useState(demoMode ? DEMO_FORM : DEFAULT_FORM);
  const [selectedStyles, setSelectedStyles] = useState([]);
  const [shots, setShots] = useState(demoMode ? DEMO_SHOTS : []);
  const [imageStates, setImageStates] = useState(
    demoMode ? DEMO_IMAGE_STATES : {},
  );
  const [phase, setPhase] = useState(
    demoMode ? "image_generating" : "idle",
  );
  const [statusMessage, setStatusMessage] = useState(
    demoMode ? "正在生成第 3 / 5 张图片" : "等待开始",
  );
  const [current, setCurrent] = useState(demoMode ? 3 : 0);
  const [isGenerating, setIsGenerating] = useState(demoMode);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [error, setError] = useState("");
  const [copiedKey, setCopiedKey] = useState("");
  const [lightbox, setLightbox] = useState(null);
  const [imageSeed, setImageSeed] = useState(0);
  const abortRef = useRef(null);
  const lastContextRef = useRef(null);

  const canSubmit = form.theme.trim() && form.script.trim();
  const completedImages = Object.values(imageStates).filter(
    (item) => item.status === "success",
  );
  const finishedImages = Object.values(imageStates).filter((item) =>
    ["success", "error"].includes(item.status),
  ).length;
  const progress =
    phase === "complete"
      ? 100
      : IMAGE_PHASES.has(phase)
        ? Math.min(99, 35 + finishedImages * 13)
        : phase === "idle"
          ? 0
          : phase === "cancelled"
            ? Math.min(99, 35 + finishedImages * 13)
            : Math.min(35, Math.max(4, ((Math.max(current, 1) - 0.35) / 5) * 35));

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  function updateForm(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function toggleStyle(style) {
    setSelectedStyles((previous) =>
      previous.includes(style)
        ? previous.filter((item) => item !== style)
        : [...previous, style],
    );
  }

  function stopGeneration() {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsGenerating(false);
    setPhase("cancelled");
    setStatusMessage("已停止生成，已完成内容会继续保留");
  }

  async function requestImage(shot, context, seed, signal, allowRetry = true) {
    const response = await fetch("/api/storyboards", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "generateImage",
        theme: context.theme,
        style: context.style,
        shot,
        seed,
      }),
      signal,
    });
    try {
      return await readJsonResponse(response);
    } catch (requestError) {
      if (
        allowRetry &&
        requestError.code === "RATE_LIMITED" &&
        !signal.aborted
      ) {
        const waitMs = Math.max(
          30_000,
          Number(requestError.retryAfterMs) || 0,
        );
        setImageStates((previous) => ({
          ...previous,
          [shot.shotNumber]: {
            ...previous[shot.shotNumber],
            status: "waiting_rate",
            message: "触发平台限流，等待后自动重试一次",
          },
        }));
        setPhase("image_waiting");
        setStatusMessage(`镜头 ${shot.shotNumber} 触发限流，等待重试`);
        await abortableDelay(waitMs, signal);
        return requestImage(shot, context, seed, signal, false);
      }
      throw requestError;
    }
  }

  async function runImageQueue(nextShots, context, seed, controller) {
    setImageStates(
      Object.fromEntries(
        nextShots.map((shot) => [
          shot.shotNumber,
          { status: "queued", message: "已加入图片生成队列" },
        ]),
      ),
    );
    setPhase("image_queue");
    setCurrent(1);
    setStatusMessage("文字分镜完成，准备生成 5 张画面");

    let lastStartedAt = 0;
    let successCount = 0;
    let failureCount = 0;

    for (let index = 0; index < nextShots.length; index += 1) {
      const shot = nextShots[index];
      const waitMs = Math.max(
        0,
        IMAGE_INTERVAL_MS - (Date.now() - lastStartedAt),
      );
      if (waitMs > 0) {
        setPhase("image_waiting");
        setCurrent(index + 1);
        setStatusMessage(`等待平台额度，下一张将在稍后生成`);
        setImageStates((previous) => ({
          ...previous,
          [shot.shotNumber]: {
            ...previous[shot.shotNumber],
            status: "waiting_rate",
            message: "正在遵守百炼 2 RPM 调用限制",
          },
        }));
        await abortableDelay(waitMs, controller.signal);
      }

      lastStartedAt = Date.now();
      setPhase("image_generating");
      setCurrent(index + 1);
      setStatusMessage(`正在生成第 ${index + 1} / 5 张图片`);
      setImageStates((previous) => ({
        ...previous,
        [shot.shotNumber]: {
          status: "generating",
          message: `正在调用 qwen-image，${index + 1} / 5`,
        },
      }));

      try {
        const image = await requestImage(
          shot,
          context,
          seed,
          controller.signal,
        );
        successCount += 1;
        setImageStates((previous) => ({
          ...previous,
          [shot.shotNumber]: { status: "success", ...image },
        }));
      } catch (imageError) {
        if (controller.signal.aborted || imageError.name === "AbortError") {
          throw imageError;
        }
        failureCount += 1;
        setImageStates((previous) => ({
          ...previous,
          [shot.shotNumber]: {
            status: "error",
            message: imageError.message || "图片生成失败，请单独重试。",
            code: imageError.code,
          },
        }));
      }
    }

    setPhase("complete");
    setCurrent(5);
    setStatusMessage(
      failureCount
        ? `已生成 ${successCount} / 5 张图片，失败镜头可单独重试`
        : "5 条图文分镜生成完成",
    );
  }

  async function handleGenerate(event) {
    event.preventDefault();
    if (!canSubmit || isGenerating) return;

    const style = [...selectedStyles, form.style.trim()]
      .filter(Boolean)
      .join("；")
      .slice(0, 400);
    const submitted = { ...form, style };
    const seed = createSeed();
    const abortController = new AbortController();
    abortRef.current = abortController;
    lastContextRef.current = submitted;
    setImageSeed(seed);
    setShots([]);
    setImageStates({});
    setError("");
    setCopiedKey("");
    setIsGenerating(true);
    setPhase("connecting");
    setCurrent(0);
    setStatusMessage("正在连接百炼");

    let receivedDone = false;
    let receivedError = false;
    let completedShots = [];

    try {
      const response = await fetch("/api/storyboards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(submitted),
        signal: abortController.signal,
      });

      await readEventStream(response, (eventName, payload) => {
        if (eventName === "status") {
          setPhase(payload.phase);
          setStatusMessage(payload.message);
          setCurrent(payload.current || 0);
        }
        if (eventName === "shot") {
          setShots((previous) => {
            const next = previous.filter(
              (shot) => shot.shotNumber !== payload.shotNumber,
            );
            return [...next, payload].sort((a, b) =>
              a.shotNumber.localeCompare(b.shotNumber),
            );
          });
        }
        if (eventName === "done") {
          receivedDone = true;
          completedShots = payload.shots;
          setShots(payload.shots);
          setCurrent(5);
          setStatusMessage("文字分镜生成完成");
        }
        if (eventName === "error") {
          receivedError = true;
          setPhase("error");
          setStatusMessage("文字分镜生成遇到问题");
          setError(payload.message);
        }
      });

      if (!receivedDone && !receivedError && !abortController.signal.aborted) {
        throw new Error("流式连接提前结束，请重试。");
      }
      if (receivedDone && !abortController.signal.aborted) {
        await runImageQueue(
          completedShots,
          submitted,
          seed,
          abortController,
        );
      }
    } catch (requestError) {
      if (requestError.name !== "AbortError") {
        setPhase("error");
        setStatusMessage("生成遇到问题");
        setError(requestError.message || "生成失败，请重试。");
      }
    } finally {
      if (abortRef.current === abortController) abortRef.current = null;
      setIsGenerating(false);
    }
  }

  async function handleRetryImage(shot) {
    if (isGenerating || !lastContextRef.current) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setIsGenerating(true);
    setError("");
    setPhase("image_generating");
    setStatusMessage(`正在重新生成镜头 ${shot.shotNumber} 图片`);
    setImageStates((previous) => ({
      ...previous,
      [shot.shotNumber]: {
        ...previous[shot.shotNumber],
        status: "retrying",
        message: "正在重新调用图片模型",
      },
    }));

    try {
      const image = await requestImage(
        shot,
        lastContextRef.current,
        imageSeed || createSeed(),
        controller.signal,
      );
      setImageStates((previous) => ({
        ...previous,
        [shot.shotNumber]: { status: "success", ...image },
      }));
      setPhase("complete");
      setStatusMessage(`镜头 ${shot.shotNumber} 图片已重新生成`);
    } catch (retryError) {
      if (retryError.name !== "AbortError") {
        setImageStates((previous) => ({
          ...previous,
          [shot.shotNumber]: {
            status: "error",
            message: retryError.message || "图片重新生成失败。",
          },
        }));
        setPhase("complete");
        setStatusMessage(`镜头 ${shot.shotNumber} 图片生成失败`);
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsGenerating(false);
    }
  }

  async function handleCopyShot(shot) {
    await copyText(formatShotForClipboard(shot));
    setCopiedKey(shot.shotNumber);
    window.setTimeout(() => setCopiedKey(""), 1_600);
  }

  async function handleCopyAll() {
    if (!shots.length) return;
    await copyText(formatAllShotsForClipboard(shots));
    setCopiedKey("all");
    window.setTimeout(() => setCopiedKey(""), 1_600);
  }

  async function downloadImage(imageState) {
    if (!imageState.downloadToken && imageState.imageUrl.startsWith("/")) {
      const localResponse = await fetch(imageState.imageUrl);
      if (!localResponse.ok) throw new Error("测试图片下载失败。");
      triggerBlobDownload(
        await localResponse.blob(),
        `storyboard-${imageState.shotNumber}.png`,
      );
      return;
    }
    const response = await fetch("/api/storyboards", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "downloadImage",
        token: imageState.downloadToken,
      }),
    });
    if (!response.ok) {
      const payload = await readJsonResponse(response);
      throw new Error(payload.message);
    }
    const blob = await response.blob();
    triggerBlobDownload(blob, `storyboard-${imageState.shotNumber}.png`);
  }

  async function handleDownloadImage(imageState) {
    try {
      await downloadImage(imageState);
    } catch (downloadError) {
      setError(downloadError.message || "图片下载失败，请重试。");
    }
  }

  async function handleDownloadAll() {
    if (!completedImages.length || isDownloadingAll) return;
    setIsDownloadingAll(true);
    setError("");
    try {
      for (const imageState of completedImages.sort((a, b) =>
        a.shotNumber.localeCompare(b.shotNumber),
      )) {
        await downloadImage(imageState);
      }
    } catch (downloadError) {
      setError(downloadError.message || "部分图片下载失败，请重试。");
    } finally {
      setIsDownloadingAll(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            AI
          </span>
          <div>
            <h1>图文短剧分镜生成器</h1>
            <p>DIRECTOR&apos;S STORYBOARD CONSOLE</p>
          </div>
        </div>

        <div className="header-actions">
          <StatusIndicator phase={phase} message={statusMessage} />
          <div
            className="overall-progress"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={Math.round(progress)}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
          <span className="progress-value">{Math.round(progress)}%</span>
          <button
            type="button"
            className="secondary-button"
            onClick={handleCopyAll}
            disabled={!shots.length}
          >
            {copiedKey === "all" ? (
              <CheckCircle weight="fill" size={18} />
            ) : (
              <Copy size={18} />
            )}
            {copiedKey === "all" ? "已复制" : "复制文字"}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={handleDownloadAll}
            disabled={!completedImages.length || isDownloadingAll}
          >
            {isDownloadingAll ? (
              <SpinnerGap className="spin" size={18} />
            ) : (
              <DownloadSimple size={18} />
            )}
            下载图片
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="input-panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">CREATIVE INPUT</span>
              <h2>创作输入</h2>
            </div>
            <FilmSlate size={22} aria-hidden="true" />
          </div>

          <form onSubmit={handleGenerate}>
            <label className="field">
              <span className="field-header">
                <span>
                  短剧主题 <b aria-label="必填">*</b>
                </span>
                <small>{form.theme.length} / 80</small>
              </span>
              <input
                value={form.theme}
                maxLength={80}
                disabled={isGenerating}
                onChange={(event) => updateForm("theme", event.target.value)}
                placeholder="例如：逆袭归来，外卖员的百万人生"
              />
            </label>

            <label className="field field--script">
              <span className="field-header">
                <span>
                  剧本 <b aria-label="必填">*</b>
                </span>
                <small>{form.script.length} / 20,000</small>
              </span>
              <textarea
                value={form.script}
                maxLength={20_000}
                disabled={isGenerating}
                onChange={(event) => updateForm("script", event.target.value)}
                placeholder="粘贴完整剧本，描述人物、冲突和关键情节……"
              />
            </label>

            <div className="field field--style">
              <span className="field-header">
                <label htmlFor="custom-style">风格偏好</label>
                <small>{form.style.length} / 400</small>
              </span>
              <div className="style-presets" aria-label="常用风格">
                {STYLE_PRESETS.map((style) => {
                  const selected = selectedStyles.includes(style);
                  return (
                    <button
                      key={style}
                      type="button"
                      className={`style-chip${selected ? " style-chip--selected" : ""}`}
                      aria-pressed={selected}
                      disabled={isGenerating}
                      onClick={() => toggleStyle(style)}
                    >
                      {style}
                    </button>
                  );
                })}
              </div>
              <textarea
                id="custom-style"
                value={form.style}
                maxLength={400}
                disabled={isGenerating}
                onChange={(event) => updateForm("style", event.target.value)}
                placeholder="补充色调、节奏、镜头质感等自定义要求"
              />
              <p className="field-hint">
                已选风格和自定义要求会同时用于文字与图片生成。
              </p>
            </div>

            {error && (
              <div className="error-banner" role="alert">
                <WarningCircle weight="fill" size={19} />
                <span>{error}</span>
              </div>
            )}

            {isGenerating ? (
              <button
                type="button"
                className="primary-button primary-button--stop"
                onClick={stopGeneration}
              >
                <Stop weight="fill" size={20} />
                停止生成
              </button>
            ) : (
              <button
                type="submit"
                className="primary-button"
                disabled={!canSubmit}
              >
                <Lightning weight="fill" size={21} />
                {shots.length
                  ? "重新生成 5 条图文分镜"
                  : "生成 5 条图文分镜"}
              </button>
            )}
          </form>

          <div className="model-note model-note--stacked">
            <span className="model-dot" />
            <div>
              <strong>qwen3.7-plus → qwen-image-2.0-pro</strong>
              <p>先生成文字，再逐张生成 16:9 图片；完整一组约 ¥2.5</p>
              <p>图片链接保留约 24 小时，请及时下载</p>
            </div>
          </div>
        </aside>

        <section className="results-panel results-panel--cards">
          <div className="results-titlebar">
            <div>
              <span className="eyebrow">STORYBOARD OUTPUT</span>
              <h2>图文分镜结果</h2>
            </div>
            <div className="result-counters">
              <span>文字 {shots.length.toString().padStart(2, "0")} / 05</span>
              <span>
                图片 {completedImages.length.toString().padStart(2, "0")} / 05
              </span>
            </div>
          </div>

          <div className="storyboard-scroll storyboard-scroll--cards">
            <div className="storyboard-card-list">
              {[1, 2, 3, 4, 5].map((number) => {
                const shot = shots.find(
                  (item) => Number.parseInt(item.shotNumber, 10) === number,
                );
                const activeText =
                  isGenerating &&
                  TEXT_PHASES.has(phase) &&
                  number ===
                    Math.max(1, Math.min(5, current || shots.length + 1));
                return (
                  <StoryboardCard
                    key={number}
                    number={number}
                    shot={shot}
                    imageState={imageStates[shot?.shotNumber]}
                    activeText={activeText}
                    onCopy={handleCopyShot}
                    copied={copiedKey === shot?.shotNumber}
                    onPreview={setLightbox}
                    onDownload={handleDownloadImage}
                    onRetry={handleRetryImage}
                    disabled={isGenerating}
                  />
                );
              })}
            </div>
          </div>

          <footer className="results-footer">
            <div>
              <span className={`footer-dot footer-dot--${phase}`} />
              <span>{statusMessage}</span>
            </div>
            <span>5 条文字分镜 · 5 张横屏画面 · 当前会话保存</span>
          </footer>
        </section>
      </div>

      {lightbox && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`镜头 ${lightbox.shotNumber} 图片预览`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setLightbox(null);
          }}
        >
          <div className="lightbox-panel">
            <header>
              <div>
                <span>STORYBOARD PREVIEW</span>
                <strong>镜头 {lightbox.shotNumber}</strong>
              </div>
              <button
                type="button"
                aria-label="关闭图片预览"
                onClick={() => setLightbox(null)}
              >
                <X size={22} />
              </button>
            </header>
            <img
              src={lightbox.imageUrl}
              alt={`镜头 ${lightbox.shotNumber} 大图预览`}
            />
          </div>
        </div>
      )}
    </main>
  );
}
