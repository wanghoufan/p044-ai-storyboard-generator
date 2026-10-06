import assert from "node:assert/strict";
import test from "node:test";

const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
    removeItem: (key) => store.delete(key),
  },
};

const { apiRequest, readStoredKey, storeKey } = await import("../src/byok.js");

test("未保存 Key 时不发请求，错误码可被界面识别", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response("{}");
  };

  await assert.rejects(() => apiRequest({ theme: "主题" }), (error) => {
    assert.equal(error.code, "API_KEY_REQUIRED");
    assert.equal(error.retryable, false);
    return true;
  });
  assert.equal(calls, 0);
});

test("Key 只走请求头，不写进请求体", async () => {
  storeKey("  sk-visitor  ");
  assert.equal(readStoredKey(), "sk-visitor");

  let seen;
  globalThis.fetch = async (url, options) => {
    seen = { url, options };
    return new Response("ok");
  };
  await apiRequest({ theme: "主题", script: "剧本" });

  assert.equal(seen.url, "/api/storyboards");
  assert.equal(seen.options.headers["x-dashscope-api-key"], "sk-visitor");
  assert.doesNotMatch(seen.options.body, /sk-visitor/);
});

test("保存空值等于清除本地存储", () => {
  storeKey("");
  assert.equal(readStoredKey(), "");
  assert.equal(store.size, 0);
});
