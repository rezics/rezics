[[ define "server" -]]
  group "server" {
    network {
      port "http" {
        static = [[ var "server_port" . ]]
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
        image        = "[[ var "image_server_migrate" . ]]"
        network_mode = "[[ var "network" . ]]"
        entrypoint   = ["/bin/sh", "-c"]
        args         = ["until cd /repo/packages/backend && bunx drizzle-kit migrate 2>&1; do echo 'Waiting for database...'; sleep 2; done"]
      }

      env {
        DATABASE_URL = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_server"
      }

      resources {
        cpu    = 200
        memory = 512
      }
    }

    task "server" {
      driver = "docker"

      config {
        image           = "[[ var "image_server" . ]]"
        network_mode    = "[[ var "network" . ]]"
        network_aliases = ["server"]
        ports           = ["http"]
      }

      env {
        PORT                               = "3000"
        WORKERS                            = "2"
        NODE_ENV                           = "production"
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
        S3_ENDPOINT                        = "[[ var "s3_endpoint" . ]]"
        S3_ACCESS_KEY_ID                   = "[[ var "s3_access_key_id" . ]]"
        S3_SECRET_ACCESS_KEY               = "[[ var "s3_secret_access_key" . ]]"
        S3_BUCKET                          = "[[ var "s3_bucket" . ]]"
        S3_REGION                          = "[[ var "s3_region" . ]]"
        MEDIA_PUBLIC_BASE_URL              = "[[ var "media_public_base_url" . ]]"
        OBSERVABILITY_LOG_FORMAT           = "json"
      }

      resources {
        cpu    = 500
        memory = 512
      }
    }
  }
[[- end ]]

[[ define "auth" -]]
  group "auth" {
    network {
      port "http" {
        static = [[ var "auth_port" . ]]
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
        image        = "[[ var "image_auth_migrate" . ]]"
        network_mode = "[[ var "network" . ]]"
        entrypoint   = ["/bin/sh", "-c"]
        args         = ["until cd /repo/packages/backend && bunx drizzle-kit migrate 2>&1; do echo 'Waiting for database...'; sleep 2; done"]
      }

      env {
        DATABASE_URL = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_auth"
      }

      resources {
        cpu    = 200
        memory = 512
      }
    }

    task "auth" {
      driver = "docker"

      config {
        image           = "[[ var "image_auth" . ]]"
        network_mode    = "[[ var "network" . ]]"
        network_aliases = ["auth"]
        ports           = ["http"]
      }

      env {
        PORT                               = "3001"
        WORKERS                            = "2"
        NODE_ENV                           = "production"
        DATABASE_URL                       = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_auth"
        BETTER_AUTH_URL                    = "[[ var "auth_public_url" . ]]"
        AUTH_PUBLIC_BASE_URL               = "[[ var "auth_public_url" . ]]"
        AUTH_PUBLIC_ISSUER_URL             = "[[ var "auth_public_url" . ]]"
        BETTER_AUTH_SECRET                 = "[[ var "better_auth_secret" . ]]"
        AUTH_INTERNAL_TOKEN_GATEWAY_SECRET = "[[ var "auth_internal_token_gateway_secret" . ]]"
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
        OBSERVABILITY_LOG_FORMAT           = "json"
      }

      resources {
        cpu    = 500
        memory = 512
      }
    }
  }
[[- end ]]

[[ define "notify" -]]
  group "notify" {
    network {
      port "http" {
        static = [[ var "notify_port" . ]]
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
        image        = "[[ var "image_notify_migrate" . ]]"
        network_mode = "[[ var "network" . ]]"
        entrypoint   = ["/bin/sh", "-c"]
        args         = ["until cd /repo/packages/backend && bunx drizzle-kit migrate 2>&1; do echo 'Waiting for database...'; sleep 2; done"]
      }

      env {
        NOTIFY_DATABASE_URL = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_notify"
      }

      resources {
        cpu    = 200
        memory = 512
      }
    }

    task "notify" {
      driver = "docker"

      config {
        image           = "[[ var "image_notify" . ]]"
        network_mode    = "[[ var "network" . ]]"
        network_aliases = ["notify"]
        ports           = ["http"]
      }

      env {
        PORT                     = "3002"
        WORKERS                  = "2"
        NODE_ENV                 = "production"
        NOTIFY_DATABASE_URL      = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_notify"
        NOTIFY_INTERNAL_SECRET   = "[[ var "notify_internal_secret" . ]]"
        SERVER_JWKS_URL          = "http://server:3000/.well-known/jwks.json"
        SERVER_ISSUER            = "rezics-server"
        SMTP_HOST                = "[[ var "smtp_host" . ]]"
        SMTP_USER                = "[[ var "smtp_user" . ]]"
        SMTP_PASSWORD            = "[[ var "smtp_password" . ]]"
        OBSERVABILITY_LOG_FORMAT = "json"
      }

      resources {
        cpu    = 300
        memory = 384
      }
    }
  }
[[- end ]]

