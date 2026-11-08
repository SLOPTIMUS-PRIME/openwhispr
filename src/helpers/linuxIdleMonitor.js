const path = require("node:path");
const { spawn } = require("node:child_process");

// XWayland need not expose MIT-SCREEN-SAVER, so Electron can report zero forever.
// On Wayland, only the compositor may declare the session idle.
class LinuxIdleMonitor {
  constructor(options = {}) {
    this.wayland =
      options.wayland ?? (process.platform === "linux" && !!process.env.WAYLAND_DISPLAY);
    this.spawn = options.spawn ?? spawn;
    this.now = options.now ?? Date.now;
    this.binary =
      options.binary ??
      path.join(
        process.resourcesPath || path.join(__dirname, "../../resources"),
        "bin",
        "linux-idle-monitor"
      );
    this.child = null;
    this.idle = false;
    this.lastAttempt = -Infinity;
    this.stopped = false;
  }
  getIdleSeconds(fallback) {
    if (!this.wayland) return fallback();
    if (!this.child && !this.stopped && this.now() - this.lastAttempt >= 30000) {
      this.lastAttempt = this.now();
      this.idle = false;
      try {
        const child = this.spawn(this.binary, [], { stdio: ["ignore", "pipe", "ignore"] });
        this.child = child;
        let pending = "";
        child.stdout.on("data", (data) => {
          if (this.child !== child) return;
          pending += data.toString();
          if (pending.length > 1024) {
            this.idle = false;
            pending = "";
            return;
          }
          let index;
          while ((index = pending.indexOf("\n")) >= 0) {
            this.idle = pending.slice(0, index) === "IDLE";
            pending = pending.slice(index + 1);
          }
        });
        const unavailable = () => {
          if (this.child === child) {
            this.child = null;
            this.idle = false;
          }
        };
        child.on("error", unavailable);
        child.on("exit", unavailable);
      } catch {
        this.child = null;
        this.idle = false;
      }
    }
    return this.child && this.idle ? 60 : 0;
  }
  stop() {
    this.stopped = true;
    this.idle = false;
    const child = this.child;
    this.child = null;
    child?.kill();
  }
}
module.exports = LinuxIdleMonitor;
