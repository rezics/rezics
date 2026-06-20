{ pkgs, inputs, ... }:

{
  devcontainer = {
    enable = true;  
  };

  languages.javascript = {
    enable = true;
    nodejs.enable = true;
    bun.enable = true;
  };

  packages = [
    pkgs.go-task
    pkgs.fish
    pkgs.git
    pkgs.zellij
    pkgs.postgresql_18
    pkgs.openssl
    pkgs.jq
    inputs.hashicorp.packages.${pkgs.system}.nomad
    inputs.hashicorp.packages.${pkgs.system}.nomad-pack
    pkgs.sops
    pkgs.age
  ];
}
