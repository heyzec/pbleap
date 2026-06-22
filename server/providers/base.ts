import * as path from "path";
import { Location, Position } from "vscode-languageserver-types";
import * as fs from "fs/promises";

import type { Node } from "web-tree-sitter";

import { Walker, WalkerFactory } from "../walkers/base";
import { getPartnerFile } from "../utils/files";
import { GoWalker, ProtoWalker } from "../walkers";
import { getLanguageId, nodesToLocations } from "../utils/convert";
import { Shim } from "../shims/base";

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

  private async resolveDualNode(
    workspacePath: string,
    documentPath: string,
    position: Position
  ): Promise<{ dualNode: Node; partnerAbsPath: string } | null> {
    if (!workspacePath) {
      console.log(`No workspace found.`);
      return null;
    }

    console.log(`Resolving dual node for ${documentPath} at ${position.line}:${position.character}`);

    const thisPath = path.relative(workspacePath, documentPath);
    const partnerPath = getPartnerFile(thisPath);
    if (!partnerPath) {
      console.log(`No mapping found for ${thisPath} to partner file.`);
      return null;
    }

    const thisText = await fs.readFile(path.join(workspacePath, thisPath), "utf8");
    const thisWalker = this.thisWalkerFactory.ingest(thisText);

    const [r, c] = [position.line, position.character];
    const thisTree = thisWalker.getTree();
    const thisNode = thisTree?.rootNode.descendantForPosition(
      { row: r, column: c },
      { row: r, column: c }
    );
    if (!thisNode) return null;

    const partnerAbsPath = path.join(workspacePath, partnerPath);
    const thatText = await fs.readFile(partnerAbsPath, "utf8");

    const partnerLang = getLanguageId(partnerPath);
    if (!partnerLang) {
      console.log(`Unsupported partner file type for ${partnerPath}.`);
      return null;
    }
    const thatWalkerFactory = getWalkerFactory(partnerLang);
    if (!thatWalkerFactory) {
      console.log(`No walker found for language ${partnerLang}.`);
      return null;
    }

    const thatWalker = thatWalkerFactory.ingest(thatText);
    const dualNode = this.getDualNode(thisNode, thisWalker, thatWalker);
    if (!dualNode) return null;

    return { dualNode, partnerAbsPath };
  }

  async handleDefinition(
    workspacePath: string,
    documentPath: string,
    position: Position
  ): Promise<Location[]> {
    const resolved = await this.resolveDualNode(workspacePath, documentPath, position);
    if (!resolved) return [];
    const { dualNode, partnerAbsPath } = resolved;
    return nodesToLocations([dualNode], partnerAbsPath);
  }

  async handleReferences(
    workspacePath: string,
    documentPath: string,
    position: Position
  ): Promise<Location[]> {
    const resolved = await this.resolveDualNode(workspacePath, documentPath, position);
    if (!resolved) return [];
    const { dualNode, partnerAbsPath } = resolved;

    const gopls_position = {
      line: dualNode.startPosition.row,
      character: dualNode.startPosition.column,
    };
    console.log(`[references] querying gopls: file=${partnerAbsPath} position=${gopls_position.line}:${gopls_position.character} node_type=${dualNode.type} node_text="${dualNode.text}"`);

    const shim = await Shim.create();
    return shim.references(partnerAbsPath, gopls_position);
  }

  getDualNode(thisNode: Node, thisWalker: Walker, thatWalker: Walker) {
    const route = thisWalker.getRoute(thisNode);
    console.debug("Computed route:", route);
    return thatWalker.getNode(route);
  }
}
