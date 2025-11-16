extension-id := "heyzec.pbleap"

install:
    npm run package
    code --install-extension "$(ls -v *.vsix | tail -n1)" --force
    ln -sf $(realpath dist)/extension.js $(echo $HOME/.vscode/extensions/{{extension-id}}-*)/dist/extension.js

reinstall:
    just install
    command -v open >/dev/null 2>&1 && 'vscode://{{extension-id}}/reload' || xdg-open 'vscode://{{extension-id}}/reload'

dev:
    npm run watch

# Also used by Nix on Github Actions
wasm:
    mkdir -p ./parsers || true
    install -m 0644 $(nix build .#wasm-proto --no-link --print-out-paths)/tree-sitter-proto.wasm ./parsers/
    install -m 0644 $(nix build .#wasm-go --no-link --print-out-paths)/tree-sitter-go.wasm ./parsers/
