{ pkgs, ... }:

let
  # devenv-nixpkgs still packages Bun 1.3.x; pin 1.4.0 to match production.
  bunVersion = "1.4.0";
  bunSources = {
    "aarch64-darwin" = pkgs.fetchurl {
      url = "https://github.com/oven-sh/bun/releases/download/bun-v${bunVersion}/bun-darwin-aarch64.zip";
      hash = "sha256-xmnpf2Fk4cluBwF0jbmN+ndJKQjL2DlMdVcTSnNd44E=";
    };
    "aarch64-linux" = pkgs.fetchurl {
      url = "https://github.com/oven-sh/bun/releases/download/bun-v${bunVersion}/bun-linux-aarch64.zip";
      hash = "sha256-SxozLuhhmD65O8/m93D/+U4+MbLDiL2uo8jtNeWO7Q4=";
    };
    "x86_64-darwin" = pkgs.fetchurl {
      url = "https://github.com/oven-sh/bun/releases/download/bun-v${bunVersion}/bun-darwin-x64-baseline.zip";
      hash = "sha256-2pufG0unZsbymXEfON+qmGI+HtnECJaqU9uAPFLsH6A=";
    };
    "x86_64-linux" = pkgs.fetchurl {
      url = "https://github.com/oven-sh/bun/releases/download/bun-v${bunVersion}/bun-linux-x64.zip";
      hash = "sha256-LQP7X7g6yLVnrKCigbLOGhoZ1Ij1bClo2Iw/Jekv5FI=";
    };
  };
  bunSystem = pkgs.stdenv.hostPlatform.system;
  bun = pkgs.bun.overrideAttrs {
    version = bunVersion;
    src =
      bunSources.${bunSystem} or (throw "Unsupported Bun system: ${bunSystem}");
  };
in
{
  packages = [
    pkgs.git
    pkgs.go-task
    pkgs.scc
    pkgs.inkscape
    pkgs.inter
    pkgs.fontconfig
    bun
    (pkgs.corepack.override { nodejs-slim = pkgs.nodejs-slim_26; })
  ] ++ pkgs.lib.optionals pkgs.stdenv.isLinux [
    pkgs.pkg-config
    pkgs.webkitgtk_4_1
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
