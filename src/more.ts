import * as vscode from "vscode";
import * as path from "path";

import { Parser, Language } from 'web-tree-sitter';
import type { Node } from "web-tree-sitter";

const mapping = {
  "scripts/model/model.proto": "model/model.pb.go",
}

function getGoFileFromProtoFile(protoPath: string): string | undefined {
  return mapping[protoPath];
}

function getStruct(root: Node, structName: string) {
  let nodes = root.namedChildren.filter(node => node.type === 'type_declaration')
  nodes = nodes.filter(node => node.namedChildren[0].childForFieldName("name")?.text === structName);
  return nodes[0];
}

function nodesToLocations(nodes: Node[], document: vscode.TextDocument): vscode.Location[] {
  return nodes.map(node => {
    const startPos = new vscode.Position(node.startPosition.row, node.startPosition.column);
    const endPos = new vscode.Position(node.endPosition.row, node.endPosition.column);
    const range = new vscode.Range(startPos, endPos);
    return new vscode.Location(document.uri, range);
  })
}

function getField(root: Node, structName: string, fieldName: string) {
  const structNode = getStruct(root, structName);
  let nodes = structNode.namedChildren[0].childForFieldName("type").namedChildren[0].namedChildren;
  nodes = nodes.map(node => node.namedChildren.find(child => child.type === "field_identifier"))
  nodes = nodes.filter(node => node.text === fieldName);
  return nodes[0]
}

async function highlightNodes(nodes: Node[], doc: vscode.TextDocument) {
  const COLORS = ["#1A2238", "#2B1A33", "#14281D"]


  const editor = await vscode.window.showTextDocument(doc);
  nodes.forEach((node, index) => {
    const startPos = new vscode.Position(node.startPosition.row, node.startPosition.column);
    const endPos = new vscode.Position(node.endPosition.row, node.endPosition.column);
    const range = new vscode.Range(startPos, endPos);
    const dec = vscode.window.createTextEditorDecorationType({
      backgroundColor: COLORS[index % COLORS.length],
    })
    editor.setDecorations(dec, [range]);
  })
}

function printNode(node: any, indent = 0) {
  const output = []
  function recurse(node: any, indent = 0) {
    const padding = '  '.repeat(indent);
    let info = node.type;
    if (node.namedChildCount === 0) {
      // leaf node: show text if short
      const text = node.text.replace(/\s+/g, ' ');
      if (text.length < 30) info += `: "${text}"`;
    }
    output.push(padding + info);

    for (const child of node.namedChildren) {
      recurse(child, indent + 1);
    }
  }
  recurse(node, indent);
  console.log(output.join('\n'));
}

function snakeToPascal(s: string): string {
  return s
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}


let protoParser: Parser;
let goParser: Parser;

async function initProtoParser(context: vscode.ExtensionContext) {
  const parser = new Parser();
  const Proto = await Language.load(path.join(context.extensionPath, "dist", "tree-sitter-proto.wasm"));
  parser.setLanguage(Proto);
  protoParser = parser;
}

async function initGoParser(context: vscode.ExtensionContext) {
  const parser = new Parser();
  const Go = await Language.load(path.join(context.extensionPath, "dist", "tree-sitter-go.wasm"));
  parser.setLanguage(Go);
  goParser = parser;
}

async function handleGoReference(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Location[]> {
  const goTree = goParser.parse(document.getText());
  console.log("Go tree pased:", goTree.rootNode !== null);

  const startPos = new vscode.Position(10, 1);
  const endPos = new vscode.Position(10, 10);
  // const startPos = new vscode.Position(position.line, position.character);
  // const endPos = new vscode.Position(position.line, position.character + 1);
  const range = new vscode.Range(startPos, endPos);

  const output = [new vscode.Location(document.uri, range)];
  console.log("Output locations:", output);
  return output;
}

async function handleProtoReference(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Location[]> {
  console.log("In handleProtoReference");
  const protoTree = protoParser.parse(document.getText());

  const r = position.line
  const c = position.character

  let node = protoTree.rootNode.descendantForPosition({ row: r, column: c }, { row: r, column: c });
  const identifierName = node.text;
  if (node.type !== "identifier") {
    vscode.window.showInformationMessage(`Only supported on identifier, found ${node.type}`);
    return [];
  }






  // Assumption: We can always find message containing identifier
  while (node.type !== "message") {
    node = node.parent;
  }

  highlightNodes(node.children, document);
  const messageName = node.child(1).text;

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (!workspaceFolder) {
    return undefined; // file is outside workspace
  }
  const protoPath = path.relative(workspaceFolder.uri.fsPath, document.uri.fsPath)
  const goPath = getGoFileFromProtoFile(protoPath);
  if (!goPath) {
    vscode.window.showInformationMessage("No maing found for " + document.uri);
    return [];
  }

  const goFileUri = vscode.Uri.joinPath(workspaceFolder.uri, goPath);
  const goFileDocument = await vscode.workspace.openTextDocument(goFileUri);
  console.log("Going to parse!!!!")
  // console.log("Go file text:", goFileDocument.getText().slice(0, 200)); // Log first 200 characters
  const goTree = goParser.parse(goFileDocument.getText());
  console.log("Is goTree valid?", goTree.rootNode !== null);

  console.log("Searching for field:", snakeToPascal(identifierName), "in message:", messageName);
  const found = getField(goTree.rootNode, messageName, snakeToPascal(identifierName));
  console.log("Found Go field node:", found?.toString());

  return nodesToLocations([found], goFileDocument);
}

function realActivate(context: vscode.ExtensionContext) {
  vscode.window.showInformationMessage("LOL2");


  console.log("Registering URI handler for reload...");
  // TODO: Move to extension.ts
  // vscode.window.registerUriHandler({
  //   handleUri(uri: vscode.Uri) {
  //     vscode.commands.executeCommand("workbench.action.reloadWindow")
  //   }
  // })
  console.log("URI handler registered.");

  console.log("Initializing parsers...");
  Parser.init().then(() => {
    initProtoParser(context)
    initGoParser(context)
  }).catch(err => {
    console.error("Failed to initialize parsers:", err);
  });

  const disposables: vscode.Disposable[] = [];

  const subscriptions = [
    vscode.languages.registerReferenceProvider([
      { language: "proto", scheme: "file" },
      { pattern: "**/*.proto" }
    ], {
      provideReferences: handleProtoReference
    }),
    vscode.languages.registerDefinitionProvider([
      { language: "proto", scheme: "file" },
      { pattern: "**/*.proto" }
    ], {
      provideDefinition: handleProtoReference
    }),
    vscode.languages.registerDefinitionProvider([
      { language: "go", scheme: "file" },
      { pattern: "**/*.go" }
    ], {
      provideDefinition: handleGoReference
    }),
  ]

  console.log("Subscriptions created:", subscriptions.length);
  disposables.push(...subscriptions);

  return disposables.map(d => ({
    dispose: () => {
      console.log('Disposable.dispose() called!');
      d.dispose();
    }
  }));
}

export { realActivate };
