install:
    npm run package
    code --install-extension "$(ls -v *.vsix | tail -n1)" --force
    ln -sf $(realpath dist)/extension.js $(echo $HOME/.vscode/extensions/heyzec.pbleap-*)/dist/extension.js

reinstall:
    just install
    open 'vscode://heyzec.pbleap/reload'

dev:
    find src -type f | entr -r npm run compile:extension

wasm:
    mkdir dist
    cp node_modules/tree-sitter-go/tree-sitter-go.wasm dist/
    cp node_modules/web-tree-sitter/tree-sitter.wasm dist/
    # cp tree-sitter-proto/tree-sitter-proto.wasm

