const test = require("node:test");
const assert = require("node:assert/strict");
const config = require("../../electron-builder.json");

test("personal fork packages target its own GitHub repository", () => {
  assert.equal(config.publish.owner, "SLOPTIMUS-PRIME");
  assert.equal(config.publish.repo, "openwhispr");
});

test("personal fork does not bundle developer environment secrets", () => {
  assert.equal(config.extraResources.includes(".env"), false);
});
