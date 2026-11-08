const test = require("node:test");
const assert = require("node:assert/strict");

test("OpenRouter catalog lookup removes routing options without silently replacing free with paid", async () => {
  const { openRouterCatalogId } = await import("../../src/models/openrouterVariants.ts");
  assert.equal(openRouterCatalogId("vendor/model:free:nitro:exacto"), "vendor/model:free");
  assert.equal(openRouterCatalogId("vendor/model:thinking:floor"), "vendor/model:thinking");
  assert.equal(openRouterCatalogId("vendor/model:unknown:nitro"), "vendor/model:unknown");
});

test("checkbox routing choices replace conflicting sorts and keep unrelated suffixes intact", async () => {
  const { setOpenRouterVariant } = await import("../../src/models/openrouterVariants.ts");
  assert.equal(
    setOpenRouterVariant("vendor/model:free:nitro:unknown", "floor", true),
    "vendor/model:free:unknown:floor"
  );
  assert.equal(setOpenRouterVariant("vendor/model:floor", "floor", false), "vendor/model");
  assert.equal(
    setOpenRouterVariant("vendor/model:online:nitro", "exacto", true),
    "vendor/model:online:exacto"
  );
  assert.equal(setOpenRouterVariant("", "nitro", true), "");
  assert.equal(
    setOpenRouterVariant("vendor/model:free:nitro", "free", false),
    "vendor/model:nitro"
  );
});

test("model-list selection keeps routing checkboxes and never fabricates a free catalog entry", async () => {
  const { selectOpenRouterModel } = await import("../../src/models/openrouterVariants.ts");
  assert.equal(
    selectOpenRouterModel("vendor/old:nitro", "vendor/new", ["vendor/new"]),
    "vendor/new:nitro"
  );
  assert.equal(
    selectOpenRouterModel("vendor/old:free:floor", "vendor/new", ["vendor/new"]),
    "vendor/new:floor"
  );
  assert.equal(
    selectOpenRouterModel("vendor/old:free:floor", "vendor/new", ["vendor/new", "vendor/new:free"]),
    "vendor/new:free:floor"
  );
  assert.equal(
    selectOpenRouterModel("vendor/old:nitro", "vendor/new:free", ["vendor/new:free"]),
    "vendor/new:free:nitro"
  );
});
