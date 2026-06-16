[[ define "sequin" -]]
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
        network_mode    = "[[ var "network" . ]]"
        network_aliases = ["sequin"]
        ports           = ["http"]
      }

      env {
        PG_HOSTNAME           = "postgres"
        PG_PORT               = "5432"
        PG_DATABASE           = "sequin"
        PG_USERNAME           = "[[ var "postgres_user" . ]]"
        PG_PASSWORD           = "[[ var "postgres_password" . ]]"
        PG_POOL_SIZE          = "10"
        REDIS_URL             = "redis://redis:6379"
        SECRET_KEY_BASE       = "[[ var "sequin_secret_key_base" . ]]"
        VAULT_KEY             = "[[ var "sequin_vault_key" . ]]"
        SEQUIN_WEBHOOK_SECRET = "[[ var "sequin_webhook_secret" . ]]"
        SERVER_PORT           = "7376"

        // Main DB CDC source (rezics_server)
        SOURCE_DB_HOST        = "postgres"
        SOURCE_DB_PORT        = "5432"
        SOURCE_DB_NAME        = "rezics_server"
        SOURCE_DB_USER        = "[[ var "postgres_user" . ]]"
        SOURCE_DB_PASSWORD    = "[[ var "postgres_password" . ]]"
        SOURCE_DB_POOL_SIZE   = "10"

        // Reaction DB CDC source (rezics_reaction)
        REACTION_DB_HOST      = "postgres"
        REACTION_DB_PORT      = "5432"
        REACTION_DB_NAME      = "rezics_reaction"
        REACTION_DB_USER      = "[[ var "postgres_user" . ]]"
        REACTION_DB_PASSWORD  = "[[ var "postgres_password" . ]]"
        REACTION_DB_POOL_SIZE = "5"

        JOB_RUNNER_BASE_URL   = "http://job-runner-http:3005"
      }

      resources {
        cpu    = 300
        memory = 512
      }
    }
  }
[[- end ]]
