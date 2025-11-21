import type { Node } from "web-tree-sitter";

import { Route, Walker, WalkerFactory } from "./base";

class ProtoWalkerFactory extends WalkerFactory {
  getWasmPath() {
    return "tree-sitter-proto.wasm";
  }

  ingest(source: string) {
    const tree = this.parser!.parse(source);
    return new ProtoWalker(tree);
  }
}

/*
  message User {
          ^^^^^^^^            (1) identifier -> message_name -> message
      optional int32 id = 1;
                     ^^       (2) identifier -> field -> message_body -> message
  }

  enum Status {
       ^^^^^^                 (3) identifier -> enum_name -> enum
      ACTIVE = 0;
      ^^^^^^                  (4) identifier -> enum_field -> enum_body -> enum
  }
*/

function walkToRoot(start: Node, route: Route) {
  let node: Node | null = start;
  while (node) {
    node = node?.parent;
    if (node?.type === "message") {
      const messageName = node?.child(1)?.text!;
      route!.unshift({ type: "message", name: messageName });
    }
  }
}

function handleCase1(node: Node): Route {
  console.debug("ProtoWalker: Case1");
  node = node.parent!;
  const route: Route = [];
  walkToRoot(node, route);
  return route;
}

function handleCase2(node: Node): Route {
  console.debug("ProtoWalker: Case2");
  const fieldName = node?.text!;
  node = node.parent!;

  const route: Route = [];
  node = node!.parent!.parent!; // type must be message (field -> message_body -> message)
  const structName = node?.child(1)?.text!;
  route.push({ type: "message", name: structName });
  route.push({ type: "field", name: fieldName });

  walkToRoot(node, route);
  return route;
}

function handleCase3(node: Node): Route {
  console.debug("ProtoWalker: Case3");
  const enumName = node?.text!;
  const route: Route = [];
  route.push({ type: "enum", name: enumName });
  node = node.parent!;
  walkToRoot(node, route);
  return route;
}

function handleCase4(node: Node): Route {
  console.debug("ProtoWalker: Case4");
  const fieldName = node?.text!;
  node = node.parent!;

  const route: Route = [];
  node = node!.parent!.parent!; // type must be enum (enum_field -> enum_body -> enum)
  const enumName = node?.child(1)?.text!;
  route.push({ type: "enum", name: enumName });
  route.push({ type: "enum_field", name: fieldName });

  walkToRoot(node, route);
  return route;
}

class ProtoWalker extends Walker {
  getRoute(thisNode: Node) {
    if (thisNode.type != "identifier") {
      return null;
    }

    let node = thisNode;
    node = node.parent!;

    if (node.type === "message_name") {
      return handleCase1(thisNode);
    } else if (node.type === "field") {
      return handleCase2(thisNode);
    } else if (node.type === "enum_name") {
      return handleCase3(thisNode);
    } else if (node.type === "enum_field") {
      return handleCase4(thisNode);
    }

    console.debug("Unrecognised case");
    return null;
  }

  getNode(route: Route) {
    const tree = this.getTree();
    if (!route || !tree) {
      return null;
    }

    let node = tree.rootNode;

    let i = 0;
    while (route[i]?.type === "message") {
      let nodes;
      if (i == 0) {
        nodes = node.namedChildren;
      } else {
        nodes = node!.child(2)!.children.slice(1, -1); // message_body: skip { }
      }
      nodes = nodes.filter((node) => node?.type === "message");
      node = nodes.find((node) => node?.child(1)?.text === route[i].name)!;
      i += 1;
    }

    if (i === route.length) {
      return node;
    }
    let nodes;
    if (i == 0) {
      nodes = node.namedChildren;
    } else {
      nodes = node!.child(2)!.children.slice(1, -1); // message_body: skip { }
    }

    if (route[i].type === "field") {
      nodes = nodes.filter((node) => node?.type === "field");
      nodes = nodes.map((node) => node?.child(2) ?? null);
      return nodes.find((node) => node?.text === route[i].name) ?? null;
    } else if (route[i].type === "enum") {
      nodes = nodes.filter((node) => node?.type === "enum");
      let node = nodes.find((node) => node?.child(1)?.text === route[i].name)!;

      if (i + 1 == route.length) {
        return nodes[0];
      }

      nodes = node!.children;
      nodes = node.child(2)!.namedChildren;
      nodes = nodes.filter((node) => node?.type === "enum_field");
      nodes = nodes.filter(
        (node) =>
          node!.child(0)!.text.toLowerCase() === route[i + 1].name.toLowerCase()
      );
      const found = nodes[0];
      return found;
    }

    if (route[0].type != "message") {
      return null;
    } // assertion failed
    if (route[1].type != "field") {
      return null;
    } // assertion failed
    const [structName, fieldName] = [route[0].name, route[1].name];
    const found = getProtoField(tree.rootNode, structName, fieldName);
    return found;
  }
}

function getProtoStruct(root: Node, structName: string) {
  let nodes = root.namedChildren;
  nodes = nodes.filter((node) => node?.type === "message");
  nodes = nodes.filter((node) => node?.child(1)?.text === structName);
  return nodes[0];
}

export function getProtoField(
  root: Node,
  structName: string,
  fieldName: string
): Node | null {
  const structNode = getProtoStruct(root, structName);
  let nodes = structNode?.child(2)?.namedChildren ?? [];
  nodes = nodes.filter((node) => node?.type === "field");
  nodes = nodes.map((node) => node?.child(2) ?? null);
  return nodes.find((node) => node?.text === fieldName) ?? null;
}

const factory = new ProtoWalkerFactory();
WalkerFactory.register(factory);
export default factory;
