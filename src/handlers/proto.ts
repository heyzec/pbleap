import * as vscode from "vscode";

import type { Node } from "web-tree-sitter";

import { getGoField } from "./go";
import { snakeToPascal } from "../utils/names";
import { ProtoWalker } from "../walkers";
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

    return found
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

