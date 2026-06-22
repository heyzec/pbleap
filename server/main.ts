import { run } from "./lsp";
import { mitm } from "./mitm";

// For stacktraces to show line numbers mapped from to typescript files (even on production builds)
require("source-map-support").install();

if (process.argv[0].endsWith("code")) {
  // VS Code is running this script with internal Node
  run();
} else {
  mitm();
}
