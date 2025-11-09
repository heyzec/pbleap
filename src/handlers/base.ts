import * as vscode from "vscode";
import * as path from "path";

import type { Node } from "web-tree-sitter";

import { Walker, WalkerFactory } from "../walkers/base";
import { getPartnerFile } from "../utils/files";
import { GoWalker, ProtoWalker } from "../walkers";
import { nodesToLocations } from "../utils/convert";

export abstract class Provider {
  thisWalkerFactory: WalkerFactory;

  constructor(walker: WalkerFactory) {
    this.thisWalkerFactory = walker
  }

  async handleDefinition(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Location[]> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) {
      vscode.window.showInformationMessage(`No workspace found.`);
      return [];
    }

    const thisPath = path.relative(workspaceFolder.uri.fsPath, document.uri.fsPath)
    const partnerPath = getPartnerFile(thisPath);
    if (!partnerPath) {
      vscode.window.showInformationMessage(`No mapping found for ${thisPath} to partner file.`);
      return [];
    }

    // 1. This walker
    const thisDocument = document
    const thisText = thisDocument.getText();
    const thisWalker = this.thisWalkerFactory.ingest(thisText)

    const [r, c] = [position.line, position.character];
    const thisTree = thisWalker.getTree();
    let thisNode = thisTree?.rootNode.descendantForPosition({ row: r, column: c }, { row: r, column: c });
    if (!thisNode) {
      return [];
    }

    // 2. That walker
    const thatUri = vscode.Uri.joinPath(workspaceFolder.uri, partnerPath);
    const thatDocument = await vscode.workspace.openTextDocument(thatUri);
    const thatText = thatDocument.getText();
    let thatWalkerFactory: WalkerFactory
    if (partnerPath.endsWith('.go')) {
      thatWalkerFactory = GoWalker
    } else if (partnerPath.endsWith('.proto')) {
      thatWalkerFactory = ProtoWalker
    } else {
      vscode.window.showInformationMessage(`Unsupported partner file type for ${partnerPath}.`);
      return [];
    }
    const thatWalker = thatWalkerFactory.ingest(thatText)

    const dualNode = this.getDualNode(thisNode, thisWalker, thatWalker);

    return nodesToLocations([dualNode], thatDocument)
  }

  async handleReference(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Location[]> {
    return [];
  }

  abstract getDualNode(thisNode: Node, thisWalker: Walker, thatWalker: Walker): Node | null;
}

