[[ define "backend" -]]
  group "backend" {
    network {
      port "http" {
        static = [[ var "backend_port" . ]]
        to     = 3000
      }
    }

    service {
      name     = "backend"
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

    task "migrate-server" {
      lifecycle {
        hook    = "prestart"
        sidecar = false
      }

      driver = "docker"

      config {
        image        = "[[ var "image_backend_migrate" . ]]"
        network_mode = "[[ var "network" . ]]"
        entrypoint   = ["/bin/sh", "-c"]
        args         = ["until cd /repo/packages/server && bunx drizzle-kit migrate 2>&1; do echo 'Waiting for server database...'; sleep 2; done"]
      }

      env {
        DATABASE_URL = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_server"
      }

      resources {
        cpu    = 200
        memory = 512
      }
    }

    task "migrate-auth" {
      lifecycle {
        hook    = "prestart"
        sidecar = false
      }

      driver = "docker"

      config {
        image        = "[[ var "image_backend_migrate" . ]]"
        network_mode = "[[ var "network" . ]]"
        entrypoint   = ["/bin/sh", "-c"]
        args         = ["until cd /repo/packages/auth && bunx drizzle-kit migrate 2>&1; do echo 'Waiting for auth database...'; sleep 2; done"]
      }

      env {
        AUTH_DATABASE_URL = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_auth"
        DATABASE_URL      = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_auth"
      }

      resources {
        cpu    = 200
        memory = 512
      }
    }

    task "migrate-notify" {
      lifecycle {
        hook    = "prestart"
        sidecar = false
      }

      driver = "docker"

      config {
        image        = "[[ var "image_backend_migrate" . ]]"
        network_mode = "[[ var "network" . ]]"
        entrypoint   = ["/bin/sh", "-c"]
        args         = ["until cd /repo/packages/notify && bunx drizzle-kit migrate 2>&1; do echo 'Waiting for notify database...'; sleep 2; done"]
      }

      env {
        NOTIFY_DATABASE_URL = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_notify"
      }

      resources {
        cpu    = 200
        memory = 512
      }
    }

    task "migrate-reaction" {
      lifecycle {
        hook    = "prestart"
        sidecar = false
      }

      driver = "docker"

      config {
        image        = "[[ var "image_backend_migrate" . ]]"
        network_mode = "[[ var "network" . ]]"
        entrypoint   = ["/bin/sh", "-c"]
        args         = ["until cd /repo/packages/reaction && bunx drizzle-kit migrate 2>&1; do echo 'Waiting for reaction database...'; sleep 2; done"]
      }

      env {
        REACTION_DATABASE_URL = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_reaction"
      }

      resources {
        cpu    = 200
        memory = 512
      }
    }

    task "migrate-history" {
      lifecycle {
        hook    = "prestart"
        sidecar = false
      }

      driver = "docker"

      config {
        image        = "[[ var "image_backend_migrate" . ]]"
        network_mode = "[[ var "network" . ]]"
        entrypoint   = ["/bin/sh", "-c"]
        args         = ["until cd /repo/packages/history && bunx drizzle-kit migrate 2>&1; do echo 'Waiting for history database...'; sleep 2; done"]
      }

      env {
        HISTORY_DATABASE_URL = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_history"
      }

      resources {
        cpu    = 200
        memory = 512
      }
    }

    task "migrate-ranking" {
      lifecycle {
        hook    = "prestart"
        sidecar = false
      }

      driver = "docker"

      config {
        image        = "[[ var "image_backend_migrate" . ]]"
        network_mode = "[[ var "network" . ]]"
        entrypoint   = ["/bin/sh", "-c"]
        args         = ["until cd /repo/packages/ranking && bunx drizzle-kit migrate 2>&1; do echo 'Waiting for ranking database...'; sleep 2; done"]
      }

      env {
        RANKING_DATABASE_URL = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_ranking"
      }

      resources {
        cpu    = 200
        memory = 512
      }
    }

    task "backend" {
      driver = "docker"

      config {
        image           = "[[ var "image_backend" . ]]"
        network_mode    = "[[ var "network" . ]]"
        network_aliases = ["backend"]
        ports           = ["http"]
      }

      env {
        PORT                               = "3000"
        BACKEND_PORT                       = "3000"
        SERVER_PORT                        = "3000"
        WORKERS                            = "2"
        NODE_ENV                           = "production"
        DATABASE_URL                       = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_server"
        SERVER_DATABASE_URL                = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_server"
        AUTH_DATABASE_URL                  = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_auth"
        NOTIFY_DATABASE_URL                = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_notify"
        REACTION_DATABASE_URL              = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_reaction"
        HISTORY_DATABASE_URL               = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_history"
        RANKING_DATABASE_URL               = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_ranking"
        AUTH_INTERNAL_BASE_URL             = "http://backend:3000/__services/auth"
        AUTH_PUBLIC_BASE_URL               = "[[ var "auth_public_url" . ]]"
        AUTH_PUBLIC_ISSUER_URL             = "[[ var "auth_public_url" . ]]"
        BETTER_AUTH_URL                    = "[[ var "auth_public_url" . ]]"
        AUTH_INTERNAL_TOKEN_GATEWAY_SECRET = "[[ var "auth_internal_token_gateway_secret" . ]]"
        BETTER_AUTH_SECRET                 = "[[ var "better_auth_secret" . ]]"
        SMTP_HOST                          = "[[ var "smtp_host" . ]]"
        SMTP_USER                          = "[[ var "smtp_user" . ]]"
        SMTP_PASSWORD                      = "[[ var "smtp_password" . ]]"
        TURNSTILE_SECRET                   = "[[ var "turnstile_secret" . ]]"
        GOOGLE_CLIENT_ID                   = "[[ var "google_client_id" . ]]"
        GOOGLE_CLIENT_SECRET               = "[[ var "google_client_secret" . ]]"
        MICROSOFT_CLIENT_ID                = "[[ var "microsoft_client_id" . ]]"
        MICROSOFT_CLIENT_SECRET            = "[[ var "microsoft_client_secret" . ]]"
        GITHUB_CLIENT_ID                   = "[[ var "github_oauth_client_id" . ]]"
        GITHUB_CLIENT_SECRET               = "[[ var "github_oauth_client_secret" . ]]"
        TWITTER_CLIENT_ID                  = "[[ var "twitter_client_id" . ]]"
        TWITTER_CLIENT_SECRET              = "[[ var "twitter_client_secret" . ]]"
        TELEGRAM_BOT_TOKEN                 = "[[ var "telegram_bot_token" . ]]"
        SERVER_JWKS_URL                    = "http://backend:3000/.well-known/jwks.json"
        MEILI_HOST                         = "http://meilisearch:7700"
        MEILI_MASTER_KEY                   = "[[ var "meili_master_key" . ]]"
        NOTIFY_BASE_URL                    = "http://backend:3000/__services/notify"
        NOTIFY_INTERNAL_SECRET             = "[[ var "notify_internal_secret" . ]]"
        REACTION_BASE_URL                  = "http://backend:3000/__services/reaction"
        REACTION_INTERNAL_SECRET           = "[[ var "reaction_internal_secret" . ]]"
        HISTORY_BASE_URL                   = "http://backend:3000/__services/history"
        HISTORY_INTERNAL_SECRET            = "[[ var "history_internal_secret" . ]]"
        JOB_RUNNER_BASE_URL                = "http://job-runner-http:3005"
        JOB_RUNNER_INTERNAL_SECRET         = "[[ var "job_runner_internal_secret" . ]]"
        RANKING_BASE_URL                   = "http://backend:3000/__services/ranking"
        RANKING_INTERNAL_SECRET            = "[[ var "ranking_internal_secret" . ]]"
        S3_ENDPOINT                        = "[[ var "s3_endpoint" . ]]"
        S3_ACCESS_KEY_ID                   = "[[ var "s3_access_key_id" . ]]"
        S3_SECRET_ACCESS_KEY               = "[[ var "s3_secret_access_key" . ]]"
        S3_BUCKET                          = "[[ var "s3_bucket" . ]]"
        S3_REGION                          = "[[ var "s3_region" . ]]"
        MEDIA_PUBLIC_BASE_URL              = "[[ var "media_public_base_url" . ]]"
        OBSERVABILITY_LOG_FORMAT           = "json"
      }

      resources {
        cpu    = 1500
        memory = 1536
      }
    }
  }
[[- end ]]
