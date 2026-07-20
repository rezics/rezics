{ pkgs, ... }:

{
  packages = [
    pkgs.git
    pkgs.go-task
    pkgs.scc
    pkgs.inkscape
    pkgs.inter
    pkgs.fontconfig
    pkgs.bun
  ];

  env.FONTCONFIG_FILE = pkgs.makeFontsConf {
    fontDirectories = [ pkgs.inter ];
  };

  languages.javascript = {
    enable = true;
    package = pkgs.nodejs-slim_26;
  };
}
