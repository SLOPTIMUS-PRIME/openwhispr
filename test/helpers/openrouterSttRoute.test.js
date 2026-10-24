const test = require("node:test");
const assert = require("node:assert/strict");
const { createRendererServer, installBrowserGlobals } = require("../lib/rendererTestHarness");

// OpenRouter STT: route selection, registry entry, key slot and model-slug
// preservation. The UI picker itself is owned elsewhere; these pin the seams
// it and the transports rely on.

const load = () => import("../../src/helpers/transcriptionRoute.ts");

const resolve = async (settings, extra = {}) => {
  const { resolveTranscriptionRoute } = await load();
  return resolveTranscriptionRoute({ settings, ...extra });
};

const BASE_SETTINGS = {
  transcriptionMode: "providers",
  useLocalWhisper: false,
  cloudTranscriptionMode: "byok",
  cloudTranscriptionProvider: "openrouter",
};

test("openrouter routes batch STT through the main-process proxy with the exact model id", async () => {
  const route = await resolve({
    ...BASE_SETTINGS,
    cloudTranscriptionModel: "openai/gpt-4o-transcribe:nitro",
    preferredLanguage: "en-US",
  });
  assert.equal(route.transport, "proxied");
  assert.equal(route.provider, "openrouter");
  assert.equal(
    route.model,
    "openai/gpt-4o-transcribe:nitro",
    "namespace slug and suffix must survive routing verbatim"
  );
  assert.equal(route.language, "en");
  assert.equal(route.sizeCapBytes, 25 * 1024 * 1024);
});

test("a colon-suffixed model the catalog never listed is still routed unchanged", async () => {
  const route = await resolve({
    ...BASE_SETTINGS,
    cloudTranscriptionModel: "vendor/obscure:floor",
  });
  assert.equal(route.transport, "proxied");
  assert.equal(route.model, "vendor/obscure:floor");
});

test("no OpenAI model is ever substituted for a missing OpenRouter selection", async () => {
  const route = await resolve({ ...BASE_SETTINGS, cloudTranscriptionModel: "" });
  assert.equal(route.transport, "error");
  assert.doesNotMatch(route.message, /gpt|whisper/i);
  assert.notEqual(
    route.transport,
    "http-batch",
    "audio must never fall through to OpenAI's endpoint"
  );

  const defaulted = await resolve({ ...BASE_SETTINGS });
  assert.equal(defaulted.transport, "error");
});

test("resolveByokModel returns openrouter ids verbatim, without an OpenAI default", async () => {
  const { resolveByokModel } = await load();
  assert.equal(resolveByokModel("openrouter", "vendor/example:nitro"), "vendor/example:nitro");
  assert.equal(
    resolveByokModel("openrouter", "  vendor/example:exacto  "),
    "vendor/example:exacto"
  );
  assert.equal(resolveByokModel("openrouter", ""), "");
  assert.equal(resolveByokModel("openrouter"), "");
});

test("the registry ships an explicit batch-only openrouter provider with no hardcoded models", async () => {
  const data = require("../../src/models/modelRegistryData.json");
  const provider = data.transcriptionProviders.find((p) => p.id === "openrouter");
  assert.ok(provider, "openrouter must exist among the transcription providers");
  assert.equal(provider.name, "OpenRouter");
  assert.equal(provider.baseUrl, "https://openrouter.ai/api/v1");
  assert.deepEqual(
    provider.models,
    [],
    "discovery is dynamic; the registry must not become an allowlist"
  );
  assert.equal(provider.batchModel, undefined, "the user's selected slug is the batch model");
});

test("registry accessors treat openrouter as batch-only with no model catalog", async (t) => {
  const { storage } = installBrowserGlobals(t);
  storage.clear();
  const vite = await createRendererServer(t, {
    cachePrefix: "openwhispr-openrouter-registry-test-",
  });
  const registry = await vite.ssrLoadModule("/models/ModelRegistry.ts");

  const provider = registry.getTranscriptionProvider("openrouter");
  assert.ok(provider);
  assert.equal(provider.name, "OpenRouter");
  assert.deepEqual(registry.getTranscriptionModels("openrouter"), []);
  assert.equal(registry.getBatchTranscriptionModel("openrouter"), undefined);
  assert.equal(
    registry.getStreamingTranscriptionProviders().some((p) => p.id === "openrouter"),
    false,
    "openrouter has no realtime models, so it must never appear as a streaming provider"
  );
});

test("getTranscriptionApiKey('openrouter') reads the saved custom transcription slot", async (t) => {
  installBrowserGlobals(t);
  const vite = await createRendererServer(t, { cachePrefix: "openrouter-file-key-test-" });
  const mod = await vite.ssrLoadModule("/services/fileTranscription.ts");
  const keys = { customTranscriptionApiKey: "sk-or-saved-key" };
  assert.equal(mod.getTranscriptionApiKey("openrouter", keys), "sk-or-saved-key");
  assert.equal(mod.getTranscriptionApiKey("openrouter", {}), "");
});

test("the settings store neither wipes a remembered openrouter slug nor defaults to whisper-1", async (t) => {
  const { storage } = installBrowserGlobals(t);
  const vite = await createRendererServer(t, {
    cachePrefix: "openwhispr-openrouter-settings-test-",
  });
  let store = null;
  const load = async (seed) => {
    storage.clear();
    for (const [key, value] of Object.entries(seed)) storage.setItem(key, value);
    vite.moduleGraph.invalidateAll();
    store = (await vite.ssrLoadModule("/stores/settingsStore.ts")).useSettingsStore;
    return store.getState();
  };
  const live = () => store.getState();

  const state = await load({
    cloudTranscriptionProvider: "openrouter",
    cloudTranscriptionModel: "vendor/example:nitro",
    transcriptionMode: "providers",
    useLocalWhisper: "false",
    cloudTranscriptionMode: "byok",
  });

  // Round-trip through another provider and back: the slug must be restored.
  state.switchCloudTranscriptionProvider("dictation", "openai");
  assert.equal(live().cloudTranscriptionProvider, "openai");

  live().switchCloudTranscriptionProvider("dictation", "openrouter");
  assert.equal(
    live().cloudTranscriptionModel,
    "vendor/example:nitro",
    "an off-catalog slug must survive provider switches"
  );

  // A fresh openrouter selection must not inherit whisper-1/gpt-* defaults.
  const fresh = await load({
    cloudTranscriptionProvider: "openai",
    cloudTranscriptionModel: "whisper-1",
    transcriptionMode: "providers",
    useLocalWhisper: "false",
    cloudTranscriptionMode: "byok",
  });
  fresh.switchCloudTranscriptionProvider("dictation", "openrouter");
  assert.equal(live().cloudTranscriptionProvider, "openrouter");
  assert.doesNotMatch(
    live().cloudTranscriptionModel,
    /whisper|gpt/,
    "no OpenAI model may be silently selected for openrouter"
  );
});
