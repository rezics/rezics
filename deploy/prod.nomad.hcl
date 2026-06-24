// ── Docker images (required) ────────────────────────────────────────────────

variable "image_server" {
  description = "ghcr.io/rezics/rezics-server:sha-<sha>"
  type        = string
}

variable "image_auth" {
  description = "ghcr.io/rezics/rezics-auth:sha-<sha>"
  type        = string
}

variable "image_notify" {
  description = "ghcr.io/rezics/rezics-notify:sha-<sha>"
  type        = string
}

variable "image_reaction" {
  description = "ghcr.io/rezics/rezics-reaction:sha-<sha>"
  type        = string
}

variable "image_history" {
  description = "ghcr.io/rezics/rezics-history:sha-<sha>"
  type        = string
}

variable "image_ranking" {
  description = "ghcr.io/rezics/rezics-ranking:sha-<sha>"
  type        = string
}

variable "image_preview" {
  description = "ghcr.io/rezics/rezics-preview:sha-<sha>"
  type        = string
}

variable "image_job_runner" {
  description = "ghcr.io/rezics/rezics-job-runner:sha-<sha>"
  type        = string
}

variable "image_server_migrate" {
  description = "ghcr.io/rezics/rezics-server-migrate:sha-<sha>"
  type        = string
}

variable "image_auth_migrate" {
  description = "ghcr.io/rezics/rezics-auth-migrate:sha-<sha>"
  type        = string
}

variable "image_notify_migrate" {
  description = "ghcr.io/rezics/rezics-notify-migrate:sha-<sha>"
  type        = string
}

variable "image_reaction_migrate" {
  description = "ghcr.io/rezics/rezics-reaction-migrate:sha-<sha>"
  type        = string
}

variable "image_history_migrate" {
  description = "ghcr.io/rezics/rezics-history-migrate:sha-<sha>"
  type        = string
}

variable "image_ranking_migrate" {
  description = "ghcr.io/rezics/rezics-ranking-migrate:sha-<sha>"
  type        = string
}

variable "image_job_runner_migrate" {
  description = "ghcr.io/rezics/rezics-job-runner-migrate:sha-<sha>"
  type        = string
}

// ── Network ─────────────────────────────────────────────────────────────────

variable "network" {
  description = "Docker network name"
  type        = string
  default     = "rezics"
}

// ── Public URLs (required) ──────────────────────────────────────────────────

variable "server_public_url" {
  description = "Public URL of the server API (e.g., https://api.rezics.com)"
  type        = string
}

variable "auth_public_url" {
  description = "Public URL of the auth service (e.g., https://auth.rezics.com)"
  type        = string
}

variable "media_public_base_url" {
  description = "Public URL for serving uploaded media (e.g., https://cdn.rezics.com/rezics)"
  type        = string
}

// ── Postgres (required) ─────────────────────────────────────────────────────

variable "postgres_user" {
  type = string
}

variable "postgres_password" {
  type = string
}

// ── Meilisearch (required) ──────────────────────────────────────────────────

variable "meili_master_key" {
  type = string
}

// ── S3 / RustFS (required) ──────────────────────────────────────────────────

variable "s3_endpoint" {
  description = "S3-compatible endpoint URL (e.g., http://rustfs:9000 or external)"
  type        = string
}

variable "s3_access_key_id" {
  type = string
}

variable "s3_secret_access_key" {
  type = string
}

variable "s3_bucket" {
  type    = string
  default = "rezics"
}

variable "s3_region" {
  type    = string
  default = "us-east-1"
}

// ── Sequin (required) ───────────────────────────────────────────────────────

variable "sequin_secret_key_base" {
  type = string
}

variable "sequin_vault_key" {
  type = string
}

variable "sequin_webhook_secret" {
  type = string
}

// ── Auth secrets (required) ─────────────────────────────────────────────────

variable "better_auth_secret" {
  type = string
}

variable "auth_internal_token_gateway_secret" {
  type = string
}

// ── Internal service secrets (required) ─────────────────────────────────────

variable "notify_internal_secret" {
  type = string
}

variable "reaction_internal_secret" {
  type = string
}

variable "history_internal_secret" {
  type = string
}

variable "job_runner_internal_secret" {
  type = string
}

variable "ranking_internal_secret" {
  type = string
}

variable "preview_internal_secret" {
  type = string
}

// ── SMTP (required) ─────────────────────────────────────────────────────────

variable "smtp_host" {
  type = string
}

variable "smtp_user" {
  type = string
}

variable "smtp_password" {
  type = string
}

// ── Turnstile (required) ────────────────────────────────────────────────────

variable "turnstile_secret" {
  type = string
}

// ── OAuth providers (optional) ──────────────────────────────────────────────

variable "google_client_id" {
  type    = string
  default = ""
}

variable "google_client_secret" {
  type    = string
  default = ""
}

