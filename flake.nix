# inspired by https://ayats.org/blog/nix-rustup/

{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/ba733f8000925e837e30765f273fec153426403d";

    # for `flake-utils.lib.eachSystem`
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [ ];
          config.allowUnfree = false;
        };
      in
      {
        devShells = {
          default = with pkgs; pkgs.mkShellNoCC {
            buildInputs = [
              git
              just

              sqlite-interactive
              nodejs_20

              earthly
              docker
              flyctl

              less
              fzf

              # darwin.apple_sdk.frameworks.Security
            ];
          };
        };
        packages = {
          juliabuild = pkgs.buildEnv {
            name = "julia-build-image";
            paths = with pkgs; [
                diffutils
                julia_19-bin
                python3 # for node-gyp
                gcc
                gnumake
                gnused
                llvmPackages.libcxxStdenv
                llvmPackages.libcxx
                libcxxStdenv
                libcxx
                sqlite
            ];

          };
          base = pkgs.buildEnv {
            name = "base-image";
            paths = with pkgs; [
                julia_19-bin
                nodejs_20
                sqlite
            ];
          };
        };
      }
    );
}


