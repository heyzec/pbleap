{
  stdenv,
  fetchFromGitHub,
  tree-sitter,
  emscripten,
}:
stdenv.mkDerivation {
  name = "tree-sitter-proto-wasm";
  src = fetchFromGitHub {
    owner = "coder3101";
    repo = "tree-sitter-proto";
    rev = "0f514c4a6fa64003bfa0705a4fb3f224899f7a36";
    sha256 = "sha256-8+TSW9VLP34lFVb+NDuNTya+RO8UqvrQYBxPv8b0rg0=";
  };

  nativeBuildInputs = [
    emscripten
    tree-sitter
  ];

  buildPhase = ''
    cp -r $src/* .
    tree-sitter build --wasm
  '';

  installPhase = ''
    mkdir -p $out
    ls -la
    cp tree-sitter-proto.wasm $out/
  '';
}