[[ define "reaction" -]]
  group "reaction" {
    network {
      port "http" {
        static = [[ var "reaction_port" . ]]
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
        image        = "[[ var "image_reaction_migrate" . ]]"
        network_mode = "[[ var "network" . ]]"
        entrypoint   = ["/bin/sh", "-c"]
        args         = ["until cd /repo/packages/backend && bunx drizzle-kit migrate 2>&1; do echo 'Waiting for database...'; sleep 2; done"]
      }

      env {
        REACTION_DATABASE_URL = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_reaction"
      }

      resources {
        cpu    = 200
        memory = 512
      }
    }

    task "reaction" {
      driver = "docker"

      config {
        image           = "[[ var "image_reaction" . ]]"
        network_mode    = "[[ var "network" . ]]"
        network_aliases = ["reaction"]
        ports           = ["http"]
      }

      env {
        PORT                     = "3003"
        WORKERS                  = "2"
        NODE_ENV                 = "production"
        REACTION_DATABASE_URL    = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_reaction"
        REACTION_INTERNAL_SECRET = "[[ var "reaction_internal_secret" . ]]"
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
[[- end ]]

[[ define "history" -]]
  group "history" {
    network {
      port "http" {
        static = [[ var "history_port" . ]]
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
        image        = "[[ var "image_history_migrate" . ]]"
        network_mode = "[[ var "network" . ]]"
        entrypoint   = ["/bin/sh", "-c"]
        args         = ["until cd /repo/packages/backend && bunx drizzle-kit migrate 2>&1; do echo 'Waiting for database...'; sleep 2; done"]
      }

      env {
        HISTORY_DATABASE_URL = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_history"
      }

      resources {
        cpu    = 200
        memory = 512
      }
    }

    task "history" {
      driver = "docker"

      config {
        image           = "[[ var "image_history" . ]]"
        network_mode    = "[[ var "network" . ]]"
        network_aliases = ["history"]
        ports           = ["http"]
      }

      env {
        PORT                     = "3004"
        WORKERS                  = "2"
        NODE_ENV                 = "production"
        HISTORY_DATABASE_URL     = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_history"
        SERVER_DATABASE_URL      = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_server"
        HISTORY_INTERNAL_SECRET  = "[[ var "history_internal_secret" . ]]"
        OBSERVABILITY_LOG_FORMAT = "json"
      }

      resources {
        cpu    = 300
        memory = 384
      }
    }
  }
[[- end ]]

[[ define "ranking" -]]
  group "ranking" {
    network {
      port "http" {
        static = [[ var "ranking_port" . ]]
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
        image        = "[[ var "image_ranking_migrate" . ]]"
        network_mode = "[[ var "network" . ]]"
        entrypoint   = ["/bin/sh", "-c"]
        args         = ["until cd /repo/packages/backend && bunx drizzle-kit migrate 2>&1; do echo 'Waiting for database...'; sleep 2; done"]
      }

      env {
        RANKING_DATABASE_URL = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_ranking"
      }

      resources {
        cpu    = 200
        memory = 512
      }
    }

    task "ranking" {
      driver = "docker"

      config {
        image           = "[[ var "image_ranking" . ]]"
        network_mode    = "[[ var "network" . ]]"
        network_aliases = ["ranking"]
        ports           = ["http"]
      }

      env {
        PORT                     = "3006"
        WORKERS                  = "2"
        NODE_ENV                 = "production"
        RANKING_DATABASE_URL     = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_ranking"
        SERVER_DATABASE_URL      = "postgresql://[[ var "postgres_user" . ]]:[[ var "postgres_password" . ]]@postgres:5432/rezics_server"
        REACTION_BASE_URL        = "http://reaction:3003"
        REACTION_INTERNAL_SECRET = "[[ var "reaction_internal_secret" . ]]"
        MEILI_HOST               = "http://meilisearch:7700"
        MEILI_MASTER_KEY         = "[[ var "meili_master_key" . ]]"
        OBSERVABILITY_LOG_FORMAT = "json"
      }

      resources {
        cpu    = 300
        memory = 384
      }
    }
  }
[[- end ]]

[[ define "preview" -]]
  group "preview" {
    network {
      port "http" {
        static = [[ var "preview_port" . ]]
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
        image           = "[[ var "image_preview" . ]]"
        network_mode    = "[[ var "network" . ]]"
        network_aliases = ["preview"]
        ports           = ["http"]
      }

      env {
        PORT                               = "3007"
        NODE_ENV                           = "production"
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
        S3_ENDPOINT                        = "[[ var "s3_endpoint" . ]]"
        S3_ACCESS_KEY_ID                   = "[[ var "s3_access_key_id" . ]]"
        S3_SECRET_ACCESS_KEY               = "[[ var "s3_secret_access_key" . ]]"
        S3_BUCKET                          = "[[ var "s3_bucket" . ]]"
        S3_REGION                          = "[[ var "s3_region" . ]]"
        MEDIA_PUBLIC_BASE_URL              = "[[ var "media_public_base_url" . ]]"
        PREVIEW_INTERNAL_SECRET            = "[[ var "preview_internal_secret" . ]]"
        OBSERVABILITY_LOG_FORMAT           = "json"
      }

      resources {
        cpu    = 300
        memory = 384
      }
    }
  }
[[- end ]]
