import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

// For stacktraces to show line numbers mapped from to typescript files (even on production builds)
require("source-map-support").install();

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
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
        if (client) {
          client.stop();
        }
      },
    }),
  ];
}
