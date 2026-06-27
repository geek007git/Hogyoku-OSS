{
  description = "Reproducible development shell for Hogyoku RAG";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.11";
  };

  outputs = { self, nixpkgs }:
    let
      supportedSystems = [ "x86_64-linux" "aarch64-linux" "aarch64-darwin" ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
    in
    {
      devShells = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        {
          default = pkgs.mkShell {
            packages = with pkgs; [
              nodejs_22
              nodePackages.npm
              rustc
              cargo
              rustfmt
              clippy
              terraform
              ansible
              python312
              shellcheck
              docker-client
              git
              curl
              jq
            ];

            shellHook = ''
              echo "Hogyoku dev shell ready"
              echo "Run: npm ci && npm run verify"
            '';
          };
        });

      formatter = forAllSystems (system:
        let pkgs = import nixpkgs { inherit system; };
        in pkgs.nixpkgs-fmt);
    };
}
