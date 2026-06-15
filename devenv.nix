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

  # Fallback process-compose definitions, started via `devenv up`.
  # process-compose 后备定义，通过 `devenv up` 启动。
  # Primary dev orchestration is via Nomad: `nomad job run nomad/dev.nomad.hcl`
  # (unified job with infra + app in one group for automatic port discovery).
  # 主要开发编排已迁移到 Nomad: `nomad job run nomad/dev.nomad.hcl`
  # （基础设施与应用同组部署，通过 NOMAD_PORT 自动发现端口）。
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
