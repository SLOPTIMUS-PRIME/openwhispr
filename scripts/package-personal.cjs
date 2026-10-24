#!/usr/bin/env node
// Repackage a matching upstream Linux runtime with this checkout's application code.
// The input directory must be an extracted upstream app.asar with its Linux native files.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const cp = require("node:child_process");
const asar = require("@electron/asar");

async function main() {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error("Usage: package-personal.cjs EXTRACTED_APP OUTPUT_ASAR");
  const root = path.resolve(__dirname, "..");
  const stage = path.resolve(input);
  if (
    stage === root ||
    !fs.existsSync(
      path.join(stage, "node_modules/better-sqlite3/build/Release/better_sqlite3.node")
    )
  ) {
    throw new Error("Expected a separate extracted app with the upstream Linux native runtime");
  }
  const metadata = JSON.parse(fs.readFileSync(path.join(root, "package.json")));
  const original = JSON.parse(fs.readFileSync(path.join(stage, "package.json")));
  if (JSON.stringify(metadata.dependencies) !== JSON.stringify(original.dependencies)) {
    throw new Error("The upstream dependency specifications do not match this checkout");
  }
  const sources = [
    "main.js",
    "preload.js",
    "src/helpers",
    "src/config",
    "src/constants",
    "src/locales",
    "src/hooks",
    "src/models",
    "src/types",
    "src/utils",
    "src/workers",
    "src/dist",
    "src/services/localReasoningBridge.js",
    "src/services/transcriptionBaseUrl.ts",
    "src/stores/policyRules.ts",
    "src/utils.js",
    "src/updater.js",
    "src/components.json",
  ];
  const hashes = {};
  function hashFiles(relative) {
    const full = path.join(root, relative);
    if (fs.statSync(full).isDirectory()) {
      for (const name of fs.readdirSync(full).sort()) hashFiles(path.join(relative, name));
    } else
      hashes[relative] = crypto.createHash("sha256").update(fs.readFileSync(full)).digest("hex");
  }
  for (const source of sources) {
    if (
      !fs.existsSync(path.join(root, source)) &&
      ["src/utils.js", "src/components.json"].includes(source)
    ) {
      fs.rmSync(path.join(stage, source), { recursive: true, force: true });
      continue;
    }
    hashFiles(source);
    const destination = path.join(stage, source);
    fs.rmSync(destination, { recursive: true, force: true });
    fs.cpSync(path.join(root, source), destination, { recursive: true });
  }
  const sourceHash = crypto.createHash("sha256").update(JSON.stringify(hashes)).digest("hex");
  const sourceCommit = cp
    .execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" })
    .trim();
  const baseCommit = cp
    .execFileSync("git", ["merge-base", "HEAD", "origin/main"], { cwd: root, encoding: "utf8" })
    .trim();
  // Retain the application name: it owns the existing settings and OS keyring namespace.
  metadata.personalFork = {
    repository: "SLOPTIMUS-PRIME/openwhispr",
    baseCommit,
    sourceCommit,
    sourceHash,
  };
  fs.writeFileSync(path.join(stage, "package.json"), JSON.stringify(metadata, null, 2) + "\n");
  fs.rmSync(path.join(stage, ".env"), { force: true });
  await asar.createPackageWithOptions(stage, path.resolve(output), {
    unpackDir:
      "{node_modules/ffmpeg-static,node_modules/ps-list,node_modules/better-sqlite3,node_modules/onnxruntime-node,node_modules/@napi-rs,src/workers}",
  });
  fs.chmodSync(path.resolve(output), 0o644);
  for (const name of [
    "node_modules/ffmpeg-static/ffmpeg",
    "node_modules/better-sqlite3/build/Release/better_sqlite3.node",
    "src/workers/onnxWorker.js",
  ]) {
    if (!asar.statFile(path.resolve(output), name).unpacked)
      throw new Error("Native/runtime file was not unpacked: " + name);
  }
  for (const [name, hash] of Object.entries(hashes)) {
    const bytes = asar.extractFile(path.resolve(output), name);
    if (crypto.createHash("sha256").update(bytes).digest("hex") !== hash) {
      throw new Error("Packaged source verification failed: " + name);
    }
  }
  console.log(
    JSON.stringify({
      version: metadata.version,
      sourceHash,
      verifiedFiles: Object.keys(hashes).length,
      archive: path.resolve(output),
    })
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
