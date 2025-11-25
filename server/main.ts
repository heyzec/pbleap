import { run } from "./lsp";
import { mitm } from "./mitm";
import { Shim } from "./shims/base";

// For stacktraces to show line numbers mapped from to typescript files (even on production builds)
require("source-map-support").install();

if (process.argv[0].endsWith("code")) {
  // VS Code is running this script with internal Node
  run();
} else {
  const shim = new Shim()
  const exitCode = shim.handleCli()
  if (exitCode) {
    process.exit(exitCode)
  }
  mitm();
}