variable "microsoft_client_id" {
  type    = string
  default = ""
}

variable "microsoft_client_secret" {
  type    = string
  default = ""
}

variable "github_oauth_client_id" {
  type    = string
  default = ""
}

variable "github_oauth_client_secret" {
  type    = string
  default = ""
}

variable "twitter_client_id" {
  type    = string
  default = ""
}

variable "twitter_client_secret" {
  type    = string
  default = ""
}

variable "telegram_bot_token" {
  type    = string
  default = ""
}

// ── Host ports (optional, for reverse proxy) ────────────────────────────────

variable "server_port" {
  type    = number
  default = 3000
}

variable "auth_port" {
  type    = number
  default = 3001
}

variable "notify_port" {
  type    = number
  default = 3002
}

variable "reaction_port" {
  type    = number
  default = 3003
}

variable "history_port" {
  type    = number
  default = 3004
}

variable "job_runner_http_port" {
  type    = number
  default = 3005
}

variable "ranking_port" {
  type    = number
  default = 3006
}

variable "preview_port" {
  type    = number
  default = 3007
}

// ── Observability (optional) ────────────────────────────────────────────────

variable "otel_exporter_otlp_endpoint" {
  description = "OTLP HTTP endpoint (empty = telemetry disabled)"
  type        = string
  default     = ""
}

// ═══════════════════════════════════════════════════════════════════════════
// Job
// ═══════════════════════════════════════════════════════════════════════════

