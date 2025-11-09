import * as vscode from "vscode";
import * as path from "path";

import type { Node } from "web-tree-sitter";

import { Walker, WalkerFactory } from "../walkers/base";
import { getPartnerFile } from "../utils/files";
import { GoWalker, ProtoWalker } from "../walkers";
import { nodesToLocations } from "../utils/convert";

function getLanguageId(filename: string): string | null {
  if (filename.endsWith(".pb.go")) {
    return "go";
  }
  if (filename.endsWith(".proto")) {
    return "proto";
  }
  return null;
}

function getWalkerFactory(languageId: string): WalkerFactory | null {
  const walkerMap = {
    proto: ProtoWalker,
    go: GoWalker,
  };
  return walkerMap[languageId as keyof typeof walkerMap] || null;
}

export class Provider {
  thisWalkerFactory: WalkerFactory;

  constructor(walker: WalkerFactory) {
    this.thisWalkerFactory = walker;
  }

  async handleDefinition(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.Location[]> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) {
      vscode.window.showInformationMessage(`No workspace found.`);
      return [];
    }

    const thisPath = path.relative(
      workspaceFolder.uri.fsPath,
      document.uri.fsPath
    );
    const partnerPath = getPartnerFile(thisPath);
    if (!partnerPath) {
      vscode.window.showInformationMessage(
        `No mapping found for ${thisPath} to partner file.`
      );
      return [];
    }

    // 1. This walker
    const thisDocument = document;
    const thisText = thisDocument.getText();
    const thisWalker = this.thisWalkerFactory.ingest(thisText);
    console.log(thisDocument.languageId);

    const [r, c] = [position.line, position.character];
    const thisTree = thisWalker.getTree();
    let thisNode = thisTree?.rootNode.descendantForPosition(
      { row: r, column: c },
      { row: r, column: c }
    );
    if (!thisNode) {
      return [];
    }

    // 2. That walker
    const thatUri = vscode.Uri.joinPath(workspaceFolder.uri, partnerPath);
    const thatDocument = await vscode.workspace.openTextDocument(thatUri);
    const thatText = thatDocument.getText();

    const partnerLang = getLanguageId(partnerPath);
    if (!partnerLang) {
      vscode.window.showInformationMessage(
        `Unsupported partner file type for ${partnerPath}.`
      );
      return [];
    }
    const thatWalkerFactory = getWalkerFactory(partnerLang);
    if (!thatWalkerFactory) {
      vscode.window.showInformationMessage(
        `No walker found for language ${partnerLang}.`
      );
      return [];
    }
    const thatWalker = thatWalkerFactory.ingest(thatText);

    const dualNode = this.getDualNode(thisNode, thisWalker, thatWalker);

    if (!dualNode) {
      return [];
    }

    return nodesToLocations([dualNode], thatDocument);
  }

  async handleReference(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.Location[]> {
    return [];
  }

  getDualNode(thisNode: Node, thisWalker: Walker, thatWalker: Walker) {
    const route = thisWalker.getRoute(thisNode);
    return thatWalker.getNode(route);
  }
}
