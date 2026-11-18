// Runs a Python 3 script with whatever Python this computer has (Windows: `py -3` or `python`;
// macOS/Linux: `python3`). Set PYTHON=/path/to/python to choose one (e.g. a virtual env).
//     node scripts/py.mjs scripts/audio/build_audio.py [args…]
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const candidates = process.env.PYTHON
  ? [[process.env.PYTHON, []]]
  : process.platform === "win32"
    ? [["py", ["-3"]], ["python", []], ["python3", []]]
    : [["python3", []], ["python", []]];
for (const [cmd, pre] of candidates) {
  const probe = spawnSync(cmd, [...pre, "-c", "import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)"], { stdio: "ignore" });
  if (probe.status === 0) {
    const r = spawnSync(cmd, [...pre, ...args], { stdio: "inherit" });
    process.exit(r.status ?? 1);
  }
}
console.error("Python 3.9+ was not found. Install it from https://www.python.org/downloads/ (tick 'Add python.exe to PATH'), then: pip install numpy");
process.exit(1);
