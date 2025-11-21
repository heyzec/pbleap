import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { spawn, ChildProcess } from "child_process";

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

// For stacktraces to show line numbers mapped from to typescript files (even on production builds)
require("source-map-support").install();

let client: LanguageClient;

function installGoplsShim(context: vscode.ExtensionContext) {
  const dest = path.join(os.homedir(), ".config", "pbleap", "gopls");
  const mainJs = context.asAbsolutePath(path.join("shim", "dist", "main.js"));
  const template = fs.readFileSync(context.asAbsolutePath("gopls.template"), "utf8");
  const script = template.replace("@MAIN_JS@", mainJs);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, script, { mode: 0o755 });
}

function startShimDaemon(context: vscode.ExtensionContext): ChildProcess {
  const mainJs = context.asAbsolutePath(path.join("shim", "dist", "main.js"));
  const alternateTools = vscode.workspace.getConfiguration("go").get<Record<string, string>>("alternateTools") ?? {};
  const spawnArgs = [mainJs, "--daemon"];
  if (alternateTools["go"]) spawnArgs.push("--go-binary", alternateTools["go"]);
  console.error(`[pbleap] spawning shim daemon: node ${spawnArgs.join(" ")}`);
  const daemon = spawn("node", spawnArgs, {
    stdio: "ignore",
    detached: false,
  });
  console.error(`[pbleap] shim daemon pid: ${daemon.pid}`);
  daemon.on("exit", (code) => {
    console.error(`[pbleap] shim daemon exited with code ${code}`);
  });
  return daemon;
}

export function activate(context: vscode.ExtensionContext) {
  installGoplsShim(context);
  const daemon = startShimDaemon(context);
  // The server is implemented in node
  let serverModule = context.asAbsolutePath(
    path.join("server", "dist", "main.js")
  );
  // The debug options for the server
  // --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
  let debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };

  let serverOptions: ServerOptions = {
    // Used if extension launched normally
    run: {
      module: serverModule,
      transport: TransportKind.ipc,
    },
    // Used if extension launched in debug mode
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
    args: ["--go"],
  };

  const protoGenMapping =
    vscode.workspace
      .getConfiguration("pbleap")
      .get<{ [key: string]: string }>("protoGenMapping") || {};

  // Options to control the language client
  let clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    documentSelector: [
      { scheme: "file", language: "go" },
      { scheme: "file", language: "proto" },
    ],
    initializationOptions: { protoGenMapping },
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    "pbLeapLs",
    "PBLeap Language Server",
    serverOptions,
    clientOptions
  );

  // Start the client. This will also launch the server
  client.start();

  fs.watchFile(serverModule, () => {
    vscode.window.showInformationMessage(`Reloaded PBLeap language server!`);
    client.restart();
  });

  return [
    vscode.Disposable.from({
      dispose: () => {
        daemon.kill();
        if (client) {
          client.stop();
        }
      },
    }),
  ];
}
