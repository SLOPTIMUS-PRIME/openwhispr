const test = require("node:test");
const assert = require("node:assert/strict");
const { loadAudioManager } = require("./harness/audioManager");

// OpenRouter dictation is batch-only through the dedicated main-process proxy.
// These pin the renderer-side dispatch: the payload shape, the exact model id,
// and the fact that neither the OpenAI endpoint nor the OpenAI key is touched.

const AUDIO_BLOB = () => new Blob([new Uint8Array([1, 2, 3, 4])], { type: "audio/webm" });

function setSettings(overrides = {}) {
  globalThis.__openrouterBatchSettings = {
    useLocalWhisper: false,
    transcriptionMode: "providers",
    remoteTranscriptionUrl: "",
    cloudTranscriptionMode: "byok",
    cloudTranscriptionProvider: "openrouter",
    cloudTranscriptionModel: "vendor/example:nitro",
    customTranscriptionApiKey: "sk-or-renderer-key",
    openaiApiKey: "",
    allowLocalFallback: false,
    allowOpenAIFallback: false,
    preferredLanguage: "en-US",
    customDictionary: [],
    useCleanupModel: false,
    ...overrides,
  };
}

async function loadManager(t, overrides = {}) {
  const { createManager } = await loadAudioManager(t, {
    cachePrefix: "openwhispr-openrouter-batch-test-",
    settingsKey: "__openrouterBatchSettings",
    settings: globalThis.__openrouterBatchSettings,
  });
  return createManager({
    // Success-path helpers the prototype-only instance skips; the dispatch under
    // test ends at the proxied transcript.
    processTranscription: async (text) => text,
    isReasoningAvailable: async () => false,
    ...overrides,
  });
}

test("openrouter never streams, even with a key present", async (t) => {
  setSettings();
  const manager = await loadManager(t);
  assert.equal(manager.shouldUseStreaming(), false);
});

test("dictation dispatches through the proxy with the verbatim model id and no OpenAI reads", async (t) => {
  setSettings();
  const manager = await loadManager(t);
  const proxyPayloads = [];
  globalThis.window.electronAPI.proxyOpenrouterTranscription = async (payload) => {
    proxyPayloads.push(payload);
    return { text: "proxied transcript" };
  };
  const openAiReads = [];
  globalThis.window.electronAPI.getOpenAIKey = async () => {
    openAiReads.push(1);
    return "sk-openai";
  };
  const directFetches = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (...args) => {
    directFetches.push(args);
    throw new Error("renderer fetch must not run for a proxied provider");
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const result = await manager.processWithOpenAIAPI(AUDIO_BLOB());

  assert.equal(result.success, true);
  assert.equal(result.text, "proxied transcript");
  assert.equal(result.source, "openrouter");
  assert.equal(proxyPayloads.length, 1);
  const payload = proxyPayloads[0];
  assert.equal(
    payload.model,
    "vendor/example:nitro",
    "namespace slug and suffix ride along unchanged"
  );
  assert.equal(payload.language, "en");
  assert.equal(payload.contentType, "audio/webm");
  assert.ok(payload.audioBuffer instanceof ArrayBuffer);
  assert.equal(new Uint8Array(payload.audioBuffer)[0], 1);
  assert.equal("prompt" in payload, false, "the endpoint ignores a prompt field");
  assert.equal(openAiReads.length, 0, "the OpenAI key must not be read or attached");
  assert.equal(directFetches.length, 0, "no renderer HTTP request may be made");
});

test("a missing openrouter key surfaces API_KEY_MISSING before any dispatch", async (t) => {
  setSettings({ customTranscriptionApiKey: "" });
  const manager = await loadManager(t);
  globalThis.window.electronAPI.getCustomTranscriptionKey = async () => "";
  const proxyPayloads = [];
  globalThis.window.electronAPI.proxyOpenrouterTranscription = async (payload) => {
    proxyPayloads.push(payload);
    return { text: "should not happen" };
  };

  await assert.rejects(
    manager.processWithOpenAIAPI(AUDIO_BLOB()),
    (error) => error.code === "API_KEY_MISSING" && /OpenRouter/i.test(error.message)
  );
  assert.equal(proxyPayloads.length, 0);
});
