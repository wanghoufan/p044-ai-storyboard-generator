const STORAGE_KEY = "storyboard.dashscopeApiKey";
const API_PATH = "/api/storyboards";

export function readStoredKey() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function storeKey(value) {
  const key = (value || "").trim();
  try {
    if (key) window.localStorage.setItem(STORAGE_KEY, key);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 隐私模式下写不进去，本次会话仍然可以用内存里的值
  }
  return key;
}

export function missingKeyError() {
  const error = new Error("请先填写你自己的百炼 API Key。");
  error.code = "API_KEY_REQUIRED";
  error.retryable = false;
  return error;
}

export async function apiRequest(body, signal) {
  const key = readStoredKey();
  if (!key) throw missingKeyError();
  return fetch(API_PATH, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-dashscope-api-key": key,
    },
    body: JSON.stringify(body),
    signal,
  });
}
