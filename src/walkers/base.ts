import * as path from "path";

import { Parser, Language } from 'web-tree-sitter';
import type { Tree, Node } from "web-tree-sitter";

export abstract class WalkerFactory {
  private static extensionPath: string;

  private static factories: WalkerFactory[] = [];

  parser: Parser | null = null;

  abstract getWasmPath(): string

  static register(factory: WalkerFactory) {
    WalkerFactory.factories.push(factory)
  }

  static async globalSetup(path: string) {
    WalkerFactory.extensionPath = path;
    await Parser.init() // This must be called before any Parser() objects are created
    WalkerFactory.factories.forEach(async factory => {
      await WalkerFactory.setup(factory)
    })
  }

  static async setup(factory: WalkerFactory) {
    const Lang = await Language.load(path.join(WalkerFactory.extensionPath, "dist", factory.getWasmPath()));
    const parser = new Parser()
    parser.setLanguage(Lang);
    factory.parser = parser
  }

  abstract ingest(source: string): Walker

}

export interface Step {
  type: "message" | "field" | "enum" | "enum_field";
  name: string;
}

export type Route = Step[] | null

export abstract class Walker {
  private tree: Tree | null

  constructor(tree: Tree | null) {
    this.tree = tree
  }

  getTree() {
    return this.tree
  }

  abstract getRoute(node: Node): Route;

  abstract getNode(route: Route): Node | null;
}
