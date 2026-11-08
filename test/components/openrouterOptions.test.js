const test = require("node:test");
const assert = require("node:assert/strict");
const { mountSettingsPanel } = require("../lib/settingsPanelHarness");

test("OpenRouter variant controls reflect the effective sort and disable unavailable free variants", async (t) => {
  const saved = [];
  const p = await mountSettingsPanel(t, {
    module: "/components/OpenRouterModelVariants.tsx",
    props: {
      model: "vendor/model:free:floor:nitro",
      catalogIds: ["vendor/model", "vendor/model:free"],
      onChange: (v) => saved.push(v),
      scope: "transcription",
    },
  });
  assert.equal(p.field("Nitro").props.checked, true);
  assert.equal(p.field("Floor").props.checked, false);
  assert.equal(p.field("Free").props.checked, true);
  assert.equal(p.field("Free").props.disabled, false);
  p.field("Floor").props.onChange({ target: { checked: true } });
  assert.deepEqual(saved, ["vendor/model:free:floor"]);
  await p.setProps({ model: "vendor/other:nitro", catalogIds: ["vendor/other"] });
  assert.equal(p.field("Free").props.disabled, true);
  await p.setProps({ model: "" });
  assert.equal(p.field("Nitro").props.disabled, true);
});

test("OpenRouter STT discovery uses only transcription models, keeps suffixes on picker selection, and exposes the same options component", async (t) => {
  const urls = [],
    saved = [];
  const props = {
    baseUrl: "https://openrouter.ai/api/v1",
    setBaseUrl() {},
    apiKey: "",
    setApiKey() {},
    model: "vendor/old:floor",
    setModel: (v) => saved.push(v),
    provider: "openrouter",
    lockedBaseUrl: true,
    scope: "transcription",
  };
  const p = await mountSettingsPanel(t, {
    module: "/components/OpenAICompatiblePanel.tsx",
    props,
    fetch: async (url) => {
      urls.push(url);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              id: "vendor/stt",
              name: "Synthetic speech model",
              architecture: { output_modalities: ["transcription"] },
            },
            { id: "vendor/chat", architecture: { output_modalities: ["text"] } },
          ],
        }),
      };
    },
  });
  await p.wait(0);
  assert.ok(
    urls.some((u) => u === "https://openrouter.ai/api/v1/models?output_modalities=transcription")
  );
  const list = p.find((n) => Array.isArray(n.props?.models))[0];
  assert.deepEqual(
    list.props.models.map((m) => m.value),
    ["vendor/stt"]
  );
  list.props.onModelSelect("vendor/stt");
  assert.deepEqual(saved, ["vendor/stt:floor"]);
  const variants = p.find(
    (n) => n.props?.scope === "transcription" && Array.isArray(n.props?.catalogIds)
  )[0];
  assert.ok(variants, "speech-to-text uses the shared OpenRouter checkbox controls");
  assert.equal(variants.props.model, "vendor/old:floor");
});