job "rezics-prod" {
  type = "service"

  // ── Postgres ─────────────────────────────────────────────────────────────

  group "postgres" {
    service {
      name     = "postgres"
      port     = "db"
      provider = "nomad"

      check {
        type     = "tcp"
        port     = "db"
        interval = "10s"
        timeout  = "2s"
      }
    }

    network {
      port "db" {
        to = 5432
      }
    }

    task "postgres" {
      driver = "docker"

      config {
        image           = "postgres:18"
        network_mode    = var.network
        network_aliases = ["postgres"]
        ports           = ["db"]
        args            = ["-c", "config_file=/etc/postgresql/custom.conf"]

        volumes = [
          "local/custom.conf:/etc/postgresql/custom.conf:ro",
          "local/init-databases.sh:/docker-entrypoint-initdb.d/init-databases.sh:ro",
        ]

        mount {
          type   = "volume"
          source = "rezics-prod-postgres"
          target = "/var/lib/postgresql"
        }
      }

      env {
        POSTGRES_DB       = "rezics_server"
        POSTGRES_USER     = var.postgres_user
        POSTGRES_PASSWORD = var.postgres_password
      }

      template {
        data = <<-EOF
        listen_addresses = '*'
        wal_level = logical
        max_replication_slots = 10
        max_wal_senders = 10
        max_connections = 200
        shared_buffers = 256MB
        effective_cache_size = 768MB
        work_mem = 4MB
        EOF

        destination = "local/custom.conf"
      }

      template {
        data = <<-EOF
        #!/bin/sh
        set -e
        for db in rezics_auth rezics_notify rezics_reaction \
                  rezics_history rezics_ranking rezics_jobs sequin; do
          psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
              CREATE DATABASE $db;
          EOSQL
        done
        EOF

        destination = "local/init-databases.sh"
        perms       = "0755"
      }

      resources {
        cpu    = 500
        memory = 1024
      }
    }
  }

  // ── Meilisearch ──────────────────────────────────────────────────────────

  group "meilisearch" {
    service {
      name     = "meilisearch"
      port     = "http"
      provider = "nomad"

      check {
        type     = "http"
        port     = "http"
        path     = "/health"
        interval = "10s"
        timeout  = "2s"
      }
    }

    network {
      port "http" {
        to = 7700
      }
    }

    task "meilisearch" {
      driver = "docker"

      config {
        image           = "getmeili/meilisearch:v1.12"
        network_mode    = var.network
        network_aliases = ["meilisearch"]
        ports           = ["http"]

        mount {
          type   = "volume"
          source = "rezics-prod-meilisearch"
          target = "/meili_data"
        }
      }

      env {
        MEILI_ENV          = "production"
        MEILI_MASTER_KEY   = var.meili_master_key
        MEILI_NO_ANALYTICS = "true"
      }

      resources {
        cpu    = 500
        memory = 1024
      }
    }
  }

  // ── Redis ────────────────────────────────────────────────────────────────

  group "redis" {
    service {
      name     = "redis"
      port     = "redis"
      provider = "nomad"

      check {
        type     = "tcp"
        port     = "redis"
        interval = "10s"
        timeout  = "2s"
      }
    }

    network {
      port "redis" {
        to = 6379
      }
    }

    task "redis" {
      driver = "docker"

      config {
        image           = "redis:7"
        network_mode    = var.network
        network_aliases = ["redis"]
        ports           = ["redis"]
        args            = ["--maxmemory", "256mb", "--maxmemory-policy", "allkeys-lru"]

        mount {
          type   = "volume"
          source = "rezics-prod-redis"
          target = "/data"
        }
      }

      resources {
        cpu    = 200
        memory = 384
      }
    }
  }

  // ── RustFS (S3) ──────────────────────────────────────────────────────────

  group "rustfs" {
    service {
      name     = "rustfs"
      port     = "s3"
      provider = "nomad"

      check {
        type     = "tcp"
        port     = "s3"
        interval = "10s"
        timeout  = "2s"
      }
    }

    network {
      port "s3" {
        to = 9000
      }
    }

    task "rustfs" {
      driver = "docker"

      config {
        image           = "rustfs/rustfs"
        network_mode    = var.network
        network_aliases = ["rustfs"]
        ports           = ["s3"]
        args            = ["server", "/data"]

        mount {
          type   = "volume"
          source = "rezics-prod-rustfs"
          target = "/data"
        }
      }

      env {
        RUSTFS_ROOT_USER     = var.s3_access_key_id
        RUSTFS_ROOT_PASSWORD = var.s3_secret_access_key
      }

      resources {
        cpu    = 200
        memory = 256
      }
    }

    task "setup" {
      lifecycle {
        hook    = "poststart"
        sidecar = false
      }

      driver = "docker"

      config {
        image        = "minio/mc"
        network_mode = var.network
        entrypoint   = ["/bin/sh", "-c"]
        args = [
          "until mc alias set local http://rustfs:9000 ${S3_ACCESS_KEY_ID} ${S3_SECRET_ACCESS_KEY} 2>/dev/null; do sleep 2; done && mc mb --ignore-existing local/${S3_BUCKET} && mc anonymous set download local/${S3_BUCKET}",
        ]
      }

      env {
        S3_ACCESS_KEY_ID     = var.s3_access_key_id
        S3_SECRET_ACCESS_KEY = var.s3_secret_access_key
        S3_BUCKET            = var.s3_bucket
      }

      resources {
        cpu    = 50
        memory = 64
      }
    }
  }

  // ── Sequin (CDC) ─────────────────────────────────────────────────────────

  group "sequin" {
    service {
      name     = "sequin"
      port     = "http"
      provider = "nomad"

      check {
        type     = "tcp"
        port     = "http"
        interval = "10s"
        timeout  = "2s"
      }
    }

    restart {
      attempts = 10
      interval = "5m"
      delay    = "10s"
    }

    network {
      port "http" {
        to = 7376
      }
    }

    task "sequin" {
      driver = "docker"

      config {
        image           = "sequin/sequin:v0.14.6"
        network_mode    = var.network
        network_aliases = ["sequin"]
        ports           = ["http"]
      }

      env {
        PG_HOSTNAME           = "postgres"
        PG_PORT               = "5432"
        PG_DATABASE           = "sequin"
        PG_USERNAME           = var.postgres_user
        PG_PASSWORD           = var.postgres_password
        PG_POOL_SIZE          = "10"
        REDIS_URL             = "redis://redis:6379"
        SECRET_KEY_BASE       = var.sequin_secret_key_base
        VAULT_KEY             = var.sequin_vault_key
        SEQUIN_WEBHOOK_SECRET = var.sequin_webhook_secret
        SERVER_PORT           = "7376"
        SOURCE_DB_HOST        = "postgres"
        SOURCE_DB_PORT        = "5432"
        SOURCE_DB_NAME        = "rezics_server"
        SOURCE_DB_USER        = var.postgres_user
        SOURCE_DB_PASSWORD    = var.postgres_password
        SOURCE_DB_POOL_SIZE   = "10"
        REACTION_DB_HOST      = "postgres"
        REACTION_DB_PORT      = "5432"
        REACTION_DB_NAME      = "rezics_reaction"
        REACTION_DB_USER      = var.postgres_user
        REACTION_DB_PASSWORD  = var.postgres_password
        REACTION_DB_POOL_SIZE = "5"
        JOB_RUNNER_BASE_URL   = "http://job-runner-http:3005"
      }

      resources {
        cpu    = 300
        memory = 512
      }
    }
  }

  // ── Server ───────────────────────────────────────────────────────────────

  group "server" {
    network {
      port "http" {
        static = var.server_port
        to     = 3000
      }
    }

    service {
      name     = "server"
      port     = "http"
      provider = "nomad"

      check {
        type     = "http"
        port     = "http"
        path     = "/health"
        interval = "10s"
        timeout  = "2s"
      }
    }

    task "migrate" {
      lifecycle {
        hook    = "prestart"
        sidecar = false
      }

      driver = "docker"

      config {
        image        = var.image_server_migrate
        network_mode = var.network
        entrypoint   = ["/bin/sh", "-c"]
        args         = ["until cd /repo/packages/backend && bunx drizzle-kit migrate 2>&1; do echo 'Waiting for database...'; sleep 2; done"]
      }

      env {
        DATABASE_URL = "postgresql://${var.postgres_user}:${var.postgres_password}@postgres:5432/rezics_server"
      }

      resources {
        cpu    = 200
        memory = 512
      }
    }

    task "server" {
      driver = "docker"

      config {
        image           = var.image_server
        network_mode    = var.network
        network_aliases = ["server"]
        ports           = ["http"]
      }

      env {
        PORT                               = "3000"
        WORKERS                            = "2"
        NODE_ENV                           = "production"
        DATABASE_URL                       = "postgresql://${var.postgres_user}:${var.postgres_password}@postgres:5432/rezics_server"
        AUTH_INTERNAL_BASE_URL             = "http://auth:3001"
        AUTH_PUBLIC_BASE_URL               = var.auth_public_url
        AUTH_PUBLIC_ISSUER_URL             = var.auth_public_url
        AUTH_INTERNAL_TOKEN_GATEWAY_SECRET = var.auth_internal_token_gateway_secret
        SMTP_HOST                          = var.smtp_host
        SMTP_USER                          = var.smtp_user
        SMTP_PASSWORD                      = var.smtp_password
        TURNSTILE_SECRET                   = var.turnstile_secret
        MEILI_HOST                         = "http://meilisearch:7700"
        MEILI_MASTER_KEY                   = var.meili_master_key
        NOTIFY_BASE_URL                    = "http://notify:3002"
        NOTIFY_INTERNAL_SECRET             = var.notify_internal_secret
        REACTION_BASE_URL                  = "http://reaction:3003"
        REACTION_INTERNAL_SECRET           = var.reaction_internal_secret
        HISTORY_BASE_URL                   = "http://history:3004"
        HISTORY_INTERNAL_SECRET            = var.history_internal_secret
        JOB_RUNNER_BASE_URL                = "http://job-runner-http:3005"
        JOB_RUNNER_INTERNAL_SECRET         = var.job_runner_internal_secret
        S3_ENDPOINT                        = var.s3_endpoint
        S3_ACCESS_KEY_ID                   = var.s3_access_key_id
        S3_SECRET_ACCESS_KEY               = var.s3_secret_access_key
        S3_BUCKET                          = var.s3_bucket
        S3_REGION                          = var.s3_region
        MEDIA_PUBLIC_BASE_URL              = var.media_public_base_url
        OBSERVABILITY_LOG_FORMAT           = "json"
      }

      resources {
        cpu    = 500
        memory = 512
      }
    }
  }

  // ── Auth ─────────────────────────────────────────────────────────────────

  group "auth" {
    network {
      port "http" {
        static = var.auth_port
        to     = 3001
      }
    }

    service {
      name     = "auth"
      port     = "http"
      provider = "nomad"

      check {
        type     = "http"
        port     = "http"
        path     = "/health"
        interval = "10s"
        timeout  = "2s"
      }
    }

    task "migrate" {
      lifecycle {
        hook    = "prestart"
        sidecar = false
      }

      driver = "docker"

      config {
        image        = var.image_auth_migrate
        network_mode = var.network
        entrypoint   = ["/bin/sh", "-c"]
        args         = ["until cd /repo/packages/backend && bunx drizzle-kit migrate 2>&1; do echo 'Waiting for database...'; sleep 2; done"]
      }

      env {
        DATABASE_URL = "postgresql://${var.postgres_user}:${var.postgres_password}@postgres:5432/rezics_auth"
      }

      resources {
        cpu    = 200
        memory = 512
      }
    }

    task "auth" {
      driver = "docker"

      config {
        image           = var.image_auth
        network_mode    = var.network
        network_aliases = ["auth"]
        ports           = ["http"]
      }

      env {
        PORT                               = "3001"
        WORKERS                            = "2"
        NODE_ENV                           = "production"
        DATABASE_URL                       = "postgresql://${var.postgres_user}:${var.postgres_password}@postgres:5432/rezics_auth"
        BETTER_AUTH_URL                    = var.auth_public_url
        AUTH_PUBLIC_BASE_URL               = var.auth_public_url
        AUTH_PUBLIC_ISSUER_URL             = var.auth_public_url
        BETTER_AUTH_SECRET                 = var.better_auth_secret
        AUTH_INTERNAL_TOKEN_GATEWAY_SECRET = var.auth_internal_token_gateway_secret
        SMTP_HOST                          = var.smtp_host
        SMTP_USER                          = var.smtp_user
        SMTP_PASSWORD                      = var.smtp_password
        TURNSTILE_SECRET                   = var.turnstile_secret
        GOOGLE_CLIENT_ID                   = var.google_client_id
        GOOGLE_CLIENT_SECRET               = var.google_client_secret
        MICROSOFT_CLIENT_ID                = var.microsoft_client_id
        MICROSOFT_CLIENT_SECRET            = var.microsoft_client_secret
        GITHUB_CLIENT_ID                   = var.github_oauth_client_id
        GITHUB_CLIENT_SECRET               = var.github_oauth_client_secret
        TWITTER_CLIENT_ID                  = var.twitter_client_id
        TWITTER_CLIENT_SECRET              = var.twitter_client_secret
        TELEGRAM_BOT_TOKEN                 = var.telegram_bot_token
        OBSERVABILITY_LOG_FORMAT           = "json"
      }

      resources {
        cpu    = 500
        memory = 512
      }
    }
  }

  // ── Notify ───────────────────────────────────────────────────────────────

  group "notify" {
    network {
      port "http" {
        static = var.notify_port
        to     = 3002
      }
    }

    service {
      name     = "notify"
      port     = "http"
      provider = "nomad"

      check {
        type     = "http"
        port     = "http"
        path     = "/health"
        interval = "10s"
        timeout  = "2s"
      }
    }

    task "migrate" {
      lifecycle {
        hook    = "prestart"
        sidecar = false
      }

      driver = "docker"

      config {
        image        = var.image_notify_migrate
        network_mode = var.network
        entrypoint   = ["/bin/sh", "-c"]
        args         = ["until cd /repo/packages/backend && bunx drizzle-kit migrate 2>&1; do echo 'Waiting for database...'; sleep 2; done"]
      }

      env {
        NOTIFY_DATABASE_URL = "postgresql://${var.postgres_user}:${var.postgres_password}@postgres:5432/rezics_notify"
      }

      resources {
        cpu    = 200
        memory = 512
      }
    }

    task "notify" {
      driver = "docker"

      config {
        image           = var.image_notify
        network_mode    = var.network
        network_aliases = ["notify"]
        ports           = ["http"]
      }

      env {
        PORT                     = "3002"
        WORKERS                  = "2"
        NODE_ENV                 = "production"
        NOTIFY_DATABASE_URL      = "postgresql://${var.postgres_user}:${var.postgres_password}@postgres:5432/rezics_notify"
        NOTIFY_INTERNAL_SECRET   = var.notify_internal_secret
        SERVER_JWKS_URL          = "http://server:3000/.well-known/jwks.json"
        SERVER_ISSUER            = "rezics-server"
        SMTP_HOST                = var.smtp_host
        SMTP_USER                = var.smtp_user
        SMTP_PASSWORD            = var.smtp_password
        OBSERVABILITY_LOG_FORMAT = "json"
      }

      resources {
        cpu    = 300
        memory = 384
      }
    }
  }

  // ── Reaction ─────────────────────────────────────────────────────────────

  group "reaction" {
    network {
      port "http" {
        static = var.reaction_port
        to     = 3003
      }
    }

    service {
      name     = "reaction"
      port     = "http"
      provider = "nomad"

      check {
        type     = "http"
        port     = "http"
        path     = "/health"
        interval = "10s"
        timeout  = "2s"
      }
    }

    task "migrate" {
      lifecycle {
        hook    = "prestart"
        sidecar = false
      }

      driver = "docker"

      config {
        image        = var.image_reaction_migrate
        network_mode = var.network
        entrypoint   = ["/bin/sh", "-c"]
        args         = ["until cd /repo/packages/backend && bunx drizzle-kit migrate 2>&1; do echo 'Waiting for database...'; sleep 2; done"]
      }

      env {
        REACTION_DATABASE_URL = "postgresql://${var.postgres_user}:${var.postgres_password}@postgres:5432/rezics_reaction"
      }

      resources {
        cpu    = 200
        memory = 512
      }
    }

    task "reaction" {
      driver = "docker"

      config {
        image           = var.image_reaction
        network_mode    = var.network
        network_aliases = ["reaction"]
        ports           = ["http"]
      }

      env {
        PORT                     = "3003"
        WORKERS                  = "2"
        NODE_ENV                 = "production"
        REACTION_DATABASE_URL    = "postgresql://${var.postgres_user}:${var.postgres_password}@postgres:5432/rezics_reaction"
        REACTION_INTERNAL_SECRET = var.reaction_internal_secret
        SERVER_JWKS_URL          = "http://server:3000/.well-known/jwks.json"
        SERVER_ISSUER            = "rezics-server"
        OBSERVABILITY_LOG_FORMAT = "json"
      }

      resources {
        cpu    = 300
        memory = 384
      }
    }
  }

  // ── History ──────────────────────────────────────────────────────────────

  group "history" {
    network {
      port "http" {
        static = var.history_port
        to     = 3004
      }
    }

    service {
      name     = "history"
      port     = "http"
      provider = "nomad"

      check {
        type     = "http"
        port     = "http"
        path     = "/health"
        interval = "10s"
        timeout  = "2s"
      }
    }

    task "migrate" {
      lifecycle {
        hook    = "prestart"
        sidecar = false
      }

      driver = "docker"

      config {
        image        = var.image_history_migrate
        network_mode = var.network
        entrypoint   = ["/bin/sh", "-c"]
        args         = ["until cd /repo/packages/backend && bunx drizzle-kit migrate 2>&1; do echo 'Waiting for database...'; sleep 2; done"]
      }

      env {
        HISTORY_DATABASE_URL = "postgresql://${var.postgres_user}:${var.postgres_password}@postgres:5432/rezics_history"
      }

      resources {
        cpu    = 200
        memory = 512
      }
    }

    task "history" {
      driver = "docker"

      config {
        image           = var.image_history
        network_mode    = var.network
        network_aliases = ["history"]
        ports           = ["http"]
      }

      env {
        PORT                     = "3004"
        WORKERS                  = "2"
        NODE_ENV                 = "production"
        HISTORY_DATABASE_URL     = "postgresql://${var.postgres_user}:${var.postgres_password}@postgres:5432/rezics_history"
        SERVER_DATABASE_URL      = "postgresql://${var.postgres_user}:${var.postgres_password}@postgres:5432/rezics_server"
        HISTORY_INTERNAL_SECRET  = var.history_internal_secret
        OBSERVABILITY_LOG_FORMAT = "json"
      }

      resources {
        cpu    = 300
        memory = 384
      }
    }
  }

  // ── Ranking ──────────────────────────────────────────────────────────────

  group "ranking" {
    network {
      port "http" {
        static = var.ranking_port
        to     = 3006
      }
    }

    service {
      name     = "ranking"
      port     = "http"
      provider = "nomad"

      check {
        type     = "http"
        port     = "http"
        path     = "/health"
        interval = "10s"
        timeout  = "2s"
      }
    }

    task "migrate" {
      lifecycle {
        hook    = "prestart"
        sidecar = false
      }

      driver = "docker"

      config {
        image        = var.image_ranking_migrate
        network_mode = var.network
        entrypoint   = ["/bin/sh", "-c"]
        args         = ["until cd /repo/packages/backend && bunx drizzle-kit migrate 2>&1; do echo 'Waiting for database...'; sleep 2; done"]
      }

      env {
        RANKING_DATABASE_URL = "postgresql://${var.postgres_user}:${var.postgres_password}@postgres:5432/rezics_ranking"
      }

      resources {
        cpu    = 200
        memory = 512
      }
    }

    task "ranking" {
      driver = "docker"

      config {
        image           = var.image_ranking
        network_mode    = var.network
        network_aliases = ["ranking"]
        ports           = ["http"]
      }

      env {
        PORT                     = "3006"
        WORKERS                  = "2"
        NODE_ENV                 = "production"
        RANKING_DATABASE_URL     = "postgresql://${var.postgres_user}:${var.postgres_password}@postgres:5432/rezics_ranking"
        SERVER_DATABASE_URL      = "postgresql://${var.postgres_user}:${var.postgres_password}@postgres:5432/rezics_server"
        REACTION_BASE_URL        = "http://reaction:3003"
        REACTION_INTERNAL_SECRET = var.reaction_internal_secret
        MEILI_HOST               = "http://meilisearch:7700"
        MEILI_MASTER_KEY         = var.meili_master_key
        OBSERVABILITY_LOG_FORMAT = "json"
      }

      resources {
        cpu    = 300
        memory = 384
      }
    }
  }

  // ── Preview ──────────────────────────────────────────────────────────────

  group "preview" {
    network {
      port "http" {
        static = var.preview_port
        to     = 3007
      }
    }

    service {
      name     = "preview"
      port     = "http"
      provider = "nomad"

      check {
        type     = "http"
        port     = "http"
        path     = "/health"
        interval = "10s"
        timeout  = "2s"
      }
    }

    task "preview" {
      driver = "docker"

      config {
        image           = var.image_preview
        network_mode    = var.network
        network_aliases = ["preview"]
        ports           = ["http"]
      }

      env {
        PORT                               = "3007"
        NODE_ENV                           = "production"
        DATABASE_URL                       = "postgresql://${var.postgres_user}:${var.postgres_password}@postgres:5432/rezics_server"
        AUTH_INTERNAL_BASE_URL             = "http://auth:3001"
        AUTH_PUBLIC_BASE_URL               = var.auth_public_url
        AUTH_PUBLIC_ISSUER_URL             = var.auth_public_url
        AUTH_INTERNAL_TOKEN_GATEWAY_SECRET = var.auth_internal_token_gateway_secret
        SMTP_HOST                          = var.smtp_host
        SMTP_USER                          = var.smtp_user
        SMTP_PASSWORD                      = var.smtp_password
        TURNSTILE_SECRET                   = var.turnstile_secret
        MEILI_HOST                         = "http://meilisearch:7700"
        MEILI_MASTER_KEY                   = var.meili_master_key
        NOTIFY_BASE_URL                    = "http://notify:3002"
        NOTIFY_INTERNAL_SECRET             = var.notify_internal_secret
        REACTION_BASE_URL                  = "http://reaction:3003"
        REACTION_INTERNAL_SECRET           = var.reaction_internal_secret
        HISTORY_BASE_URL                   = "http://history:3004"
        HISTORY_INTERNAL_SECRET            = var.history_internal_secret
        JOB_RUNNER_BASE_URL                = "http://job-runner-http:3005"
        JOB_RUNNER_INTERNAL_SECRET         = var.job_runner_internal_secret
        S3_ENDPOINT                        = var.s3_endpoint
        S3_ACCESS_KEY_ID                   = var.s3_access_key_id
        S3_SECRET_ACCESS_KEY               = var.s3_secret_access_key
        S3_BUCKET                          = var.s3_bucket
        S3_REGION                          = var.s3_region
        MEDIA_PUBLIC_BASE_URL              = var.media_public_base_url
        PREVIEW_INTERNAL_SECRET            = var.preview_internal_secret
        OBSERVABILITY_LOG_FORMAT           = "json"
      }

      resources {
        cpu    = 300
        memory = 384
      }
    }
  }

  // ── Job Runner (HTTP) ────────────────────────────────────────────────────

  group "job-runner-http" {
    network {
      port "http" {
        static = var.job_runner_http_port
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
        image        = var.image_job_runner_migrate
        network_mode = var.network
        entrypoint   = ["/bin/sh", "-c"]
        args         = ["until cd /repo && bun run packages/backend/src/scripts/ensure-job-db.ts 2>&1; do echo 'Waiting for database...'; sleep 2; done"]
      }

      env {
        JOB_DATABASE_URL = "postgresql://${var.postgres_user}:${var.postgres_password}@postgres:5432/rezics_jobs"
      }

      resources {
        cpu    = 200
        memory = 512
      }
    }

    task "job-runner-http" {
      driver = "docker"

      config {
        image           = var.image_job_runner
        network_mode    = var.network
        network_aliases = ["job-runner-http"]
        ports           = ["http"]
      }

      env {
        PORT                       = "3005"
        NODE_ENV                   = "production"
        JOB_RUNNER_ROLE            = "http"
        JOB_DATABASE_URL           = "postgresql://${var.postgres_user}:${var.postgres_password}@postgres:5432/rezics_jobs"
        SERVER_DATABASE_URL        = "postgresql://${var.postgres_user}:${var.postgres_password}@postgres:5432/rezics_server"
        HISTORY_DATABASE_URL       = "postgresql://${var.postgres_user}:${var.postgres_password}@postgres:5432/rezics_history"
        MEILI_HOST                 = "http://meilisearch:7700"
        MEILI_MASTER_KEY           = var.meili_master_key
        JOB_RUNNER_INTERNAL_SECRET = var.job_runner_internal_secret
        SEQUIN_WEBHOOK_SECRET      = var.sequin_webhook_secret
        SEQUIN_HEALTH_URL          = "http://sequin:7376/health"
        RANKING_BASE_URL           = "http://ranking:3006"
        RANKING_INTERNAL_SECRET    = var.ranking_internal_secret
        OBSERVABILITY_LOG_FORMAT   = "json"
      }

      resources {
        cpu    = 300
        memory = 384
      }
    }
  }

  // ── Job Runner (Worker — default lane) ───────────────────────────────────

  group "job-runner-worker" {
    task "job-runner-worker" {
      driver = "docker"

      config {
        image        = var.image_job_runner
        network_mode = var.network
      }

      env {
        NODE_ENV                           = "production"
        JOB_RUNNER_ROLE                    = "worker"
        JOB_WORKER_LANES                   = "default"
        JOB_DATABASE_URL                   = "postgresql://${var.postgres_user}:${var.postgres_password}@postgres:5432/rezics_jobs"
        SERVER_DATABASE_URL                = "postgresql://${var.postgres_user}:${var.postgres_password}@postgres:5432/rezics_server"
        HISTORY_DATABASE_URL               = "postgresql://${var.postgres_user}:${var.postgres_password}@postgres:5432/rezics_history"
        DATABASE_URL                       = "postgresql://${var.postgres_user}:${var.postgres_password}@postgres:5432/rezics_server"
        AUTH_INTERNAL_BASE_URL             = "http://auth:3001"
        AUTH_PUBLIC_BASE_URL               = var.auth_public_url
        AUTH_PUBLIC_ISSUER_URL             = var.auth_public_url
        AUTH_INTERNAL_TOKEN_GATEWAY_SECRET = var.auth_internal_token_gateway_secret
        SMTP_HOST                          = var.smtp_host
        SMTP_USER                          = var.smtp_user
        SMTP_PASSWORD                      = var.smtp_password
        TURNSTILE_SECRET                   = var.turnstile_secret
        MEILI_HOST                         = "http://meilisearch:7700"
        MEILI_MASTER_KEY                   = var.meili_master_key
        NOTIFY_BASE_URL                    = "http://notify:3002"
        NOTIFY_INTERNAL_SECRET             = var.notify_internal_secret
        REACTION_BASE_URL                  = "http://reaction:3003"
        REACTION_INTERNAL_SECRET           = var.reaction_internal_secret
        HISTORY_BASE_URL                   = "http://history:3004"
        HISTORY_INTERNAL_SECRET            = var.history_internal_secret
        JOB_RUNNER_BASE_URL                = "http://job-runner-http:3005"
        JOB_RUNNER_INTERNAL_SECRET         = var.job_runner_internal_secret
        RANKING_BASE_URL                   = "http://ranking:3006"
        RANKING_INTERNAL_SECRET            = var.ranking_internal_secret
        S3_ENDPOINT                        = var.s3_endpoint
        S3_ACCESS_KEY_ID                   = var.s3_access_key_id
        S3_SECRET_ACCESS_KEY               = var.s3_secret_access_key
        S3_BUCKET                          = var.s3_bucket
        S3_REGION                          = var.s3_region
        MEDIA_PUBLIC_BASE_URL              = var.media_public_base_url
        SEQUIN_WEBHOOK_SECRET              = var.sequin_webhook_secret
        OBSERVABILITY_LOG_FORMAT           = "json"
      }

      resources {
        cpu    = 500
        memory = 512
      }
    }
  }

  // ── Ranking Worker (ranking lane) ────────────────────────────────────────

  group "ranking-worker" {
    task "ranking-worker" {
      driver = "docker"

      config {
        image        = var.image_job_runner
        network_mode = var.network
      }

      env {
        NODE_ENV                           = "production"
        JOB_RUNNER_ROLE                    = "worker"
        JOB_WORKER_LANES                   = "ranking"
        JOB_DATABASE_URL                   = "postgresql://${var.postgres_user}:${var.postgres_password}@postgres:5432/rezics_jobs"
        SERVER_DATABASE_URL                = "postgresql://${var.postgres_user}:${var.postgres_password}@postgres:5432/rezics_server"
        HISTORY_DATABASE_URL               = "postgresql://${var.postgres_user}:${var.postgres_password}@postgres:5432/rezics_history"
        DATABASE_URL                       = "postgresql://${var.postgres_user}:${var.postgres_password}@postgres:5432/rezics_server"
        AUTH_INTERNAL_BASE_URL             = "http://auth:3001"
        AUTH_PUBLIC_BASE_URL               = var.auth_public_url
        AUTH_PUBLIC_ISSUER_URL             = var.auth_public_url
        AUTH_INTERNAL_TOKEN_GATEWAY_SECRET = var.auth_internal_token_gateway_secret
        SMTP_HOST                          = var.smtp_host
        SMTP_USER                          = var.smtp_user
        SMTP_PASSWORD                      = var.smtp_password
        TURNSTILE_SECRET                   = var.turnstile_secret
        MEILI_HOST                         = "http://meilisearch:7700"
        MEILI_MASTER_KEY                   = var.meili_master_key
        NOTIFY_BASE_URL                    = "http://notify:3002"
        NOTIFY_INTERNAL_SECRET             = var.notify_internal_secret
        REACTION_BASE_URL                  = "http://reaction:3003"
        REACTION_INTERNAL_SECRET           = var.reaction_internal_secret
        HISTORY_BASE_URL                   = "http://history:3004"
        HISTORY_INTERNAL_SECRET            = var.history_internal_secret
        JOB_RUNNER_BASE_URL                = "http://job-runner-http:3005"
        JOB_RUNNER_INTERNAL_SECRET         = var.job_runner_internal_secret
        RANKING_BASE_URL                   = "http://ranking:3006"
        RANKING_INTERNAL_SECRET            = var.ranking_internal_secret
        S3_ENDPOINT                        = var.s3_endpoint
        S3_ACCESS_KEY_ID                   = var.s3_access_key_id
        S3_SECRET_ACCESS_KEY               = var.s3_secret_access_key
        S3_BUCKET                          = var.s3_bucket
        S3_REGION                          = var.s3_region
        MEDIA_PUBLIC_BASE_URL              = var.media_public_base_url
        SEQUIN_WEBHOOK_SECRET              = var.sequin_webhook_secret
        OBSERVABILITY_LOG_FORMAT           = "json"
      }

      resources {
        cpu    = 500
        memory = 512
      }
    }
  }
}
