import * as vscode from "vscode";

import type { Node } from "web-tree-sitter";

import { Route, Walker, WalkerFactory } from "./base";
import { highlightNodes } from "../utils/debug";

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
    if (!node || !node.type || !fieldName) {
      return null;
    }
    if (node.type !== "identifier") {
      vscode.window.showInformationMessage(`Only supported on identifier, found ${node?.type}`);
      return null;
    }

    const route: Route = [];

    node = node.parent

    if (node!.type === "field") {
      node = node!.parent!.parent // type must be message (field -> message_body -> message)
      const structName = node?.child(1)?.text!;
      route.push({ type: "message", name: structName })
      route.push({ type: "field", name: fieldName })
    } else if (node!.type === "enum_field") {
      // console.log("is a enum field")
      // console.log(node?.parent?.type)
      node = node!.parent!.parent // type must be enum (enum_field -> enum_body -> enum)
      const enumName = node?.child(1)?.text!;
      console.log(`enumname ${enumName}`);
      route.push({ type: "enum", name: enumName })
      route.push({ type: "enum_field", name: fieldName })
    } else {
      return null
    }

    node = node?.parent!
    while (node.type != "source_file") {
      console.log("We need to go higher")
      node = node.parent!
      const messageName = node?.child(1)?.text!;
      route.unshift({ type: "message", name: messageName })
      node = node.parent!
    }
    console.log(route);
    return route
  }

  getNode(route: Route) {
    const tree = this.getTree()
    if (!route || !tree) {
      return null
    }

    let nodes = tree.rootNode.children;

    console.log("=====ENTERING LOOP=====")
    let i = 0
    while (route[i].type === "message") {
      nodes = nodes.filter(node => node?.type === 'message')
      console.log("1. Try to find correct message")
      let node = nodes.find(node => {
        console.log("Checking node:", node?.child(1)?.text, "against", route[i].name)
        return node?.child(1)?.text === route[i].name
      });
      console.log("2. Found node:", node!.text)
      nodes = node!.child(2)!.children.slice(1, -1) // message_body: skip { }
      console.log(`3. Loop ${i}:`, `First child type: ${nodes[0]?.type}`, `Text: ${nodes[0]?.text}`)

      i += 1
    }

    console.log("ProtoWalker.getNode with route:", route)

    if (route[i].type === "field") {
      console.log("Looking for field:", route[i].name)
      console.log("Available nodes:", nodes.map(n => [n?.text, n?.type]))
      nodes = nodes.filter(node => node?.type === 'field');
      nodes = nodes.map(node => node?.child(2) ?? null);
      return nodes.find(node => node?.text === route[i].name) ?? null;
    } else if (route[i].type === "enum") {
      nodes = nodes.filter(node => node?.type === 'enum')
      let enumNode = nodes[0];

      let node = nodes.find(node => {
        console.log("Checking enum node:", node?.child(1)?.text, "against", route[i].name)
        const x = node?.child(1)?.text === route[i].name
        console.log("Result:", x)
        return x
      })!
      nodes = node!.children

      if (i + 1 < route.length) {
        nodes = node.child(2)!.namedChildren
        nodes = nodes.filter(node => node?.type === 'enum_field')
        // const document = vscode.window.visibleTextEditors.map(editor => editor.document).find(doc => doc.uri.fsPath.endsWith("plus.proto"))
        // if (document) {
        //   highlightNodes(nodes as any, document as any);
        // }
        nodes = nodes.filter(node => {
          console.log("Maybe i crash")
          console.log(`Testing enum field node:`, node?.child(0)?.text, "against", route[i + 1].name)
          return node!.child(0)!.text.toLowerCase() === route[i + 1].name.toLowerCase()
        })
        const found = nodes[0];
        console.log("Found enum field node:", found?.text)
        return found
      } else {
        console.log("not implemented: enum only")
        // TODO: Handle case if only interested in enum type
      }
    }


    console.log("=====EXITING LOOP=====")
    if (route[0].type != "message") { return null } // assertion failed
    if (route[1].type != "field") { return null } // assertion failed
    console.log("Checks done")
    const [structName, fieldName] = [route[0].name, route[1].name]
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
