import * as vscode from "vscode";
import * as path from "path";

import { Parser, Language } from "web-tree-sitter";
import type { Node } from "web-tree-sitter";

// For stacktraces to show line numbers mapped from to typescript files (even on production builds)
require("source-map-support").install();

// TODO: SHouldn be dynamic
const mapping =
  vscode.workspace
    .getConfiguration("untitled")
    .get<{ [key: string]: string }>("protoGenMapping") || {};

let protoFileDocument;

function getGoFileFromProtoFile(protoPath: string): string | undefined {
  return mapping[protoPath];
}

function getProtoFileFromGoFile(goPath: string): string | undefined {
  for (const [proto, go] of Object.entries(mapping)) {
    if (go === goPath) {
      return proto;
    }
  }
}

function nodesToLocations(
  nodes: /*(Node | null)[]*/ any,
  document: vscode.TextDocument
): vscode.Location[] {
  return nodes.map((node: any) => {
    const startPos = new vscode.Position(
      node.startPosition.row,
      node.startPosition.column
    );
    const endPos = new vscode.Position(
      node.endPosition.row,
      node.endPosition.column
    );
    const range = new vscode.Range(startPos, endPos);
    return new vscode.Location(document.uri, range);
  });
}

function getGoStruct(root: /*Node*/ any, structName: string): Node | null {
  let nodes = root.namedChildren.filter(
    (node: any) => node.type === "type_declaration"
  );
  nodes = nodes.filter(
    (node: any) =>
      node.namedChildren[0].childForFieldName("name")?.text === structName
  );
  return nodes[0];
}

function getGoField(
  root: Node,
  structName: string,
  fieldName: string
): Node | null {
  const structNode = getGoStruct(root, structName);
  let nodes =
    structNode?.namedChildren[0]?.childForFieldName("type")?.namedChildren[0]
      ?.namedChildren ?? [];
  nodes = nodes.map(
    (node) =>
      node?.namedChildren.find((child) => child?.type === "field_identifier") ??
      null
  );
  nodes = nodes.filter((node) => node?.text === fieldName);
  return nodes[0];
}

function getProtoStruct(root: Node, structName: string) {
  let nodes = root.namedChildren;
  nodes = nodes.filter((node) => node?.type === "message");
  nodes = nodes.filter((node) => node?.child(1)?.text === structName);
  return nodes[0];
}

function getProtoField(
  root: Node,
  structName: string,
  fieldName: string
): Node | null {
  const structNode = getProtoStruct(root, structName);
  let nodes = structNode?.child(2)?.namedChildren ?? [];
  nodes = nodes.filter((node) => node?.type === "field");
  nodes = nodes.map((node) => node?.child(2) ?? null);
  return nodes.find((node) => node?.text === fieldName) ?? null;
}

async function highlightNodes(nodes: Node[], doc: vscode.TextDocument) {
  // hsl(x 100% 25%)
  // x =          0deg       90deg      180deg     270deg
  const COLORS = ["#800000", "#408000", "#008080", "#400080"];
  const editor = await vscode.window.showTextDocument(doc);
  nodes.forEach((node, index) => {
    const startPos = new vscode.Position(
      node.startPosition.row,
      node.startPosition.column
    );
    const endPos = new vscode.Position(
      node.endPosition.row,
      node.endPosition.column
    );
    const range = new vscode.Range(startPos, endPos);
    const dec = vscode.window.createTextEditorDecorationType({
      backgroundColor: COLORS[index % COLORS.length],
    });
    editor.setDecorations(dec, [range]);
  });
}

function printNode(node: any, indent = 0) {
  const output: string[] = [];
  function recurse(node: any, indent = 0) {
    const padding = "  ".repeat(indent);
    let info = node.type;
    if (node.namedChildCount === 0) {
      // leaf node: show text if short
      const text = node.text.replace(/\s+/g, " ");
      if (text.length < 30) info += `: "${text}"`;
    }
    output.push(padding + info);

    for (const child of node.namedChildren) {
      recurse(child, indent + 1);
    }
  }
  recurse(node, indent);
  console.log(output.join("\n"));
}

function snakeToPascal(s: string): string {
  return s
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}

function pascalToSnake(s: string): string {
  return s
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");
}

let protoParser: Parser;
let goParser: Parser;

