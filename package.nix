{
  stdenv,
  nodejs,
  importNpmLock,
  vsce,
  typescript,
  pkg-config,
  libsecret,
  npmHooks,
}: let
  # hook =
  #   makeSetupHook {
  #     name = "run-parsers-hook";
  #   } (writeScript "setup-parsers-dir.sh" ''
  #     setupParsersDirHook() {
  #       mkdir -p parsers || true
  #       install -m 0644 ${self.outputs.packages.${system}.wasm-proto}/tree-sitter-proto.wasm parsers/
  #       install -m 0644 ${self.outputs.packages.${system}.wasm-go}/tree-sitter-go.wasm parsers/
  #     }
  #   '');
in
  stdenv.mkDerivation {
    name = "hai";

    src = ./.;
    nativeBuildInputs = [
      nodejs
      vsce
      typescript
      importNpmLock.hooks.npmConfigHook
      npmHooks.npmBuildHook
      npmHooks.npmInstallHook
    ];

    npmBuildScript = "build";

    buildPhase = ''
      ls -la node_modules
      npm run package
      exit 1
    '';

    npmDeps = importNpmLock.buildNodeModules {
      npmRoot = ./.;
      inherit nodejs;
      derivationArgs = {
        nativeBuildInputs = [
          pkg-config
          libsecret
        ];
      };
    };
  }
