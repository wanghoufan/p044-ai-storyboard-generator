const FIELD_LABELS = [
  ["画面描述", "visualDescription"],
  ["人物动作", "characterAction"],
  ["台词或旁白", "dialogueOrNarration"],
  ["镜头类型", "shotType"],
  ["画面提示词", "visualPrompt"],
];

export function formatShotForClipboard(shot) {
  return [
    `镜头 ${shot.shotNumber}`,
    ...FIELD_LABELS.map(([label, key]) => `${label}：${shot[key]}`),
  ].join("\n");
}

export function formatAllShotsForClipboard(shots) {
  return shots.map(formatShotForClipboard).join("\n\n");
}

export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Local previews and embedded browsers may deny the async clipboard API.
      // Fall through to the selection-based copy path.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  textarea.style.opacity = "0";
  textarea.setAttribute("readonly", "");
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("浏览器未允许复制，请手动选择文本。");
}

export async function readEventStream(response, onEvent) {
  if (!response.ok) {
    let payload;
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }
    const error = new Error(payload.message || "生成请求失败，请重试。");
    error.code = payload.code;
    error.retryable = payload.retryable;
    throw error;
  }

  if (!response.body) throw new Error("浏览器无法读取流式响应。");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = done ? "" : blocks.pop() || "";

    for (const block of blocks) {
      if (!block.trim()) continue;
      let event = "message";
      const dataLines = [];
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (!dataLines.length) continue;
      onEvent(event, JSON.parse(dataLines.join("\n")));
    }

    if (done) break;
  }
}
