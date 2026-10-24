const test = require("node:test");
const assert = require("node:assert/strict");
const { transcribeWithGemini } = require("../../src/helpers/geminiTranscription");

test("Gemini batch routing carries Smart cleanup only when enabled", async () => {
  const { resolveTranscriptionRoute } = await import("../../src/helpers/transcriptionRoute.ts");
  const settings = { cloudTranscriptionProvider: "gemini", geminiSmartCleanup: true };
  assert.equal(resolveTranscriptionRoute({ settings }).smartCleanup, true);
  assert.equal(
    resolveTranscriptionRoute({ settings: { ...settings, geminiSmartCleanup: false } })
      .smartCleanup,
    undefined
  );
  assert.equal(
    resolveTranscriptionRoute({ settings: { ...settings, cloudTranscriptionProvider: "mistral" } })
      .smartCleanup,
    undefined
  );
});

test("Gemini Smart cleanup sends smart transcription mode in the same audio request", async () => {
  let body;
  await transcribeWithGemini(
    { audioBuffer: Buffer.from("test"), apiKey: "test", smartCleanup: true },
    async (_url, init) => {
      body = JSON.parse(init.body);
      return { ok: true, json: async () => ({ status: "completed", output_text: "Wednesday." }) };
    }
  );
  assert.equal(body.generation_config?.transcription_config?.mode, "smart");
});
