import { spawn } from "node:child_process";
import { run, resolveGopls } from "./shim";
import { stdioMode } from "./proxy";

require("source-map-support").install();

const args = process.argv.slice(2);

if (args.includes("--daemon")) {
  const goBinaryIdx = args.indexOf("--go-binary");
  const goBinary = goBinaryIdx !== -1 ? args[goBinaryIdx + 1] : undefined;
  run(goBinary);
} else {
  const subcommand = args.find((a) => !a.startsWith("-"));
  const isCliFlag = args.includes("--version") || args.includes("--help");
  if (subcommand || isCliFlag) {
    // CLI invocation (e.g. version, bug) — forward to real gopls
    const cp = spawn(resolveGopls(), args, { stdio: "inherit" });
    cp.on("exit", (code) => process.exit(code ?? 0));
    cp.on("error", (e) => { console.error("[shim] spawn error:", e); process.exit(1); });
  } else {
    stdioMode();
  }
}
