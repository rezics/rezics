{ pkgs, ... }:

# Dev shell for the Rezics monorepo.
#
# Scope: devenv provides the *host toolchain* only. The external services
# (PostgreSQL 18, Meilisearch, Sequin) are managed via Docker Compose v2 —
# the repo's only supported runtime for them — through `bun run service up`.
# Provisioning them here would duplicate that path and collide on ports
# 5432/7700, so they are intentionally left out.
{
  languages.javascript = {
    enable = true; # Node.js 24 — used by `bun run check:runtime-env`.
    bun.enable = true; # Runtime + package manager. Repo targets bun 1.3.x.
  };

  packages = [
    pkgs.git
    pkgs.zellij # Required by `bun run dev`; it exits if zellij is missing.
    pkgs.postgresql_18 # psql 18 client — db tooling shells out to `psql`.
    pkgs.openssl # Generate local secrets (SECRET_KEY_BASE, VAULT_KEY).
    pkgs.jq
  ];
}
