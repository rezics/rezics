{ pkgs, inputs, ... }:

{
  env = {
    S3_ENDPOINT = "http://127.0.0.1:9000";
    S3_BUCKET = "rezics";
    S3_REGION = "us-east-1";
    S3_ACCESS_KEY_ID = "rustfsadmin";
    S3_SECRET_ACCESS_KEY = "rustfsadmin";
    MEDIA_PUBLIC_BASE_URL = "http://127.0.0.1:9000/rezics";
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
    pkgs.sops
    pkgs.age
  ];

  # Local dev processes, started together via `devenv up` (process-compose).
  # 本地开发进程，通过 `devenv up`（process-compose）统一启动。
  # Each delegates to the package's authoritative go-task `dev` task, which runs
  # in the package dir (root Taskfile `includes` `dir:`) and loads its own `.env`.
  # Infrastructure (Postgres/Meilisearch/Sequin/RustFS) runs in Nomad containers;
  # only app services live here as host processes.
  # 基础设施（Postgres/Meilisearch/Sequin/RustFS）在 Nomad 容器中运行；
  # 此处仅定义在主机上运行的应用服务。
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
