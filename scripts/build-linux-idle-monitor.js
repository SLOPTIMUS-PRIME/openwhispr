const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
if (process.platform === "linux") {
  const root = path.join(__dirname, "..");
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "openwhispr-idle-build-"));
  try {
    const protocolDir = execFileSync("pkg-config", ["--variable=pkgdatadir", "wayland-protocols"], {
      encoding: "utf8",
    }).trim();
    const xml = path.join(protocolDir, "staging/ext-idle-notify/ext-idle-notify-v1.xml");
    const header = path.join(temp, "ext-idle-notify-v1-client-protocol.h");
    const protocol = path.join(temp, "idle-protocol.c");
    execFileSync("wayland-scanner", ["client-header", xml, header]);
    execFileSync("wayland-scanner", ["private-code", xml, protocol]);
    const flags = execFileSync("pkg-config", ["--cflags", "--libs", "wayland-client"], {
      encoding: "utf8",
    })
      .trim()
      .split(/\s+/);
    fs.mkdirSync(path.join(root, "resources/bin"), { recursive: true });
    execFileSync(
      "cc",
      [
        "-O2",
        "-Wall",
        "-Wextra",
        "-Werror",
        "-I",
        temp,
        path.join(root, "resources/linux-idle-monitor.c"),
        protocol,
        "-o",
        path.join(root, "resources/bin/linux-idle-monitor"),
        ...flags,
      ],
      { stdio: "inherit" }
    );
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
