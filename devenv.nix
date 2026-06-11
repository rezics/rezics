{ pkgs, ... }:

let
  browsers =
    (builtins.fromJSON (builtins.readFile "${pkgs.playwright-driver}/browsers.json")).browsers;
  chromium-rev = (builtins.head (builtins.filter (x: x.name == "chromium") browsers)).revision;
in

{
  env = {
    PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
    PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "true";
    PLAYWRIGHT_MCP_EXECUTABLE_PATH = "${pkgs.playwright-driver.browsers}/chromium-${chromium-rev}/chrome-linux64/chrome";
  };
  languages.javascript = {
    enable = true;
    nodejs.enable = true;
    bun.enable = true;
    bun.install.enable = true;
  };

  packages = [
    pkgs.go-task
    pkgs.fish
    pkgs.git
    pkgs.zellij
    pkgs.postgresql_18
    pkgs.openssl
    pkgs.jq
  ];

  # Local dev processes, started together via `devenv up` (process-compose).
  # Each delegates to the package's authoritative go-task `dev` task, which runs
  # in the package dir (root Taskfile `includes` `dir:`) and loads its own
  # `.env`. Do NOT set infra secrets in `env` here: Postgres/Meilisearch/Sequin
  # stay on Docker Compose (`task service:up`), and keeping their secrets out of
  # the process env preserves the isolation the old zellij orchestrator enforced.
  processes = {
    auth.exec = "task auth:dev";
    server.exec = "task server:dev";
    history.exec = "task history:dev";
    "job-runner".exec = "task job-runner:dev";
    reaction.exec = "task reaction:dev";
    ranking.exec = "task ranking:dev";
    notify.exec = "task notify:dev";
    app.exec = "task app:dev";
    admin.exec = "task admin:dev";
  };
}
