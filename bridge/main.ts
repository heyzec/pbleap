import { spawn } from "node:child_process";
import { mitm, GOPLS } from "./mitm";
import { stdioMode } from "./proxy";

require("source-map-support").install();

const args = process.argv.slice(2);
const subcommand = args.find((a) => !a.startsWith("-"));

if (subcommand) {
  // CLI invocation (e.g. version, bug) — forward to real gopls
  const cp = spawn(GOPLS, args, { stdio: "inherit" });
  cp.on("exit", (code) => process.exit(code ?? 0));
  cp.on("error", (e) => { console.error("[bridge] spawn error:", e); process.exit(1); });
} else if (process.stdin.isTTY) {
  mitm();
} else {
  stdioMode();
}
