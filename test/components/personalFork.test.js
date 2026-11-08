const test = require("node:test");
const assert = require("node:assert/strict");
const { mountSettingsPanel } = require("../lib/settingsPanelHarness");

test("the personal fork ignores a stale account login and uses personal provider modes", async (t) => {
  const panel = await mountSettingsPanel(t, {
    module: "/components/OpenAICompatiblePanel.tsx",
    props: { baseUrl: "", setBaseUrl() {}, apiKey: "", setApiKey() {}, model: "", setModel() {} },
    settings: {
      isSignedIn: "true",
      transcriptionMode: "openwhispr",
      cloudTranscriptionMode: "openwhispr",
      cleanupMode: "openwhispr",
    },
  });
  assert.equal(panel.state().isSignedIn, false);
  assert.equal(panel.state().transcriptionMode, "providers");
  assert.equal(panel.state().cloudTranscriptionMode, "byok");
  assert.equal(panel.state().cleanupMode, "providers");
  assert.equal(panel.state().geminiSmartCleanup, false);
  panel.state().setGeminiSmartCleanup(true);
  assert.equal(panel.state().geminiSmartCleanup, true);
  assert.equal(localStorage.getItem("geminiSmartCleanup"), "true");
});
