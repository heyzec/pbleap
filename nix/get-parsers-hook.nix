{
  wasm-proto,
  wasm-go,
  writeScript,
  pkgs,
  ...
}:
pkgs.makeSetupHook {
  name = "run-parsers-hook";
} (writeScript "setup-parsers-dir.sh" ''
  setupParsersDirHook() {
    mkdir -p parsers || true
    touch hi
    install -m 0644 ${wasm-proto}/tree-sitter-proto.wasm parsers/
    install -m 0644 ${wasm-go}/tree-sitter-go.wasm parsers/
  }
'')
