import * as vscode from "vscode";

import { Parser, Language } from "web-tree-sitter";

import { initGoParser, handleGoReference } from "./features/go";
import { initProtoParser, handleProtoReference } from "./features/proto";

// For stacktraces to show line numbers mapped from to typescript files (even on production builds)
require("source-map-support").install();

export function activate(context: vscode.ExtensionContext) {
  Parser.init()
    .then(() => {
      initProtoParser(context);
      initGoParser(context);
    })
    .catch((err) => {
      console.error("Failed to initialize parsers:", err);
    });

  const disposables: vscode.Disposable[] = [];

  const subscriptions = [
    vscode.languages.registerReferenceProvider(
      [{ language: "proto", scheme: "file" }, { pattern: "**/*.proto" }],
      {
        provideReferences: handleProtoReference,
      }
    ),
    vscode.languages.registerDefinitionProvider(
      [{ language: "proto", scheme: "file" }, { pattern: "**/*.proto" }],
      {
        provideDefinition: handleProtoReference,
        // provideDefinition: () => []
        // TODO: Find another way to allow ctrl click, this is technically wrong
      }
    ),
    vscode.languages.registerDefinitionProvider(
      [{ language: "go", scheme: "file" }, { pattern: "**/*.go" }],
      {
        provideDefinition: handleGoReference,
      }
    ),
  ];

  disposables.push(...subscriptions);

  return disposables.map((d) => ({
    dispose: () => {
      console.log("Disposable.dispose() called!");
      d.dispose();
    },
  }));
}
