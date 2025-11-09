import { Walker, WalkerFactory } from "./base";

class GoWalkerFactory extends WalkerFactory {
  getWasmPath() {
    return "tree-sitter-go.wasm";
  }

  ingest(source: string) {
    const tree = this.parser!.parse(source);
    return new Walker(tree);
  }
}

const factory = new GoWalkerFactory();
WalkerFactory.register(factory);
export default factory;
