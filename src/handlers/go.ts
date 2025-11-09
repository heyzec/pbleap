import { Parser } from "web-tree-sitter";
import type { Node } from "web-tree-sitter";

import { pascalToSnake } from "../utils/names";
import { getProtoField } from "./proto";
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

    const thatTree = thatWalker.getTree();
    if (!thatTree) {
      return null;
    }

    console.log(
      "Searching for field:",
      pascalToSnake(fieldName),
      "in message:",
      structName
    );
    const found = getProtoField(
      thatTree.rootNode,
      structName,
      pascalToSnake(fieldName)
    );
    return found;
  }
}

export default new GoProvider(GoWalker);

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
