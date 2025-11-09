import * as vscode from "vscode";

import type { Node } from "web-tree-sitter";

import { Route, Walker, WalkerFactory } from "./base";

class ProtoWalkerFactory extends WalkerFactory {
  getWasmPath() {
    return "tree-sitter-proto.wasm";
  }

  ingest(source: string) {
    const tree = this.parser!.parse(source)
    return new ProtoWalker(tree)
  }
}

class ProtoWalker extends Walker {
  getRoute(thisNode: Node) {
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
        return null
      }
    }
    const structName = node?.child(1)?.text;
    if (!structName) {
      return null
    }
    const thatTree = this.getTree();
    if (!thatTree) {
      return null
    }

    return [structName, fieldName]
  }

  getNode(route: Route) {
    const tree = this.getTree()
    if (!route || !tree) {
      return null
    }
    const [structName, fieldName] = [route[0], route[1]]
    const found = getProtoField(tree.rootNode, structName, fieldName);
    return found
  }
}

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

const factory = new ProtoWalkerFactory()
WalkerFactory.register(factory)
export default factory
