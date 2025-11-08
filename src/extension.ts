import * as vscode from "vscode";
import * as path from "path";
import * as fs from 'fs';

let more = require("./more")

export function activate(context: vscode.ExtensionContext) {
  const disposables = more.realActivate(context);
  context.subscriptions.push(...disposables);

  let morePath = path.join(context.extensionPath, 'dist/more.js');

  console.log(`Watching for changes in ${morePath}`);
  fs.watchFile(morePath, { interval: 500 }, () => {
    console.log("more.js file changed, reloading...");

    delete require.cache[require.resolve(morePath)];
    more = require(morePath);

    context.subscriptions.forEach(disposable => disposable.dispose());

    const disposables = more.realActivate(context);
    context.subscriptions.push(...disposables);

    vscode.window.showInformationMessage("Reloaded more.js");
  });




}

// This method is called when your extension is deactivated
export function deactivate() {
  console.log("Deactivated Proto References Extension");
}
