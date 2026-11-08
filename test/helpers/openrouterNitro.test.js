const test = require("node:test");
const assert = require("node:assert/strict");
const { testProviderConnection } = require("../../src/helpers/providerConnectionTest");

test("a Custom OpenRouter cleanup connection accepts Nitro variants absent from discovery", async () => {
  const result = await testProviderConnection(
    {
      scope: "reasoning",
      provider: "custom",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: "test",
      model: "vendor/example:nitro",
    },
    async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: "vendor/example" }] }),
    })
  );
  assert.equal(result.success, true);
});

test("Custom OpenRouter transcription also resolves routing-only suffixes", async () => {
  const result = await testProviderConnection(
    {
      scope: "transcription",
      provider: "custom",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: "synthetic",
      model: "vendor/model:exacto:floor",
    },
    async () => ({ ok: true, status: 200, json: async () => ({ data: [{ id: "vendor/model" }] }) })
  );
  assert.equal(result.success, true);
});

test("OpenRouter metadata does not substitute a paid model for an unavailable free variant", async () => {
  const result = await testProviderConnection(
    {
      scope: "reasoning",
      provider: "custom",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: "synthetic",
      model: "vendor/model:free:nitro",
    },
    async () => ({ ok: true, status: 200, json: async () => ({ data: [{ id: "vendor/model" }] }) })
  );
  assert.equal(result.success, false);
  assert.equal(result.errorCode, "modelNotFound");
});

test("a non-OpenRouter server does not inherit OpenRouter suffix semantics", async () => {
  const result = await testProviderConnection(
    {
      scope: "reasoning",
      provider: "custom",
      baseUrl: "http://localhost:1234/v1",
      apiKey: "",
      model: "vendor/example:nitro",
    },
    async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: "vendor/example" }] }),
    })
  );
  assert.equal(result.success, false);
  assert.equal(result.errorCode, "modelNotFound");
});
