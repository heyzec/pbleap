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

/*
  type User struct {
       ^^^^                   (1) type_identifier -> type_spec -> type_declaration (where node.parent.child(1) is struct_type)
    Id *int32
    ^^                        (2) field_identifier -> field_declaration
  }

  type Status int32
       ^^^^^^                 (3) type_identifier -> type_spec -> type_declaration (where node.parent.child(1) is a type_identifier)
  const (
    Status_ACTIVE Status = 1
    ^^^^^^^^^^^^^             (4) identifier -> const_spec -> const_declaration
                  ^^^^^^      (5) type_identifier -> const_spec -> const_declaration
  )
*/

function routeForStructField(
  structName: string,
  fieldName: string | null
): Route | null {
  const route: Route = [];
  const parts = structName.split("_");
  let messageName;
  if (parts.length > 1) {
    parts.slice(0, parts.length - 1).forEach((part) => {
      route.push({ type: "message", name: part });
    });
    messageName = parts[parts.length - 1];
  } else {
    messageName = structName;
  }
  route.push({ type: "message", name: messageName });
  if (fieldName) {
    route.push({ type: "field", name: pascalToSnake(fieldName) });
  }
  return route;
}

/** Deduce typename, fieldname, parents */
function deduceEnums(
  typeName: string,
  valueName: string | null
): [string, string | null, string[]] {
  if (!valueName) {
    // Without valueName, we can only made a guess about the parents
    const parts = typeName.split("_");
    if (parts.length === 1) {
      return [typeName, null, []];
    } else {
      return [parts[-1], null, parts.slice(0, -1)];
    }
  }

  function longestPrefix(s1: string, s2: string) {
    const l1 = s1.split("_");
    const l2 = s2.split("_");
    const L = l1.length > l2.length ? l1.length : l2.length;
    let output = [];
    for (let i = 0; i < L; i++) {
      if (l1[i] === l2[i]) {
        output.push(l1[i]);
      }
    }
    return output.join("_");
  }

  const prefix = longestPrefix(typeName, valueName);
  const enumField = valueName.slice(prefix.length + 1); // +1 to skip the underscore
  if (prefix === typeName) {
    // Top-level enum field
    return [typeName, enumField, []];
  } else {
    const parts = prefix.split("_");
    const temp = typeName.slice(prefix.length + 1);
    return [temp, enumField, parts];
  }
}

function handleCase1(node: Node): Route {
  console.debug("GoWalker: Case1");
  node = node!.parent!; // type_identifier -> type_spec
  const structName = node.child(0)!.text;
  return routeForStructField(structName, null);
}

function handleCase2(node: Node): Route {
  console.debug("GoWalker: Case2");
  const fieldName = node.text!;
  node = node!.parent!.parent!.parent!.parent!; // field_identifier -> field_declaration -> field_declaration_list -> struct_type -> type_spec
  const structName = node.child(0)!.text;
  return routeForStructField(structName, fieldName);
}

function handleCase3(node: Node): Route {
  console.debug("GoWalker: Case3");
  const [enumName, enumField, parents] = deduceEnums(node.text!, null);
  const route: Route = parents.map((parent) => ({
    type: "message",
    name: parent,
  }));
  route.push({ type: "enum", name: enumName });
  return route;
}

function handleCase4(node: Node): Route {
  console.debug("GoWalker: Case4");
  node = node!.parent!; // identifier -> const_spec
  const constName = node.child(0)!.text;
  const constType = node.child(1)!.text;
  const [enumName, enumField, parents] = deduceEnums(constType, constName);
  const route: Route = parents.map((parent) => ({
    type: "message",
    name: parent,
  }));
  route.push({ type: "enum", name: enumName });
  route.push({ type: "enum_field", name: enumField! });
  return route;
}

function handleCase5(node: Node): Route {
  console.debug("GoWalker: Case5");
  // Similar to Case 3
  const [enumName, enumField, parents] = deduceEnums(node.text!, null);
  const route: Route = parents.map((parent) => ({
    type: "message",
    name: parent,
  }));
  route.push({ type: "enum", name: enumName });
  return route;
}

class GoWalker extends Walker {
  getRoute(thisNode: Node) {
    let node: Node | null = thisNode;
    if (node.type == "type_identifier") {
      // case (1) or (3) or (5)
      node = node.parent;
      if (node?.type === "type_spec") {
        // case (1) or (3)
        if (node?.child(1)?.type === "struct_type") {
          // case (1)
          return handleCase1(thisNode);
        } else if (node?.child(1)?.type === "type_identifier") {
          // case (3)
          return handleCase3(thisNode);
        }
      } else if (node?.type === "const_spec") {
        // case (5)
        return handleCase5(thisNode);
      }
    } else if (node.type === "field_identifier") {
      if (node.parent?.type !== "field_declaration") {
        return null;
      }
      // case (2)
      return handleCase2(thisNode);
    } else if (node.type === "identifier") {
      if (node.nextSibling?.type !== "type_identifier") {
        return null;
      }
      node = node.parent;
      if (node?.type !== "const_spec") {
        return null;
      }
      node = node.parent;
      if (node?.type !== "const_declaration") {
        return null;
      }
      // case (4)
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

    let prefix = "";
    let i = 0;
    while (i < route.length && route[i].type === "message") {
      if (i > 0) {
        prefix += "_";
      }
      prefix += route[i].name;
      i += 1;
    }

    if (i === route.length) {
      const structName = route[i - 1].name;
      const found = getGoStruct(tree.rootNode, structName);
      return found;
    }

    if (route[i].type === "field") {
      const structName = prefix;
      const fieldName = route[i].name;
      const found = getGoField(
        tree.rootNode,
        structName,
        snakeToPascal(fieldName)
      );
      return found;
    } else if (route[i].type === "enum") {
      const aliasName = prefix ? `${prefix}_${route[i].name}` : route[i].name;
      const node = getConst(tree.rootNode, aliasName);
      i += 1;
      if (i == route.length) {
        return node;
      }
      const fieldName = prefix
        ? `${prefix}_${route[i].name}`
        : `${aliasName}_${route[i].name}`;
      return getConstLine(node!, fieldName);
    }

    if (route[0].type != "message") {
      return null;
    } // assertion failed
    if (route[1].type != "field") {
      return null;
    } // assertion failed
    return null;
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

function getGoField(
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

function getConst(root: Node, constName: string): Node | null {
  let nodes = root.namedChildren.filter(
    (node) => node?.type === "type_declaration"
  );
  let node = nodes.find((node) => node?.child(1)?.child(0)?.text == constName);
  return node?.nextSibling!;
}

function getConstLine(node: Node, constName: string): Node | null {
  let nodes = node.children;
  nodes = nodes.filter((child) => child?.type === "const_spec");
  const found = nodes.find((node) => node!.child(0)!.text === constName);
  return found!.child(0);
}

const factory = new GoWalkerFactory();
WalkerFactory.register(factory);
export default factory;
