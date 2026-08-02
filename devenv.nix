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
    (pkgs.corepack.override { nodejs-slim = pkgs.nodejs-slim_26; })
  ];

  env.FONTCONFIG_FILE = pkgs.makeFontsConf {
    fontDirectories = [ pkgs.inter ];
  };

  # Bun and Node load some workspace dependencies (for example sharp) at runtime.
  # Keep their native C++ and ICU dependencies explicit so the same shell works on
  # NixOS hosts and on Linux CI runners without relying on host-global libraries.
  env.LD_LIBRARY_PATH = pkgs.lib.makeLibraryPath [
    pkgs.stdenv.cc.cc.lib
    pkgs.icu
  ];

  languages.javascript = {
    enable = true;
    package = pkgs.nodejs-slim_26;
  };
}
