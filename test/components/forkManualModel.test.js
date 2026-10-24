const test = require("node:test");
const assert = require("node:assert/strict");
const { mountSettingsPanel } = require("../lib/settingsPanelHarness");

test("a manually entered cleanup model keeps its OpenRouter suffix after discovery refresh", async (t) => {
  const saved = [];
  const props = {
    baseUrl: "https://openrouter.ai/api/v1",
    setBaseUrl() {},
    apiKey: "",
    setApiKey() {},
    model: "vendor/example",
    setModel(value) {
      saved.push(value);
      props.model = value;
    },
    provider: "openrouter",
    lockedBaseUrl: true,
  };
  const panel = await mountSettingsPanel(t, {
    module: "/components/OpenAICompatiblePanel.tsx",
    props,
    fetch: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: "vendor/example" }] }),
    }),
  });
  assert.ok(panel.field("reasoning.enterprise.customModelId"));
  await panel.type("reasoning.enterprise.customModelId", "vendor/example:nitro");
  await panel.setProps({ model: props.model });
  await panel.wait(0);
  assert.equal(
    panel.field("reasoning.enterprise.customModelId").props.value,
    "vendor/example:nitro"
  );
  assert.deepEqual(saved, ["vendor/example:nitro"]);
});
