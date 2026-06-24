{ pkgs, inputs, ... }:

{
  devcontainer = {
    enable = true;  
  };

  languages.javascript = {
    enable = true;
    nodejs.enable = true;
    bun.enable = true;
    yarn = {
      enable = true;
      package = pkgs.yarn-berry;
    };
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
    pkgs.sops
    pkgs.age
  ];
}
