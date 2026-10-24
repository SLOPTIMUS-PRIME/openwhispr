const test = require("node:test");
const assert = require("node:assert/strict");
test("hidden virtualized model rows retain an estimated size instead of collapsing the picker", async () => {
  const { modelRowHeight } = await import("../../src/utils/modelRowHeight.ts");
  const element = (height) => ({ getBoundingClientRect: () => ({ height }) });
  assert.equal(modelRowHeight(element(0), 30), 30);
  assert.equal(modelRowHeight(element(0), 40), 40);
  assert.equal(modelRowHeight(element(47), 40), 47);
});
