import * as vscode from "vscode";
import type { Node } from "web-tree-sitter";

import { Route, Walker, WalkerFactory } from "./base";
import { pascalToSnake, snakeToPascal } from "../utils/names";
import { highlightNodes } from "../utils/debug";

class GoWalkerFactory extends WalkerFactory {
  getWasmPath() {
    return "tree-sitter-go.wasm";
  }

  ingest(source: string) {
    const tree = this.parser!.parse(source)
    return new GoWalker(tree)
  }
}

class GoWalker extends Walker {
  getRoute(thisNode: Node) {
    console.log("In GoWalker.getRoute")
    let node: Node | null = thisNode;

    if (node!.type === "field_identifier") {
      console.log("It's a field identifier")
      const fieldName = node.text!;
      node = node!.parent!.parent!.parent!.parent! // field_identifier -> field_declaration -> field_declaration_list -> struct_type -> type_spec

      const route: Route = [];
      const structName = node.child(0)!.text;
      const parts = structName.split("_")
      let messageName
      if (parts.length > 1) {
        parts.slice(0, parts.length - 1).forEach(part => {
          route.push({ type: "message", name: part })
        })
        messageName = parts[parts.length - 1]
      } else {
        messageName = structName
      }
      route.push({ type: "message", name: messageName })
      route.push({ type: "field", name: pascalToSnake(fieldName) })
      return route
    } else if (node!.type === "identifier") {
      console.log("It's a identifier")
      if (node?.parent?.type !== "const_spec") { return null } // assertion failed
      // console.log(node?.type)
      // console.log(node?.parent?.type)
      // console.log(node?.parent?.parent?.type)
      // console.log(node?.parent?.parent?.parent?.type)
      // console.log(node?.parent?.parent?.parent?.parent?.type)
      node = node!.parent! // identifier -> const_spec
      const constName = node.child(0)!.text;
      const constType = node.child(1)!.text;

      function longestPrefix(s1: string, s2: string) {
        const l1 = s1.split("_")
        const l2 = s2.split("_")
        const L = l1.length > l2.length ? l1.length : l2.length
        let output = []
        for (let i = 0; i < L; i++) {
          if (l1[i] === l2[i]) {
            output.push(l1[i])
          }
        }
        return output.join("_")
      }

      const prefix = longestPrefix(constName, constType)
      console.log("Computed prefix:", prefix)
      const enumName = prefix;
      const enumField = constName.slice(prefix.length + 1); // +1 to skip the underscore
      // TODO: Cleanup
      if (prefix === constType) {
        console.log("Top level enum field")
        return [
          { type: "enum", name: enumName },
          { type: "enum_field", name: pascalToSnake(enumField) },
        ] satisfies Route
      } else {
        console.log("Nested enum field")
        const enumName = constType.slice(prefix.length + 1); // +1 to skip the underscore
        const route: Route = prefix.split("_").map(part => ({ type: "message", name: part }))
        route.push({ type: "enum", name: enumName })

        route.push({ type: "enum_field", name: enumField })
        return route
      }
    }
    console.log("OOPS")
    return null
  }

  getNode(route: Route) {
    const tree = this.getTree()
    if (!route || !tree) {
      return null
    }

    let prefix = ""
    let i = 0
    while (route[i].type === "message") {
      if (i > 0) {
        prefix += "_"
      }
      prefix += route[i].name
      i += 1
    }
    console.log("Computed prefix:", prefix)

    if (route[i].type === "field") {
      const structName = prefix
      const fieldName = route[i].name
      const found = getGoField(tree.rootNode, structName, snakeToPascal(fieldName));
      return found
    } else if (route[i].type === "enum") {
      const aliasName = prefix ? `${prefix}_${route[i].name}` : route[i].name
      i += 1
      const constName = prefix ? `${prefix}_${route[i].name}` : `${aliasName}_${route[i].name}`
      return getConst(tree.rootNode, constName, aliasName);
    }
    console.log(route[i])

    if (route[0].type != "message") { return null } // assertion failed
    if (route[1].type != "field") { return null } // assertion failed
    return null
  }
}

function getGoStruct(root: /*Node*/ any, structName: string): Node | null {
  let nodes = root.namedChildren.filter((node: any) => node.type === 'type_declaration')
  nodes = nodes.filter((node: any) => node.namedChildren[0].childForFieldName("name")?.text === structName);
  return nodes[0];
}

function getGoField(root: Node, structName: string, fieldName: string): Node | null {
  const structNode = getGoStruct(root, structName);
  let nodes = structNode?.namedChildren[0]?.childForFieldName("type")?.namedChildren[0]?.namedChildren ?? [];
  nodes = nodes.map(node => node?.namedChildren.find(child => child?.type === "field_identifier") ?? null);
  nodes = nodes.filter(node => node?.text === fieldName);
  return nodes[0]
}

function getConst(root: Node, constName: string, constType: string): Node | null {
  let nodes = root.namedChildren.filter((node: any) => node.type === 'const_declaration')
  nodes = nodes.map(node => node!.children).flat().filter((child: any) => child?.type === "const_spec")
  nodes = nodes.filter(node => node!.children.length == 4)
  nodes = nodes.filter(node => node!.child(0)!.text === constName)
  nodes = nodes.filter(node => node!.child(1)!.text === constType)
  const found = nodes[0];
  return found!.child(0)
}

const factory = new GoWalkerFactory()
WalkerFactory.register(factory)
export default factory
