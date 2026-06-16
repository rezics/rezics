[[ define "workers" -]]

  // ── job-runner-http ───────────────────────────────────────

  group "job-runner-http" {
    network {
      port "http" {
        static = [[ var "job_runner_http_port" . ]]
        to     = 3005
      }
    }

    service {
      name     = "job-runner-http"
      port     = "http"
      provider = "nomad"

      check {
        type     = "http"
        port     = "http"
        path     = "/ready"
        interval = "10s"
        timeout  = "2s"
      }
    }

    task "ensure" {
      lifecycle {
        hook    = "prestart"
        sidecar = false
      }

      driver = "docker"

      config {
        image        = "[[ var "image_job_runner_migrate" . ]]"
        network_mode = "[[ var "network" . ]]"
        entrypoint   = ["/bin/sh", "-c"]
        args         = ["until cd /repo && bun run tool/src/cli.ts db:ensure 2>&1; do echo 'Waiting for database...'; sleep 2; done"]
      }

      env {
        JOB_DATABASE_URL = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_jobs"
      }

      resources {
        cpu    = 200
        memory = 512
      }
    }

    task "job-runner-http" {
      driver = "docker"

      config {
        image           = "[[ var "image_job_runner" . ]]"
        network_mode    = "[[ var "network" . ]]"
        network_aliases = ["job-runner-http"]
        ports           = ["http"]
      }

      env {
        PORT                     = "3005"
        NODE_ENV                 = "production"
        JOB_RUNNER_ROLE          = "http"
        JOB_DATABASE_URL         = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_jobs"
        SERVER_DATABASE_URL      = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_server"
        HISTORY_DATABASE_URL     = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_history"
        MEILI_HOST               = "http://meilisearch:7700"
        MEILI_MASTER_KEY         = "[[ var "meili_master_key" . ]]"
        JOB_RUNNER_INTERNAL_SECRET = "[[ var "job_runner_internal_secret" . ]]"
        SEQUIN_WEBHOOK_SECRET    = "[[ var "sequin_webhook_secret" . ]]"
        SEQUIN_HEALTH_URL        = "http://sequin:7376/health"
        RANKING_BASE_URL         = "http://ranking:3006"
        RANKING_INTERNAL_SECRET  = "[[ var "ranking_internal_secret" . ]]"
        OBSERVABILITY_LOG_FORMAT = "json"
      }

      resources {
        cpu    = 300
        memory = 384
      }
    }
  }

  // ── job-runner-worker ─────────────────────────────────────

  group "job-runner-worker" {
    task "job-runner-worker" {
      driver = "docker"

      config {
        image        = "[[ var "image_job_runner" . ]]"
        network_mode = "[[ var "network" . ]]"
      }

      env {
        NODE_ENV                           = "production"
        JOB_RUNNER_ROLE                    = "worker"
        JOB_WORKER_LANES                   = "default"
        JOB_DATABASE_URL                   = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_jobs"
        SERVER_DATABASE_URL                = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_server"
        HISTORY_DATABASE_URL               = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_history"
        DATABASE_URL                       = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_server"
        AUTH_INTERNAL_BASE_URL             = "http://auth:3001"
        AUTH_PUBLIC_BASE_URL               = "[[ var "auth_public_url" . ]]"
        AUTH_PUBLIC_ISSUER_URL             = "[[ var "auth_public_url" . ]]"
        AUTH_INTERNAL_TOKEN_GATEWAY_SECRET = "[[ var "auth_internal_token_gateway_secret" . ]]"
        SMTP_HOST                          = "[[ var "smtp_host" . ]]"
        SMTP_USER                          = "[[ var "smtp_user" . ]]"
        SMTP_PASSWORD                      = "[[ var "smtp_password" . ]]"
        TURNSTILE_SECRET                   = "[[ var "turnstile_secret" . ]]"
        MEILI_HOST                         = "http://meilisearch:7700"
        MEILI_MASTER_KEY                   = "[[ var "meili_master_key" . ]]"
        NOTIFY_BASE_URL                    = "http://notify:3002"
        NOTIFY_INTERNAL_SECRET             = "[[ var "notify_internal_secret" . ]]"
        REACTION_BASE_URL                  = "http://reaction:3003"
        REACTION_INTERNAL_SECRET           = "[[ var "reaction_internal_secret" . ]]"
        HISTORY_BASE_URL                   = "http://history:3004"
        HISTORY_INTERNAL_SECRET            = "[[ var "history_internal_secret" . ]]"
        JOB_RUNNER_BASE_URL                = "http://job-runner-http:3005"
        JOB_RUNNER_INTERNAL_SECRET         = "[[ var "job_runner_internal_secret" . ]]"
        RANKING_BASE_URL                   = "http://ranking:3006"
        RANKING_INTERNAL_SECRET            = "[[ var "ranking_internal_secret" . ]]"
        S3_ENDPOINT                        = "[[ var "s3_endpoint" . ]]"
        S3_ACCESS_KEY_ID                   = "[[ var "s3_access_key_id" . ]]"
        S3_SECRET_ACCESS_KEY               = "[[ var "s3_secret_access_key" . ]]"
        S3_BUCKET                          = "[[ var "s3_bucket" . ]]"
        S3_REGION                          = "[[ var "s3_region" . ]]"
        MEDIA_PUBLIC_BASE_URL              = "[[ var "media_public_base_url" . ]]"
        SEQUIN_WEBHOOK_SECRET              = "[[ var "sequin_webhook_secret" . ]]"
        OBSERVABILITY_LOG_FORMAT           = "json"
      }

      resources {
        cpu    = 500
        memory = 512
      }
    }
  }

  // ── ranking-worker ────────────────────────────────────────

  group "ranking-worker" {
    task "ranking-worker" {
      driver = "docker"

      config {
        image        = "[[ var "image_job_runner" . ]]"
        network_mode = "[[ var "network" . ]]"
      }

      env {
        NODE_ENV                           = "production"
        JOB_RUNNER_ROLE                    = "worker"
        JOB_WORKER_LANES                   = "ranking"
        JOB_DATABASE_URL                   = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_jobs"
        SERVER_DATABASE_URL                = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_server"
        HISTORY_DATABASE_URL               = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_history"
        DATABASE_URL                       = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_server"
        AUTH_INTERNAL_BASE_URL             = "http://auth:3001"
        AUTH_PUBLIC_BASE_URL               = "[[ var "auth_public_url" . ]]"
        AUTH_PUBLIC_ISSUER_URL             = "[[ var "auth_public_url" . ]]"
        AUTH_INTERNAL_TOKEN_GATEWAY_SECRET = "[[ var "auth_internal_token_gateway_secret" . ]]"
        SMTP_HOST                          = "[[ var "smtp_host" . ]]"
        SMTP_USER                          = "[[ var "smtp_user" . ]]"
        SMTP_PASSWORD                      = "[[ var "smtp_password" . ]]"
        TURNSTILE_SECRET                   = "[[ var "turnstile_secret" . ]]"
        MEILI_HOST                         = "http://meilisearch:7700"
        MEILI_MASTER_KEY                   = "[[ var "meili_master_key" . ]]"
        NOTIFY_BASE_URL                    = "http://notify:3002"
        NOTIFY_INTERNAL_SECRET             = "[[ var "notify_internal_secret" . ]]"
        REACTION_BASE_URL                  = "http://reaction:3003"
        REACTION_INTERNAL_SECRET           = "[[ var "reaction_internal_secret" . ]]"
        HISTORY_BASE_URL                   = "http://history:3004"
        HISTORY_INTERNAL_SECRET            = "[[ var "history_internal_secret" . ]]"
        JOB_RUNNER_BASE_URL                = "http://job-runner-http:3005"
        JOB_RUNNER_INTERNAL_SECRET         = "[[ var "job_runner_internal_secret" . ]]"
        RANKING_BASE_URL                   = "http://ranking:3006"
        RANKING_INTERNAL_SECRET            = "[[ var "ranking_internal_secret" . ]]"
        S3_ENDPOINT                        = "[[ var "s3_endpoint" . ]]"
        S3_ACCESS_KEY_ID                   = "[[ var "s3_access_key_id" . ]]"
        S3_SECRET_ACCESS_KEY               = "[[ var "s3_secret_access_key" . ]]"
        S3_BUCKET                          = "[[ var "s3_bucket" . ]]"
        S3_REGION                          = "[[ var "s3_region" . ]]"
        MEDIA_PUBLIC_BASE_URL              = "[[ var "media_public_base_url" . ]]"
        SEQUIN_WEBHOOK_SECRET              = "[[ var "sequin_webhook_secret" . ]]"
        OBSERVABILITY_LOG_FORMAT           = "json"
      }

      resources {
        cpu    = 500
        memory = 512
      }
    }
  }

[[- end ]]
