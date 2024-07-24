{ pkgs ? import <nixpkgs> {} }:
  pkgs.mkShellNoCC {
  packages = with pkgs; [
    nodejs_22
    corepack_22
    nodejs_22.pkgs.pnpm
  ];
}
