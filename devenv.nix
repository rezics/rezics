{ pkgs, ... }:

let
  garageS3Port = 3900;
  garageAdminPort = 3901;
  garageRpcPort = 3902;
  garageWebPort = 3903;
  browsers =
    (builtins.fromJSON (builtins.readFile "${pkgs.playwright-driver}/browsers.json")).browsers;
  chromium-rev = (builtins.head (builtins.filter (x: x.name == "chromium") browsers)).revision;
in

{
  env = {
    PLAYWRIGHT_BROWSERS_PATH = "${pkgs.playwright-driver.browsers}";
    PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = "true";
    PLAYWRIGHT_MCP_EXECUTABLE_PATH = "${pkgs.playwright-driver.browsers}/chromium-${chromium-rev}/chrome-linux64/chrome";
    S3_ENDPOINT = "http://127.0.0.1:${toString garageS3Port}";
    S3_BUCKET = "rezics";
    S3_REGION = "garage";
    MEDIA_PUBLIC_BASE_URL = "http://rezics.web.localhost:${toString garageWebPort}";
  };

  enterShell = ''
    if [ -f "$DEVENV_STATE/garage/credentials.env" ]; then
      source "$DEVENV_STATE/garage/credentials.env"
    fi
  '';

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
    pkgs.garage
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

    garage.exec = ''
      set -euo pipefail
      GARAGE_DIR="$DEVENV_STATE/garage"
      mkdir -p "$GARAGE_DIR/data" "$GARAGE_DIR/meta"

      if [ ! -f "$GARAGE_DIR/rpc_secret" ]; then
        openssl rand -hex 32 > "$GARAGE_DIR/rpc_secret"
      fi
      RPC_SECRET=$(cat "$GARAGE_DIR/rpc_secret")

      cat > "$GARAGE_DIR/garage.toml" <<TOML
      metadata_dir = "$GARAGE_DIR/meta"
      data_dir = "$GARAGE_DIR/data"
      db_engine = "lmdb"
      replication_factor = 1

      rpc_bind_addr = "127.0.0.1:${toString garageRpcPort}"
      rpc_secret = "$RPC_SECRET"

      [s3_api]
      s3_region = "garage"
      api_bind_addr = "127.0.0.1:${toString garageS3Port}"

      [s3_web]
      bind_addr = "127.0.0.1:${toString garageWebPort}"
      root_domain = ".web.localhost"
      index = "index.html"

      [admin]
      api_bind_addr = "127.0.0.1:${toString garageAdminPort}"
      TOML

      exec garage -c "$GARAGE_DIR/garage.toml" server
    '';

    garage-setup = {
      exec = ''
        set -euo pipefail
        GARAGE_DIR="$DEVENV_STATE/garage"
        GARAGE_CONFIG="$GARAGE_DIR/garage.toml"

        until garage -c "$GARAGE_CONFIG" status >/dev/null 2>&1; do
          echo "Waiting for Garage..."
          sleep 1
        done

        if [ ! -f "$GARAGE_DIR/.initialized" ]; then
          NODE_ID=$(garage -c "$GARAGE_CONFIG" status | awk '/^[0-9a-f]{16}/ {print $1; exit}')
          garage -c "$GARAGE_CONFIG" layout assign -z dc1 -c 1G "$NODE_ID"
          garage -c "$GARAGE_CONFIG" layout apply --version 1

          garage -c "$GARAGE_CONFIG" bucket create rezics

          KEY_OUTPUT=$(garage -c "$GARAGE_CONFIG" key create rezics-dev-key)
          ACCESS_KEY=$(echo "$KEY_OUTPUT" | awk '/Key ID:/ {print $3}')
          SECRET_KEY=$(echo "$KEY_OUTPUT" | awk '/Secret key:/ {print $3}')
          printf 'export S3_ACCESS_KEY_ID="%s"\nexport S3_SECRET_ACCESS_KEY="%s"\n' "$ACCESS_KEY" "$SECRET_KEY" > "$GARAGE_DIR/credentials.env"

          garage -c "$GARAGE_CONFIG" bucket allow --read --write --owner rezics --key rezics-dev-key

          touch "$GARAGE_DIR/.initialized"
          echo "Garage initialized. Restart shell to load credentials."
        fi

        garage -c "$GARAGE_CONFIG" bucket website --allow rezics

        source "$GARAGE_DIR/credentials.env"
        node --input-type=module <<'SCRIPT'
        import { createHash, createHmac } from "node:crypto";
        const endpoint = "http://127.0.0.1:${toString garageS3Port}";
        const bucket = "rezics";
        const region = "garage";
        const host = "127.0.0.1:${toString garageS3Port}";
        const accessKeyId = process.env.S3_ACCESS_KEY_ID;
        const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
        const corsXml = '<?xml version="1.0" encoding="UTF-8"?><CORSConfiguration><CORSRule><AllowedOrigin>http://localhost:35001</AllowedOrigin><AllowedMethod>PUT</AllowedMethod><AllowedHeader>*</AllowedHeader><MaxAgeSeconds>3600</MaxAgeSeconds></CORSRule><CORSRule><AllowedOrigin>http://localhost:35002</AllowedOrigin><AllowedMethod>PUT</AllowedMethod><AllowedHeader>*</AllowedHeader><MaxAgeSeconds>3600</MaxAgeSeconds></CORSRule></CORSConfiguration>';
        const now = new Date();
        const dateStamp = now.toISOString().replace(/-/g, "").slice(0, 8);
        const amzDate = dateStamp + "T" + now.toISOString().slice(11, 19).replace(/:/g, "") + "Z";
        const payloadHash = createHash("sha256").update(corsXml).digest("hex");
        const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
        const canonicalRequest = ["PUT", "/" + bucket, "cors=", "content-type:application/xml\nhost:" + host + "\nx-amz-content-sha256:" + payloadHash + "\nx-amz-date:" + amzDate + "\n", signedHeaders, payloadHash].join("\n");
        const credentialScope = dateStamp + "/" + region + "/s3/aws4_request";
        const stringToSign = "AWS4-HMAC-SHA256\n" + amzDate + "\n" + credentialScope + "\n" + createHash("sha256").update(canonicalRequest).digest("hex");
        const hmac = (key, data) => createHmac("sha256", key).update(data).digest();
        const signingKey = hmac(hmac(hmac(hmac("AWS4" + secretAccessKey, dateStamp), region), "s3"), "aws4_request");
        const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
        const res = await fetch(endpoint + "/" + bucket + "?cors", {
          method: "PUT",
          body: corsXml,
          headers: {
            "content-type": "application/xml",
            "x-amz-content-sha256": payloadHash,
            "x-amz-date": amzDate,
            authorization: "AWS4-HMAC-SHA256 Credential=" + accessKeyId + "/" + credentialScope + ", SignedHeaders=" + signedHeaders + ", Signature=" + signature,
          },
        });
        if (!res.ok) process.exit(1);
        SCRIPT
        echo "Garage setup complete."
      '';

      process-compose.depends_on = {
        garage.condition = "process_started";
      };
    };
  };
}
