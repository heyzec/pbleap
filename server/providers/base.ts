import * as path from "path";
import { Location, Position } from "vscode-languageserver-types";
import * as fs from "fs/promises";

import type { Node } from "web-tree-sitter";

import { Walker, WalkerFactory } from "../walkers/base";
import { getPartnerFile } from "../utils/files";
import { GoWalker, ProtoWalker } from "../walkers";
import { getLanguageId, nodesToLocations } from "../utils/convert";

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
    workspacePath: string,
    documentPath: string,
    position: Position
  ): Promise<Location[]> {
    if (!workspacePath) {
      console.log(`No workspace found.`);
      return [];
    }

    console.log(
      `Handling definition for ${documentPath} with workspace ${workspacePath}`
    );
    const thisPath = path.relative(workspacePath, documentPath);
    const partnerPath = getPartnerFile(thisPath);
    if (!partnerPath) {
      console.log(`No mapping found for ${thisPath} to partner file.`);
      return [];
    }
    console.log(partnerPath);

    // 1. This walker
    const thisText = await fs.readFile(
      path.join(workspacePath, thisPath),
      "utf8"
    );
    const thisWalker = this.thisWalkerFactory.ingest(thisText);

    const [r, c] = [position.line, position.character];
    const thisTree = thisWalker.getTree();
    let thisNode = thisTree?.rootNode.descendantForPosition(
      { row: r, column: c },
      { row: r, column: c }
    );
    if (!thisNode) {
      return [];
    }

    console.log("That walk");
    // 2. That walker
    const thatPath = path.join(workspacePath, partnerPath);
    const thatText = await fs.readFile(thatPath, "utf8");

    const partnerLang = getLanguageId(partnerPath);
    if (!partnerLang) {
      console.log(`Unsupported partner file type for ${partnerPath}.`);
      return [];
    }
    const thatWalkerFactory = getWalkerFactory(partnerLang);
    if (!thatWalkerFactory) {
      console.log(`No walker found for language ${partnerLang}.`);
      return [];
    }

    const thatWalker = thatWalkerFactory.ingest(thatText);
    const dualNode = this.getDualNode(thisNode, thisWalker, thatWalker);

    if (!dualNode) {
      return [];
    }

    return nodesToLocations([dualNode], thatPath);
  }

  // async handleReference(
  //   document: vscode.TextDocument,
  //   position: .Position
  // ): Promise<vscode.Location[]> {
  //   return [];
  // }

  getDualNode(thisNode: Node, thisWalker: Walker, thatWalker: Walker) {
    const route = thisWalker.getRoute(thisNode);
    console.debug("Computed route:", route);
    return thatWalker.getNode(route);
  }
}