async function initProtoParser(context: vscode.ExtensionContext) {
  const parser = new Parser();
  const Proto = await Language.load(
    path.join(context.extensionPath, "dist", "tree-sitter-proto.wasm")
  );
  parser.setLanguage(Proto);
  protoParser = parser;
}

async function initGoParser(context: vscode.ExtensionContext) {
  const parser = new Parser();
  const Go = await Language.load(
    path.join(context.extensionPath, "dist", "tree-sitter-go.wasm")
  );
  parser.setLanguage(Go);
  goParser = parser;
}

async function handleGoReference(
  document: vscode.TextDocument,
  position: vscode.Position
): Promise<vscode.Location[]> {
  const tree = goParser.parse(document.getText());
  if (!tree) {
    return [];
  }

  const [r, c] = [position.line, position.character];
  let node: Node | null = tree.rootNode.descendantForPosition(
    { row: r, column: c },
    { row: r, column: c }
  );

  if (!node || node.type !== "field_identifier") {
    return [];
  }

  const fieldName = node.text;
  if (!fieldName) {
    return [];
  }

  // Assumption: We can always find struct containing field
  node = node.parent?.parent?.parent?.parent || null;
  if (!node || node.type !== "type_spec") {
    return [];
  }

  const structName = node.child(0)?.text;
  if (!structName) {
    return [];
  }

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (!workspaceFolder) {
    return []; // file is outside workspace
  }
  const goPath = path.relative(workspaceFolder.uri.fsPath, document.uri.fsPath);
  const protoPath = getProtoFileFromGoFile(goPath);
  if (!protoPath) {
    vscode.window.showInformationMessage("No proto found for " + document.uri);
    return [];
  }

  const protoFileUri = vscode.Uri.joinPath(workspaceFolder.uri, protoPath);
  /* const */ protoFileDocument =
    await vscode.workspace.openTextDocument(protoFileUri); // Make it global for debugging

  const protoTree = protoParser.parse(protoFileDocument.getText());
  if (!protoTree) {
    return [];
  }
  console.log(
    "Searching for field:",
    pascalToSnake(fieldName),
    "in message:",
    structName
  );

  const found = getProtoField(
    protoTree.rootNode,
    structName,
    pascalToSnake(fieldName)
  );
  return nodesToLocations([found], protoFileDocument);
}

async function handleProtoReference(
  document: vscode.TextDocument,
  position: vscode.Position
): Promise<vscode.Location[]> {
  const protoTree = protoParser.parse(document.getText());

  const [r, c] = [position.line, position.character];

  let node = protoTree?.rootNode.descendantForPosition(
    { row: r, column: c },
    { row: r, column: c }
  );
  const identifierName = node?.text;
  if (!node || !node.type || node.type !== "identifier" || !identifierName) {
    vscode.window.showInformationMessage(
      `Only supported on identifier, found ${node?.type}`
    );
    return [];
  }

  // Assumption: We can always find message containing identifier
  while (node?.type !== "message") {
    node = node?.parent;
  }

  const messageName = node?.child(1)?.text;
  if (!messageName) {
    return []; // file is outside workspace
  }

  const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
  if (!workspaceFolder) {
    return []; // file is outside workspace
  }
  const protoPath = path.relative(
    workspaceFolder.uri.fsPath,
    document.uri.fsPath
  );
  const goPath = getGoFileFromProtoFile(protoPath);
  if (!goPath) {
    vscode.window.showInformationMessage("No maing found for " + document.uri);
    return [];
  }

  const goFileUri = vscode.Uri.joinPath(workspaceFolder.uri, goPath);
  const goFileDocument = await vscode.workspace.openTextDocument(goFileUri);
  console.log("Going to parse!!!!");
  // console.log("Go file text:", goFileDocument.getText().slice(0, 200)); // Log first 200 characters
  const goTree = goParser.parse(goFileDocument.getText());
  if (!goTree) {
    return [];
  }

  console.log(
    "Searching for field:",
    snakeToPascal(identifierName),
    "in message:",
    messageName
  );
  const found = getGoField(
    goTree.rootNode,
    messageName,
    snakeToPascal(identifierName)
  );
  console.log("Found Go field node:", found?.toString());

  return nodesToLocations([found], goFileDocument);
}

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
