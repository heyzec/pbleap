{
  description = "Template for VS Code extension";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/25.05";
  };

  outputs = {
    self,
    nixpkgs,
    ...
  }: let
    systems = ["x86_64-linux" "aarch64-darwin"];
  in {
    packages = nixpkgs.lib.genAttrs systems (system: let
      pkgs = nixpkgs.legacyPackages.${system};
    in {
      wasm-proto = pkgs.callPackage nix/wasm-proto.nix {};
      wasm-go = pkgs.callPackage nix/wasm-go.nix {};
    });

    devShells = nixpkgs.lib.genAttrs systems (system: rec {
      default = let
        pkgs = nixpkgs.legacyPackages.${system};
        hook =
          pkgs.makeSetupHook {
            name = "run-hello-hook";
            propagatedBuildInputs = [pkgs.hello];
            substitutions = {shell = "${pkgs.bash}/bin/bash";};
            passthru.tests.greeting = pkgs.callPackage ./test {};
            meta.platforms = pkgs.lib.platforms.linux;
          } (pkgs.writeScript "link-node-modules-hook.sh" ''
            mkdir -p parsers || true
            install -m 0644 ${self.outputs.packages.${system}.wasm-proto}/tree-sitter-proto.wasm parsers/
            install -m 0644 ${self.outputs.packages.${system}.wasm-go}/tree-sitter-go.wasm parsers/
          '');
      in
        pkgs.mkShell {
          packages = with pkgs; [
            nodejs
            typescript-language-server
            just
            importNpmLock.hooks.linkNodeModulesHook
            hook
          ];

          # See https://nixos.org/manual/nixpkgs/stable/#javascript-buildNpmPackage-importNpmLock.buildNodeModules
          npmDeps = pkgs.importNpmLock.buildNodeModules {
            npmRoot = ./.;
            inherit (pkgs) nodejs;
            derivationArgs = {
              nativeBuildInputs = with pkgs; [
                # nodejs.passthru.python # for node-gyp
                pkg-config
                libsecret
              ];
            };
          };
        };
    });
  };
}
