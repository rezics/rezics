[[ define "app" -]]
  group "app" {
    network {
      port "backend" {
        static       = 3000
        host_network = "loopback"
      }
      port "job_runner" {
        static       = 3005
        host_network = "loopback"
      }
      port "app" {
        static       = 35001
        host_network = "loopback"
      }
    }

    # ── backend ─────────────────────────────────────────────

    task "backend" {
      driver = "raw_exec"

      config {
        command = "/bin/sh"
        args    = ["${NOMAD_TASK_DIR}/run.sh"]
      }

      template {
        data        = <<-SCRIPT
        #!/bin/sh
        until pg_isready -h 127.0.0.1 -p 5432 -q 2>/dev/null; do sleep 1; done
        cd [[ var "project_root" . ]]
        exec task backend:dev
        SCRIPT
        destination = "local/run.sh"
        perms       = "0755"
      }

      env {
        NODE_ENV                          = "development"
        BACKEND_PORT                      = "3000"
        PORT                              = "3000"
        SERVER_PORT                       = "3000"
        OBSERVABILITY_TELEMETRY           = "disabled"
        DATABASE_URL                      = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@127.0.0.1:5432/rezics_server"
        SERVER_DATABASE_URL               = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@127.0.0.1:5432/rezics_server"
        AUTH_DATABASE_URL                 = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@127.0.0.1:5432/rezics_auth"
        NOTIFY_DATABASE_URL               = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@127.0.0.1:5432/rezics_notify"
        REACTION_DATABASE_URL             = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@127.0.0.1:5432/rezics_reaction"
        HISTORY_DATABASE_URL              = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@127.0.0.1:5432/rezics_history"
        RANKING_DATABASE_URL              = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@127.0.0.1:5432/rezics_ranking"
        AUTH_INTERNAL_BASE_URL            = "http://127.0.0.1:3000/__services/auth"
        AUTH_PUBLIC_BASE_URL              = "http://localhost:3000/auth"
        AUTH_PUBLIC_ISSUER_URL            = "http://localhost:3000"
        BETTER_AUTH_URL                   = "http://127.0.0.1:3000/__services/auth"
        AUTH_INTERNAL_TOKEN_GATEWAY_SECRET = "dev-auth-internal-token-gateway-secret"
        BETTER_AUTH_SECRET                = "dev-better-auth-secret"
        AUTH_TRUSTED_ORIGINS              = "http://localhost:3000,http://localhost:35001,http://127.0.0.1:35001,http://localhost:8000"
        SERVER_JWKS_URL                   = "http://127.0.0.1:3000/.well-known/jwks.json"
        NOTIFY_BASE_URL                   = "http://127.0.0.1:3000/__services/notify"
        NOTIFY_INTERNAL_SECRET            = "dev-notify-internal-secret"
        REACTION_BASE_URL                 = "http://127.0.0.1:3000/__services/reaction"
        REACTION_INTERNAL_SECRET          = "dev-reaction-internal-secret"
        HISTORY_BASE_URL                  = "http://127.0.0.1:3000/__services/history"
        HISTORY_INTERNAL_SECRET           = "dev-history-internal-secret"
        JOB_RUNNER_BASE_URL               = "http://127.0.0.1:3005"
        JOB_RUNNER_INTERNAL_SECRET        = "dev-job-runner-internal-secret"
        RANKING_BASE_URL                  = "http://127.0.0.1:3000/__services/ranking"
        RANKING_INTERNAL_SECRET           = "dev-ranking-internal-secret"
        MEILI_HOST                        = "http://127.0.0.1:7700"
        MEILI_MASTER_KEY                  = "[[ var "meili_master_key" . ]]"
        SMTP_HOST                         = "localhost"
        SMTP_USER                         = "dev"
        SMTP_PASSWORD                     = "dev"
        TURNSTILE_SECRET                  = "dev-turnstile-secret"
      }

      resources {
        cpu        = 1000
        memory     = 1024
        memory_max = 1536
      }
    }

    # ── job-runner ──────────────────────────────────────────

    task "job-runner" {
      driver = "raw_exec"

      config {
        command = "/bin/sh"
        args    = ["${NOMAD_TASK_DIR}/run.sh"]
      }

      template {
        data        = <<-SCRIPT
        #!/bin/sh
        until pg_isready -h 127.0.0.1 -p 5432 -q 2>/dev/null; do sleep 1; done
        until curl -sf http://127.0.0.1:7376/health >/dev/null 2>&1; do sleep 2; done
        cd [[ var "project_root" . ]]
        exec task job-runner:dev
        SCRIPT
        destination = "local/run.sh"
        perms       = "0755"
      }

      env {
        NODE_ENV                   = "development"
        PORT                       = "3005"
        OBSERVABILITY_TELEMETRY    = "disabled"
        JOB_DATABASE_URL           = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@127.0.0.1:5432/rezics_jobs"
        SERVER_DATABASE_URL        = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@127.0.0.1:5432/rezics_server"
        HISTORY_DATABASE_URL       = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@127.0.0.1:5432/rezics_history"
        HISTORY_INTERNAL_SECRET    = "dev-history-internal-secret"
        MEILI_HOST                 = "http://127.0.0.1:7700"
        MEILI_MASTER_KEY           = "[[ var "meili_master_key" . ]]"
        JOB_RUNNER_INTERNAL_SECRET = "dev-job-runner-internal-secret"
        SEQUIN_WEBHOOK_SECRET      = "[[ var "sequin_webhook_secret" . ]]"
        SEQUIN_HEALTH_URL          = "http://127.0.0.1:7376/health"
        RANKING_BASE_URL           = "http://127.0.0.1:3000/__services/ranking"
        RANKING_INTERNAL_SECRET    = "dev-ranking-internal-secret"
      }

      resources {
        cpu        = 500
        memory     = 512
        memory_max = 768
      }
    }

    # ── frontend ────────────────────────────────────────────

    task "frontend" {
      driver = "raw_exec"

      config {
        command = "/bin/sh"
        args    = ["${NOMAD_TASK_DIR}/run.sh"]
      }

      template {
        data        = <<-SCRIPT
        #!/bin/sh
        cd [[ var "project_root" . ]]
        exec task frontend:dev
        SCRIPT
        destination = "local/run.sh"
        perms       = "0755"
      }

      env {
        NODE_ENV                         = "development"
        NEXT_PUBLIC_API_BASE_URL         = "http://localhost:3000"
        NEXT_PUBLIC_REACTION_SERVICE_URL = "http://localhost:3000/__services/reaction"
      }

      resources {
        cpu    = 300
        memory = 384
      }
    }
  }
[[- end ]]
