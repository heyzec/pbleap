# PBLeap

<p align="center">
   <img src="./assets/icon.png" width="150">
</p>

A Visual Studio Code extension to quickly navigate from protobuf files to generated code.

## Features
- Leap from protobuf definitions to generated code
- Leap from generated code back to protobuf definitions

(only Go supported for now)

## Getting started
After PBLeap is installed, you need to configure the mapping between protobuf files and generated files. In the settings page, search for `protoGenMapping` (or open this deeplink: `vscode://settings/pbleap.protoGenMapping`).

This setting has to be edited in JSON format. The key is the protobuf filename and the value is the generated code filename. Both are relative to workspace root.

```json
"pbleap.protoGenMapping": {
    "example.proto": "example.pb.go"
}
```

## Developer Guide
### Setting up
**1. Install node dependencies**
```sh
npm install
```

**2. Get required WASM binaries for parsing**

This extension uses [Tree-sitter](https://github.com/tree-sitter/tree-sitter) to parse code and generate ASTs. WASM binaries need to be at `dist/tree-sitter-proto.wasm` and `dist/tree-sitter-go.wasm` before VSIX packaging.

- Protobuf: https://github.com/coder3101/tree-sitter-proto
   - Will require manually building from source with the `tree-sitter` CLI.
- Go: https://github.com/tree-sitter/tree-sitter-go
   - Can be obtained from GitHub Releases.
   - Alternatively, install the NPM package and then copy from `node-modules/tree-sitter-go/tree-sitter-go.wasm`.

If you have Nix, you can instead run
```sh
just wasm
```
which will build and copy the required WASM files to `dist/`.

### Packaging and installing from VSIX
```sh
just install
```

### Developing
Start hot-reload of extension
```sh
just dev
```

### Known issues
**punycode is deprecated**
```
DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
```
Wait for https://github.com/markdown-it/markdown-it/issues/1065 to be resolved.
