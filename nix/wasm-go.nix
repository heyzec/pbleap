{
  stdenv,
  fetchurl,
}:
stdenv.mkDerivation {
  name = "tree-sitter-proto-wasm";

  src = fetchurl {
    url = "https://github.com/tree-sitter/tree-sitter-go/releases/download/v0.25.0/tree-sitter-go.wasm";
    hash = "sha256-lQRXPzUrIL5/LxkRdU1xBiKu3BWv/xbV7Y+1ZFaBruc=";
  };

  unpackPhase = "true";

  installPhase = ''
    mkdir -p $out
    cp $src $out/tree-sitter-go.wasm
  '';
}
