import * as vscode from "vscode";
import * as path from "path";
import * as fs from 'fs';

interface Extension {
  activate(context: vscode.ExtensionContext): vscode.Disposable[];
}

let ext: Extension = require("./extension");

export function activate(context: vscode.ExtensionContext) {
  vscode.window.registerUriHandler({
    handleUri(uri: vscode.Uri) {
      console.log("===")
      console.log(uri.path)
      vscode.commands.executeCommand("workbench.action.reloadWindow")
    }
  })

  const disposables = ext.activate(context);
  context.subscriptions.push(...disposables);

  const extPath = path.join(context.extensionPath, 'dist', 'extension.js');

  console.log(`Watching for changes in ${extPath}`);
  fs.watchFile(extPath, () => {
    delete require.cache[require.resolve(extPath)];
    ext = require(extPath);

    context.subscriptions.forEach(disposable => disposable.dispose());

    const disposables = ext.activate(context);
    context.subscriptions.push(...disposables);

    vscode.window.showInformationMessage("Reloaded extension!");
  });
}

export function deactivate() { }
