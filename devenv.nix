{ pkgs, ... }:

let
  # Pin Bun to the same release and verified artifacts as production.
  bunVersion = "1.4.2";
  bunSources = {
    "aarch64-darwin" = pkgs.fetchurl {
      url = "https://github.com/oven-sh/bun/releases/download/bun-v${bunVersion}/bun-darwin-aarch64.zip";
      hash = "sha256-kJh6OhbX21VtiGrD1VHnttPt8KHPQ6yu1iLoZ2vh0S8=";
    };
    "aarch64-linux" = pkgs.fetchurl {
      url = "https://github.com/oven-sh/bun/releases/download/bun-v${bunVersion}/bun-linux-aarch64.zip";
      hash = "sha256-VDKLvC2cjgyfiSxUTWbFeoO4QTnjSQnl7oF1jxrI/ac=";
    };
    "x86_64-darwin" = pkgs.fetchurl {
      url = "https://github.com/oven-sh/bun/releases/download/bun-v${bunVersion}/bun-darwin-x64-baseline.zip";
      hash = "sha256-utW71s8U0JgNEV9ZVMn/kE32GdXplNLaH/zNPzFjALA=";
    };
    "x86_64-linux" = pkgs.fetchurl {
      url = "https://github.com/oven-sh/bun/releases/download/bun-v${bunVersion}/bun-linux-x64.zip";
      hash = "sha256-NjaPrvdSeHXV/6UuU81IAhdB8qg+tiCKjdZAaNQiqRM=";
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
  ] ++ pkgs.lib.optionals pkgs.stdenv.hostPlatform.isLinux [
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
