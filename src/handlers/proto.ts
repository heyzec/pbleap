import * as vscode from "vscode";
import * as path from "path";

import { Parser, Language } from 'web-tree-sitter';
import type { Node } from "web-tree-sitter";

import { getGoFileFromProtoFile } from "../utils/files";
import { goParser, getGoField } from "./go";
import { snakeToPascal } from "../utils/names";
import { nodesToLocations } from "../utils/convert";
import { GoWalker, ProtoWalker } from "../walkers";
import { Provider } from "./base";
import { Walker } from "../walkers/base";

class ProtoProvider extends Provider {
  getDualNode(thisNode: Node, thisWalker: Walker, thatWalker: Walker) {
    console.log(`In ProtoProvider.getDualNode, we convert snakeToPascal`);

    let node: Node | null = thisNode;
    const fieldName = node?.text;
    if (!node || !node.type || node.type !== "identifier" || !fieldName) {
      vscode.window.showInformationMessage(`Only supported on identifier, found ${node?.type}`);
      return null;
    }
    // Assumption: We can always find message containing identifier
    while (node?.type !== "message") {
      node = node?.parent ?? null;
      if (!node) {
        console.log("Failure 0")
        return null
      }
    }
    const structName = node?.child(1)?.text;
    if (!structName) {
      console.log("Failure 1")
      return null
    }
    const thatTree = thatWalker.getTree();
    if (!thatTree) {
      console.log("Failure 2")
      return null
    }

    const found = getGoField(thatTree.rootNode, structName, snakeToPascal(fieldName));
    if (!found) {
      console.log("Failure 2")
      return null
    }

    return found
    // return nodesToLocations([found], goFileDocument);
  }
}

export default new ProtoProvider(ProtoWalker);

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


// export let protoParser: Parser;
//
// export async function initProtoParser(context: vscode.ExtensionContext) {
//   const parser = new Parser();
//   const Proto = await Language.load(path.join(context.extensionPath, "dist", "tree-sitter-proto.wasm"));
//   parser.setLanguage(Proto);
//   protoParser = parser;
// }
//
//
// export async function handleProtoReference(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Location[]> {
//   const walker1 = await ProtoWalker.ingest(document.getText());
//   const protoTree = walker1.getTree();
//
//   const [r, c] = [position.line, position.character];
//
//   let node = protoTree?.rootNode.descendantForPosition({ row: r, column: c }, { row: r, column: c });
//   const identifierName = node?.text;
//   if (!node || !node.type || node.type !== "identifier" || !identifierName) {
//     vscode.window.showInformationMessage(`Only supported on identifier, found ${node?.type}`);
//     return [];
//   }
//
//   // Assumption: We can always find message containing identifier
//   while (node?.type !== "message") {
//     node = node?.parent;
//   }
//
//   const messageName = node?.child(1)?.text;
//   if (!messageName) {
//     return []; // file is outside workspace
//   }
//
//   const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
//   if (!workspaceFolder) {
//     return []; // file is outside workspace
//   }
//   const protoPath = path.relative(workspaceFolder.uri.fsPath, document.uri.fsPath)
//   const goPath = getGoFileFromProtoFile(protoPath);
//   if (!goPath) {
//     vscode.window.showInformationMessage(`No mapping found for ${protoPath} to Go file.`);
//     return [];
//   }
//
//   const goFileUri = vscode.Uri.joinPath(workspaceFolder.uri, goPath);
//   const goFileDocument = await vscode.workspace.openTextDocument(goFileUri);
//   console.log("Going to parse!!!!")
//   const walker2 = await GoWalker.ingest(goFileDocument.getText());
//   const goTree = walker2.getTree();
//   if (!goTree) {
//     return []
//   }
//
//   console.log("Searching for field:", snakeToPascal(identifierName), "in message:", messageName);
//   const found = getGoField(goTree.rootNode, messageName, snakeToPascal(identifierName));
//   console.log("Found Go field node:", found?.toString());
//
//   return nodesToLocations([found], goFileDocument);
// }
