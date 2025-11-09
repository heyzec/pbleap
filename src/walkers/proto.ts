import { Walker, WalkerFactory } from "./base";

class ProtoWalkerFactory extends WalkerFactory {
  getWasmPath() {
    return "tree-sitter-proto.wasm";
  }

  ingest(source: string) {
    const tree = this.parser!.parse(source);
    return new Walker(tree);
  }
}

const factory = new ProtoWalkerFactory();
WalkerFactory.register(factory);
export default factory;
