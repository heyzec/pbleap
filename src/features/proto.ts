import * as vscode from "vscode";
import * as path from "path";

import { Parser, Language } from 'web-tree-sitter';
import type { Node } from "web-tree-sitter";

import { getGoFileFromProtoFile } from "../utils/files";
import { goParser, getGoField } from "./go";
import { snakeToPascal } from "../utils/names";
import { nodesToLocations } from "../utils/convert";


function getProtoStruct(root: Node, structName: string) {
  let nodes = root.namedChildren;
  nodes = nodes.filter(node => node?.type === 'message')
  nodes = nodes.filter(node => node?.child(1)?.text === structName);
  return nodes[0];
}

export function getProtoField(root: Node, structName: string, fieldName: string): Node | null {
  const structNode = getProtoStruct(root, structName);
  let nodes = structNode?.child(2)?.namedChildren ?? [];
  nodes = nodes.filter(node => node?.type === 'field');
  nodes = nodes.map(node => node?.child(2) ?? null);
  return nodes.find(node => node?.text === fieldName) ?? null;
}


export let protoParser: Parser;

export async function initProtoParser(context: vscode.ExtensionContext) {
  const parser = new Parser();
  const Proto = await Language.load(path.join(context.extensionPath, "dist", "tree-sitter-proto.wasm"));
  parser.setLanguage(Proto);
  protoParser = parser;
}


export async function handleProtoReference(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Location[]> {
  const protoTree = protoParser.parse(document.getText());

  const [r, c] = [position.line, position.character];

  let node = protoTree?.rootNode.descendantForPosition({ row: r, column: c }, { row: r, column: c });
  const identifierName = node?.text;
  if (!node || !node.type || node.type !== "identifier" || !identifierName) {
    vscode.window.showInformationMessage(`Only supported on identifier, found ${node?.type}`);
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
  const protoPath = path.relative(workspaceFolder.uri.fsPath, document.uri.fsPath)
  const goPath = getGoFileFromProtoFile(protoPath);
  if (!goPath) {
    vscode.window.showInformationMessage(`No mapping found for ${protoPath} to Go file.`);
    return [];
  }

  const goFileUri = vscode.Uri.joinPath(workspaceFolder.uri, goPath);
  const goFileDocument = await vscode.workspace.openTextDocument(goFileUri);
  console.log("Going to parse!!!!")
  // console.log("Go file text:", goFileDocument.getText().slice(0, 200)); // Log first 200 characters
  const goTree = goParser.parse(goFileDocument.getText());
  if (!goTree) {
    return []
  }

  console.log("Searching for field:", snakeToPascal(identifierName), "in message:", messageName);
  const found = getGoField(goTree.rootNode, messageName, snakeToPascal(identifierName));
  console.log("Found Go field node:", found?.toString());

  return nodesToLocations([found], goFileDocument);
}
