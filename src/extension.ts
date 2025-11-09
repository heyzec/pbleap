import * as vscode from "vscode";

import { WalkerFactory } from "./walkers/base";
import { GoProvider, ProtoProvider } from "./providers";

// For stacktraces to show line numbers mapped from to typescript files (even on production builds)
require("source-map-support").install();

export function activate(context: vscode.ExtensionContext) {
  WalkerFactory.globalSetup(context.extensionPath);

  const disposables: vscode.Disposable[] = [];

  // We cannot use `provideDefinition: ProtoProvider.handleDefinition`
  // because extracting the method loses access to `this` (unlike python)
  const subscriptions = [
    vscode.languages.registerReferenceProvider(
      [{ language: "proto", scheme: "file" }, { pattern: "**/*.proto" }],
      {
        // provideReferences: handleProtoReference,
        provideReferences: (doc, pos) =>
          ProtoProvider.handleDefinition(doc, pos),
      }
    ),
    vscode.languages.registerDefinitionProvider(
      [{ language: "proto", scheme: "file" }, { pattern: "**/*.proto" }],
      {
        provideDefinition: (doc, pos) =>
          ProtoProvider.handleDefinition(doc, pos),
        // provideDefinition: () => []
        // TODO: Find another way to allow ctrl click, this is technically wrong
      }
    ),
    vscode.languages.registerDefinitionProvider(
      [{ language: "go", scheme: "file" }, { pattern: "**/*.go" }],
      {
        provideDefinition: (doc, pos) => GoProvider.handleDefinition(doc, pos),
      }
    ),
  ];

  disposables.push(...subscriptions);

  return disposables;
}
