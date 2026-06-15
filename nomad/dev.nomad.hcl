# Unified local dev job — infra + app in one group for automatic port discovery.
# 统一本地开发 job — 基础设施与应用同组部署，通过 NOMAD_PORT_<label> 自动发现端口。
#
# Prerequisites / 前置条件:
#   - Nomad agent must have `task` (go-task) and `bun` on PATH.
#     Nomad agent 的 PATH 中须包含 task（go-task）和 bun。
#   - Nix store paths in `meta` must match installed versions.
#     meta 中的 Nix store 路径须与已安装版本匹配。
#
# Run / 运行:  nomad job run nomad/dev.nomad.hcl

job "rezics-dev" {
  type = "service"

  update {
    min_healthy_time  = "5s"
    healthy_deadline  = "3m"
    progress_deadline = "0s"
    auto_revert       = false
  }

  group "dev" {
    count = 1

    # ── Configurable paths / 可配置路径 ──────────────────────
    # Update Nix store paths after system updates.
    # 系统更新后需同步 Nix store 路径。
    meta {
      repo_root       = "/home/n/Programming/rezics/rezics"
      data_root       = "/home/n/.local/share/rezics-dev"
      pg_bin          = "/nix/store/833dwx7lgfdfyzkmavd5rpd2sl4dngbh-postgresql-18.3/bin"
      meilisearch_bin = "/nix/store/4hpcp1v5qprsrsv4qd7x3fyp9jq8k804-meilisearch-1.45.2/bin/meilisearch"
      redis_bin       = "/nix/store/zkd0ckjz5v4izrbb719rhw6y7bb6z4sp-redis-8.8.0/bin/redis-server"
      garage_bin      = "/nix/store/q5vd8qnxrfdx6rmh6z78nik33z38sb0y-garage-1.3.1/bin/garage"
    }

    restart {
      attempts = 50
      delay    = "5s"
      interval = "30m"
      mode     = "delay"
    }

    reschedule {
      unlimited      = true
      delay          = "30s"
      max_delay      = "5m"
      delay_function = "exponential"
    }

    # ── Ports / 端口 ────────────────────────────────────────
    # All tasks in this group receive NOMAD_PORT_<label> env vars.
    # 同组所有 task 自动获得 NOMAD_PORT_<label> 环境变量。
    network {
      # Infrastructure / 基础设施
      port "db"         { static = 5432 }
      port "meili"      { static = 7700 }
      port "redis"      { static = 6379 }
      port "s3"         { static = 9000 }
      port "s3_rpc"     { static = 3901 }
      port "s3_admin"   { static = 3903 }
      port "sequin"     { static = 7376 }

      # Application services / 应用服务
      port "server"     { static = 3000 }
      port "auth"       { static = 3001 }
      port "notify"     { static = 3002 }
      port "reaction"   { static = 3003 }
      port "history"    { static = 3004 }
      port "job_runner" { static = 3005 }
      port "ranking"    { static = 3006 }
      port "app"        { static = 35001 }
      port "admin"      { static = 35002 }
    }

    # ════════════════════════════════════════════════════════
    #  INFRASTRUCTURE / 基础设施
    # ════════════════════════════════════════════════════════

    task "postgres" {
      driver = "raw_exec"

      config {
        command = "/bin/bash"
        args    = ["${NOMAD_TASK_DIR}/run.sh"]
      }

      template {
        data        = <<-SCRIPT
        #!/bin/bash
        set -euo pipefail
        PGBIN="{{ env "NOMAD_META_pg_bin" }}"
        DATADIR="{{ env "NOMAD_META_data_root" }}/postgres/data"
        RUNDIR="{{ env "NOMAD_META_data_root" }}/postgres/run"
        mkdir -p "$DATADIR" "$RUNDIR"

        if [ ! -f "$DATADIR/PG_VERSION" ]; then
          echo "==> initdb"
          "$PGBIN/initdb" -D "$DATADIR" --auth=trust --encoding=UTF8 --locale=C
        fi

        "$PGBIN/postgres" \
          -D "$DATADIR" \
          -p {{ env "NOMAD_PORT_db" }} \
          -k "$RUNDIR" \
          -c listen_addresses=127.0.0.1 \
          -c wal_level=logical \
          -c max_replication_slots=10 \
          -c max_wal_senders=10 &
        PG_PID=$!

        until "$PGBIN/pg_isready" -h 127.0.0.1 -p {{ env "NOMAD_PORT_db" }} -q; do sleep 0.3; done

        # Ensure the `postgres` superuser role exists (initdb creates the OS user as superuser).
        # 确保 postgres 超级用户角色存在（initdb 以操作系统用户创建超级用户）。
        "$PGBIN/psql" -h 127.0.0.1 -p {{ env "NOMAD_PORT_db" }} -d template1 -tc \
          "SELECT 1 FROM pg_roles WHERE rolname='postgres'" | grep -q 1 || \
          "$PGBIN/psql" -h 127.0.0.1 -p {{ env "NOMAD_PORT_db" }} -d template1 -c \
            "CREATE ROLE postgres SUPERUSER LOGIN"

        for db in rezics_server rezics_auth rezics_notify rezics_reaction \
                  rezics_history rezics_ranking rezics_jobs sequin; do
          "$PGBIN/createdb" -h 127.0.0.1 -p {{ env "NOMAD_PORT_db" }} \
            --maintenance-db=template1 "$db" 2>/dev/null || true
        done

        echo "==> postgres ready on :{{ env "NOMAD_PORT_db" }}, databases ensured"
        wait $PG_PID
        SCRIPT
        destination = "local/run.sh"
        perms       = "0755"
      }

      resources {
        cpu        = 1000
        memory     = 1024
        memory_max = 1536
      }
    }

    task "meilisearch" {
      driver = "raw_exec"

      config {
        command = "${NOMAD_META_meilisearch_bin}"
        args = [
          "--db-path", "${NOMAD_META_data_root}/meilisearch/data",
          "--http-addr", "127.0.0.1:${NOMAD_PORT_meili}",
          "--env", "development",
          "--master-key", "masterKey",
          "--no-analytics",
        ]
      }

      resources {
        cpu        = 500
        memory     = 512
        memory_max = 768
      }
    }

    task "redis" {
      driver = "raw_exec"

      config {
        command = "${NOMAD_META_redis_bin}"
        args = [
          "--port", "${NOMAD_PORT_redis}",
          "--bind", "127.0.0.1",
          "--save", "",
          "--dir", "${NOMAD_META_data_root}/redis",
        ]
      }

      resources {
        cpu    = 200
        memory = 128
      }
    }

    task "garage" {
      driver = "raw_exec"

      config {
        command = "/bin/bash"
        args    = ["${NOMAD_TASK_DIR}/run.sh"]
      }

      template {
        data        = <<-SCRIPT
        #!/bin/bash
        set -euo pipefail
        GARAGE="{{ env "NOMAD_META_garage_bin" }}"
        ROOT="{{ env "NOMAD_META_data_root" }}/garage"
        CONFIG="$ROOT/garage.toml"
        mkdir -p "$ROOT/meta" "$ROOT/data"

        if [ ! -f "$CONFIG" ]; then
          RPC_SECRET=$(openssl rand -hex 32)
          cat > "$CONFIG" <<TOML
        metadata_dir = "$ROOT/meta"
        data_dir = [{ path = "$ROOT/data", capacity = "10G" }]
        db_engine = "lmdb"
        replication_factor = 1
        rpc_bind_addr = "127.0.0.1:{{ env "NOMAD_PORT_s3_rpc" }}"
        rpc_secret = "$RPC_SECRET"

        [s3_api]
        s3_region = "us-east-1"
        api_bind_addr = "127.0.0.1:{{ env "NOMAD_PORT_s3" }}"

        [admin]
        api_bind_addr = "127.0.0.1:{{ env "NOMAD_PORT_s3_admin" }}"
        admin_token = "dev-admin-token"
        TOML
        fi

        export GARAGE_CONFIG_FILE="$CONFIG"
        "$GARAGE" server &
        GARAGE_PID=$!

        for i in $(seq 1 30); do
          "$GARAGE" status >/dev/null 2>&1 && break
          sleep 0.5
        done

        NEEDS_LAYOUT=false
        if ! "$GARAGE" layout show 2>/dev/null | grep -q "CAPACITY"; then
          NEEDS_LAYOUT=true
        fi

        if [ "$NEEDS_LAYOUT" = "true" ]; then
          NODE_ID=$("$GARAGE" node id -q 2>/dev/null | cut -c1-16)
          "$GARAGE" layout assign "$NODE_ID" --zone dc1 --capacity 10G 2>/dev/null || true
          "$GARAGE" layout apply --version 1 2>/dev/null || true
        fi

        if ! "$GARAGE" key info rustfsadmin >/dev/null 2>&1; then
          "$GARAGE" key import rustfsadmin \
            --secret-key rustfsadmin 2>/dev/null || true
        fi

        if ! "$GARAGE" bucket info rezics >/dev/null 2>&1; then
          "$GARAGE" bucket create rezics 2>/dev/null || true
          KEY_ID=$("$GARAGE" key info rustfsadmin 2>/dev/null \
            | grep "Key ID" | awk '{print $NF}') || true
          if [ -n "$KEY_ID" ]; then
            "$GARAGE" bucket allow --read --write --owner rezics \
              --key "$KEY_ID" 2>/dev/null || true
          fi
        fi

        echo "==> garage S3 ready on :{{ env "NOMAD_PORT_s3" }}"
        wait $GARAGE_PID
        SCRIPT
        destination = "local/run.sh"
        perms       = "0755"
      }

      resources {
        cpu    = 300
        memory = 256
      }
    }

    task "sequin" {
      driver = "docker"

      config {
        image        = "sequin/sequin:v0.14.6"
        network_mode = "host"
      }

      env {
        ENV                  = "development"
        PG_HOSTNAME          = "127.0.0.1"
        PG_PORT              = "5432"
        PG_DATABASE          = "sequin"
        PG_USERNAME          = "postgres"
        PG_PASSWORD          = "postgres"
        PG_POOL_SIZE         = "10"
        REDIS_URL            = "redis://127.0.0.1:6379"
        SECRET_KEY_BASE      = "ENxZNJ8GgthCCaRFFuOUO8ZgSVihwgDsrwyEzzbqGM8aym4V9tlsR2cwv7VN5I9v"
        VAULT_KEY            = "wYd0etI+QcXxPj0Qq6cFkI91TSSK7IlQvcToD+JJnjY="
        SEQUIN_WEBHOOK_SECRET = "6a4ded3260d452d5ce5afc38f440abba8c966dabdd8a755ef53238c2cd3c6347"
        SOURCE_DB_HOST       = "127.0.0.1"
        SOURCE_DB_PORT       = "5432"
        SOURCE_DB_NAME       = "rezics_server"
        SOURCE_DB_USER       = "postgres"
        SOURCE_DB_PASSWORD   = "postgres"
        SOURCE_DB_POOL_SIZE  = "10"
        REACTION_DB_HOST     = "127.0.0.1"
        REACTION_DB_PORT     = "5432"
        REACTION_DB_NAME     = "rezics_reaction"
        REACTION_DB_USER     = "postgres"
        REACTION_DB_PASSWORD = "postgres"
        REACTION_DB_POOL_SIZE = "5"
        JOB_RUNNER_BASE_URL  = "http://127.0.0.1:3005"
      }

      resources {
        cpu    = 300
        memory = 384
      }
    }

    # ════════════════════════════════════════════════════════
    #  APPLICATION SERVICES / 应用服务
    # ════════════════════════════════════════════════════════

    task "server" {
      driver = "raw_exec"

      config {
        command = "/bin/bash"
        args    = ["${NOMAD_TASK_DIR}/run.sh"]
      }

      template {
        data        = <<-SCRIPT
        #!/bin/bash
        until {{ env "NOMAD_META_pg_bin" }}/pg_isready -h 127.0.0.1 -p {{ env "NOMAD_PORT_db" }} -q 2>/dev/null; do sleep 1; done
        cd {{ env "NOMAD_META_repo_root" }}
        exec task server:dev
        SCRIPT
        destination = "local/run.sh"
        perms       = "0755"
      }

      env {
        NODE_ENV     = "development"
        DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:${NOMAD_PORT_db}/rezics_server"
      }

      resources {
        cpu        = 500
        memory     = 512
        memory_max = 768
      }
    }

    task "auth" {
      driver = "raw_exec"

      config {
        command = "/bin/bash"
        args    = ["${NOMAD_TASK_DIR}/run.sh"]
      }

      template {
        data        = <<-SCRIPT
        #!/bin/bash
        until {{ env "NOMAD_META_pg_bin" }}/pg_isready -h 127.0.0.1 -p {{ env "NOMAD_PORT_db" }} -q 2>/dev/null; do sleep 1; done
        cd {{ env "NOMAD_META_repo_root" }}
        exec task auth:dev
        SCRIPT
        destination = "local/run.sh"
        perms       = "0755"
      }

      env {
        NODE_ENV     = "development"
        DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:${NOMAD_PORT_db}/rezics_auth"
      }

      resources {
        cpu        = 300
        memory     = 384
        memory_max = 512
      }
    }

    task "history" {
      driver = "raw_exec"

      config {
        command = "/bin/bash"
        args    = ["${NOMAD_TASK_DIR}/run.sh"]
      }

      template {
        data        = <<-SCRIPT
        #!/bin/bash
        until {{ env "NOMAD_META_pg_bin" }}/pg_isready -h 127.0.0.1 -p {{ env "NOMAD_PORT_db" }} -q 2>/dev/null; do sleep 1; done
        cd {{ env "NOMAD_META_repo_root" }}
        exec task history:dev
        SCRIPT
        destination = "local/run.sh"
        perms       = "0755"
      }

      env {
        NODE_ENV = "development"
      }

      resources {
        cpu    = 200
        memory = 256
      }
    }

    task "job-runner" {
      driver = "raw_exec"

      config {
        command = "/bin/bash"
        args    = ["${NOMAD_TASK_DIR}/run.sh"]
      }

      template {
        data        = <<-SCRIPT
        #!/bin/bash
        until {{ env "NOMAD_META_pg_bin" }}/pg_isready -h 127.0.0.1 -p {{ env "NOMAD_PORT_db" }} -q 2>/dev/null; do sleep 1; done
        until curl -sf http://127.0.0.1:{{ env "NOMAD_PORT_sequin" }}/health >/dev/null 2>&1; do sleep 2; done
        cd {{ env "NOMAD_META_repo_root" }}
        exec task job-runner:dev
        SCRIPT
        destination = "local/run.sh"
        perms       = "0755"
      }

      env {
        NODE_ENV = "development"
      }

      resources {
        cpu    = 300
        memory = 384
      }
    }

    task "reaction" {
      driver = "raw_exec"

      config {
        command = "/bin/bash"
        args    = ["${NOMAD_TASK_DIR}/run.sh"]
      }

      template {
        data        = <<-SCRIPT
        #!/bin/bash
        until {{ env "NOMAD_META_pg_bin" }}/pg_isready -h 127.0.0.1 -p {{ env "NOMAD_PORT_db" }} -q 2>/dev/null; do sleep 1; done
        cd {{ env "NOMAD_META_repo_root" }}
        exec task reaction:dev
        SCRIPT
        destination = "local/run.sh"
        perms       = "0755"
      }

      env {
        NODE_ENV = "development"
      }

      resources {
        cpu    = 200
        memory = 256
      }
    }

    task "ranking" {
      driver = "raw_exec"

      config {
        command = "/bin/bash"
        args    = ["${NOMAD_TASK_DIR}/run.sh"]
      }

      template {
        data        = <<-SCRIPT
        #!/bin/bash
        until {{ env "NOMAD_META_pg_bin" }}/pg_isready -h 127.0.0.1 -p {{ env "NOMAD_PORT_db" }} -q 2>/dev/null; do sleep 1; done
        cd {{ env "NOMAD_META_repo_root" }}
        exec task ranking:dev
        SCRIPT
        destination = "local/run.sh"
        perms       = "0755"
      }

      env {
        NODE_ENV = "development"
      }

      resources {
        cpu    = 200
        memory = 256
      }
    }

    task "notify" {
      driver = "raw_exec"

      config {
        command = "/bin/bash"
        args    = ["${NOMAD_TASK_DIR}/run.sh"]
      }

      template {
        data        = <<-SCRIPT
        #!/bin/bash
        until {{ env "NOMAD_META_pg_bin" }}/pg_isready -h 127.0.0.1 -p {{ env "NOMAD_PORT_db" }} -q 2>/dev/null; do sleep 1; done
        cd {{ env "NOMAD_META_repo_root" }}
        exec task notify:dev
        SCRIPT
        destination = "local/run.sh"
        perms       = "0755"
      }

      env {
        NODE_ENV = "development"
      }

      resources {
        cpu    = 200
        memory = 256
      }
    }

    task "app" {
      driver = "raw_exec"

      config {
        command = "/bin/bash"
        args    = ["${NOMAD_TASK_DIR}/run.sh"]
      }

      template {
        data        = <<-SCRIPT
        #!/bin/bash
        cd {{ env "NOMAD_META_repo_root" }}
        exec task app:dev
        SCRIPT
        destination = "local/run.sh"
        perms       = "0755"
      }

      env {
        NODE_ENV = "development"
      }

      resources {
        cpu        = 500
        memory     = 512
        memory_max = 768
      }
    }

    task "admin" {
      driver = "raw_exec"

      config {
        command = "/bin/bash"
        args    = ["${NOMAD_TASK_DIR}/run.sh"]
      }

      template {
        data        = <<-SCRIPT
        #!/bin/bash
        cd {{ env "NOMAD_META_repo_root" }}
        exec task admin:dev
        SCRIPT
        destination = "local/run.sh"
        perms       = "0755"
      }

      env {
        NODE_ENV = "development"
      }

      resources {
        cpu    = 300
        memory = 384
      }
    }
  }
}
