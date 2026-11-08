const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const LinuxIdleMonitor = require("../../src/helpers/linuxIdleMonitor");
function fixture() {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.kill = () => child.emit("exit", 0);
  let calls = 0;
  const monitor = new LinuxIdleMonitor({
    wayland: true,
    spawn: () => {
      calls++;
      return child;
    },
    now: () => 100000,
  });
  return { monitor, child, calls: () => calls };
}
test("X11 uses Electron's actual idle time", () => {
  assert.equal(
    new LinuxIdleMonitor({ wayland: false }).getIdleSeconds(() => 91),
    91
  );
});
test("Wayland waits for compositor idle and resets on input", () => {
  const { monitor, child } = fixture();
  assert.equal(
    monitor.getIdleSeconds(() => 999),
    0
  );
  child.stdout.emit("data", Buffer.from("ACT"));
  child.stdout.emit("data", Buffer.from("IVE\nIDLE\n"));
  assert.equal(
    monitor.getIdleSeconds(() => 0),
    60
  );
  child.stdout.emit("data", Buffer.from("ACTIVE\n"));
  assert.equal(
    monitor.getIdleSeconds(() => 999),
    0
  );
  monitor.stop();
});
test("a dead compositor monitor never authorizes a restart", () => {
  const { monitor, child, calls } = fixture();
  monitor.getIdleSeconds(() => 999);
  child.stdout.emit("data", Buffer.from("IDLE\n"));
  child.emit("exit", 1);
  assert.equal(
    monitor.getIdleSeconds(() => 999),
    0
  );
  assert.equal(calls(), 1);
});
test("monitor errors and malformed output fail closed", () => {
  const { monitor, child } = fixture();
  monitor.getIdleSeconds(() => 999);
  child.stdout.emit("data", Buffer.from("IDLE\ninvalid\n"));
  assert.equal(
    monitor.getIdleSeconds(() => 999),
    0
  );
  child.emit("error", new Error("missing helper"));
  assert.equal(
    monitor.getIdleSeconds(() => 999),
    0
  );
});
