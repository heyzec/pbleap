import * as vscode from "vscode";
import * as path from "path";

import { Parser, Language } from 'web-tree-sitter';
import type { Node } from "web-tree-sitter";

import { pascalToSnake } from "../utils/names";
import { getProtoFileFromGoFile } from "../utils/files";
import { getProtoField } from "./proto";
import { nodesToLocations } from "../utils/convert";
import { GoWalker, ProtoWalker } from "../walkers";
import { Provider } from "./base";
import { Walker } from "../walkers/base";

export let goParser: Parser;

class GoProvider extends Provider {
  getDualNode(thisNode: Node, thisWalker: Walker, thatWalker: Walker) {
    console.log(`In GoProvider.getDualNode, we convert pascalToSnake`);

    let node: Node | null = thisNode;
    if (!node || node.type !== "field_identifier") {
      console.log("Node is not field_identifier, found:", node?.type);
      return null
    }
    const fieldName = node.text;
    if (!fieldName) {
      console.log("No field name found");
      return null
    }
    // Assumption: We can always find struct containing field node = node.parent?.parent?.parent?.parent || null
    node = node?.parent?.parent?.parent?.parent ?? null;
    if (!node || node.type !== "type_spec") {
      console.log("Could not find enclosing type_spec for field:", fieldName);
      return null
    }
    const structName = node.child(0)?.text;
    if (!structName) {
      console.log("No struct name found for field:", fieldName);
      return null
    }

    const thatTree = thatWalker.getTree();
    if (!thatTree) {
      return null
    }

    console.log("Searching for field:", pascalToSnake(fieldName), "in message:", structName);
    const found = getProtoField(thatTree.rootNode, structName, pascalToSnake(fieldName));
    return found
  }
}

export default new GoProvider(GoWalker);

function getGoStruct(root: /*Node*/ any, structName: string): Node | null {
  let nodes = root.namedChildren.filter((node: any) => node.type === 'type_declaration')
  nodes = nodes.filter((node: any) => node.namedChildren[0].childForFieldName("name")?.text === structName);
  return nodes[0];
}

export function getGoField(root: Node, structName: string, fieldName: string): Node | null {
  const structNode = getGoStruct(root, structName);
  let nodes = structNode?.namedChildren[0]?.childForFieldName("type")?.namedChildren[0]?.namedChildren ?? [];
  nodes = nodes.map(node => node?.namedChildren.find(child => child?.type === "field_identifier") ?? null);
  nodes = nodes.filter(node => node?.text === fieldName);
  return nodes[0]
}

// export async function initGoParser(context: vscode.ExtensionContext) {
//   const parser = new Parser();
//   const Go = await Language.load(path.join(context.extensionPath, "dist", "tree-sitter-go.wasm"));
//   parser.setLanguage(Go);
//   goParser = parser;
// }
//
// export async function handleGoReference(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Location[]> {
//   console.log("Handling go reference for", document.uri.toString(), "at", position);
//   const walker1 = await GoWalker.ingest(document.getText());
//   const tree = walker1.getTree();
//   if (!tree) {
//     return []
//   }
//
//   const [r, c] = [position.line, position.character];
//   let node: Node | null = tree.rootNode.descendantForPosition({ row: r, column: c }, { row: r, column: c });
//
//   if (!node || node.type !== "field_identifier") {
//     console.log("Node is not field_identifier, found:", node?.type);
//     return []
//   }
//
//   const fieldName = node.text;
//   if (!fieldName) {
//     console.log("No field name found");
//     return []
//   }
//
//   // Assumption: We can always find struct containing field node = node.parent?.parent?.parent?.parent || null
//   node = node?.parent?.parent?.parent?.parent ?? null;
//   if (!node || node.type !== "type_spec") {
//     console.log("Could not find enclosing type_spec for field:", fieldName);
//     return []
//   }
//
//   const structName = node.child(0)?.text;
//   if (!structName) {
//     console.log("No struct name found for field:", fieldName);
//     return []
//   }
//
//   const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
//   if (!workspaceFolder) {
//     return []; // file is outside workspace
//   }
//   const goPath = path.relative(workspaceFolder.uri.fsPath, document.uri.fsPath)
//   const protoPath = getProtoFileFromGoFile(goPath);
//   if (!protoPath) {
//     vscode.window.showInformationMessage("No proto found for " + document.uri);
//     return [];
//   }
//
//   const protoFileUri = vscode.Uri.joinPath(workspaceFolder.uri, protoPath);
//   const protoFileDocument = await vscode.workspace.openTextDocument(protoFileUri); // Make it global for debugging
//
//   const walker = await ProtoWalker.ingest(protoFileDocument.getText());
//   const protoTree = walker.getTree()
//   if (!protoTree) {
//     return []
//   }
//   console.log("Searching for field:", pascalToSnake(fieldName), "in message:", structName);
//
//   const found = getProtoField(protoTree.rootNode, structName, pascalToSnake(fieldName));
//   return nodesToLocations([found], protoFileDocument);
// }
