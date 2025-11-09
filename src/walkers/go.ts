import type { Node } from "web-tree-sitter";

import { Route, Walker, WalkerFactory } from "./base";
import { pascalToSnake, snakeToPascal } from "../utils/names";

class GoWalkerFactory extends WalkerFactory {
  getWasmPath() {
    return "tree-sitter-go.wasm";
  }

  ingest(source: string) {
    const tree = this.parser!.parse(source);
    return new GoWalker(tree);
  }
}

class GoWalker extends Walker {
  getRoute(thisNode: Node) {
    let node: Node | null = thisNode;
    if (!node || node.type !== "field_identifier") {
      console.log("Node is not field_identifier, found:", node?.type);
      return null;
    }
    const fieldName = node.text;
    if (!fieldName) {
      console.log("No field name found");
      return null;
    }
    // Assumption: We can always find struct containing field node = node.parent?.parent?.parent?.parent || null
    node = node?.parent?.parent?.parent?.parent ?? null;
    if (!node || node.type !== "type_spec") {
      console.log("Could not find enclosing type_spec for field:", fieldName);
      return null;
    }
    const structName = node.child(0)?.text;
    if (!structName) {
      console.log("No struct name found for field:", fieldName);
      return null;
    }

    const thatTree = this.getTree();
    if (!thatTree) {
      return null;
    }
    return [structName, pascalToSnake(fieldName)];
  }

  getNode(route: Route) {
    const tree = this.getTree();
    if (!route || !tree) {
      return null;
    }
    const [structName, fieldName] = [route[0], route[1]];
    const found = getGoField(
      tree.rootNode,
      structName,
      snakeToPascal(fieldName)
    );
    return found;
  }
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

export function getGoField(
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

const factory = new GoWalkerFactory();
WalkerFactory.register(factory);
export default factory;
