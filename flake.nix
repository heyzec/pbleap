{
  description = "Template for VS Code extension";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/25.05";
  };

  outputs = {nixpkgs, ...}: let
    systems = ["x86_64-linux" "aarch64-darwin"];
  in {
    packages = nixpkgs.lib.genAttrs systems (system: let
      pkgs = nixpkgs.legacyPackages.${system};
    in {
      wasm-proto = pkgs.callPackage nix/wasm-proto.nix {};
      wasm-go = pkgs.callPackage nix/wasm-go.nix {};
    });

    devShells = nixpkgs.lib.genAttrs systems (system: {
      default = let
        pkgs = nixpkgs.legacyPackages.${system};
      in
        pkgs.mkShell {
          packages = with pkgs; [
            nodejs
            typescript-language-server
            just
          ];
        };
    });
  };
}
