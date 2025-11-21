extension-id := "heyzec.pbleap"

install:
    npm run package
    code --install-extension "$(ls -v *.vsix | tail -n1)" --force
    ln -sf $(realpath client/dist)/extension.js $(echo $HOME/.vscode/extensions/{{extension-id}}-*)/client/dist/extension.js
    ln -sf $(realpath server/dist)/main.js $(echo $HOME/.vscode/extensions/{{extension-id}}-*)/server/dist/main.js

reinstall:
    just install
    command -v open >/dev/null 2>&1 && 'vscode://{{extension-id}}/reload' || xdg-open 'vscode://{{extension-id}}/reload'

watch:
    (cd client && npm run watch) & (cd server && npm run watch) & wait

# Also used by Nix on Github Actions
parsers:
    mkdir -p ./parsers || true
    install -m 0644 $(nix build .#wasm-proto --no-link --print-out-paths)/tree-sitter-proto.wasm ./parsers/
    install -m 0644 $(nix build .#wasm-go --no-link --print-out-paths)/tree-sitter-go.wasm ./parsers/

clean:
    rm -rf ./client/dist/
    rm -rf ./server/dist/
    rm -rf ./*.vsix

