const test = require("node:test");
const assert = require("node:assert/strict");
const { mountSettingsPanel } = require("../lib/settingsPanelHarness");

test("speech-to-text offers an OpenRouter tab backed by the shared picker without leaking another provider key", async (t) => {
  const selected = [];
  const p = await mountSettingsPanel(t, {
    module: "/components/TranscriptionModelPicker.tsx",
    props: {
      transcriptionContext: "dictation",
      selectedCloudProvider: "openrouter",
      onCloudProviderSelect() {},
      selectedCloudModel: "microsoft/mai-transcribe-2:nitro",
      onCloudModelSelect: (m) => selected.push(m),
      selectedLocalModel: "",
      onLocalModelSelect() {},
      useLocalWhisper: false,
      onModeChange() {},
      cloudTranscriptionBaseUrl: "https://other.example/v1",
      mode: "cloud",
    },
    secrets: {
      openaiApiKey: "synthetic-other-provider",
      customTranscriptionApiKey: "synthetic-openrouter-slot",
    },
    electronAPI: {
      onWhisperDownloadProgress: () => () => {},
      onParakeetDownloadProgress: () => () => {},
    },
  });
  const tabs = p.find((n) => n.props?.providers?.some?.((x) => x.id === "openrouter"));
  assert.ok(tabs.length, "OpenRouter is an explicit transcription provider");
  const shared = p.find(
    (n) => n.props?.scope === "transcription" && n.props.provider === "openrouter"
  )[0];
  assert.ok(shared, "OpenRouter STT uses the shared live model picker and suffix controls");
  assert.equal(shared.props.baseUrl, "https://openrouter.ai/api/v1");
  assert.equal(shared.props.model, "microsoft/mai-transcribe-2:nitro");
  assert.equal(shared.props.apiKey, "synthetic-openrouter-slot");
  shared.props.setModel("google/gemini-3.5-transcribe:floor");
  assert.deepEqual(selected, ["google/gemini-3.5-transcribe:floor"]);
  await p.wait(0);
  assert.equal(
    p.requests().length,
    0,
    "the nested picker owns its check; the outer picker must not send an OpenAI key to OpenRouter"
  );
});
