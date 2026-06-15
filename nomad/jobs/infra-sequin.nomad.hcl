# Sequin v0.14.6 CDC — co-located with its own Postgres and Redis
# Sequin v0.14.6 变更数据捕获 — 与专用 Postgres 和 Redis 同组部署

job "infra-sequin" {
  datacenters = ["dc1"]
  type        = "service"

  group "sequin" {
    count = 1

    network {
      port "sequin-pg" {
        static = 5433
        to     = 5432
      }
      port "redis" {
        static = 6379
        to     = 6379
      }
      port "http" {
        static = 7376
        to     = 7376
      }
    }

    volume "sequin-postgres-data" {
      type      = "host"
      source    = "sequin-postgres-data"
      read_only = false
    }

    volume "sequin-redis-data" {
      type      = "host"
      source    = "sequin-redis-data"
      read_only = false
    }

    service {
      name     = "sequin"
      port     = "http"
      provider = "nomad"

      check {
        type     = "http"
        path     = "/health"
        interval = "10s"
        timeout  = "2s"
      }
    }

    task "sequin-postgres" {
      driver = "docker"

      config {
        image = "postgres:18.4-trixie"
        ports = ["sequin-pg"]
      }

      volume_mount {
        volume      = "sequin-postgres-data"
        destination = "/var/lib/postgresql/data"
        read_only   = false
      }

      env {
        POSTGRES_DB   = "sequin"
        POSTGRES_USER = "sequin"
      }

      template {
        data        = <<-EOT
{{ with nomadVar "rezics/infra" }}
POSTGRES_PASSWORD={{ .PG_PASSWORD }}
{{ end }}
EOT
        destination = "secrets/env.env"
        env         = true
      }

      resources {
        cpu    = 200
        memory = 256
      }
    }

    task "sequin-redis" {
      driver = "docker"

      config {
        image = "redis:8.8-m03-alpine3.23"
        ports = ["redis"]
      }

      volume_mount {
        volume      = "sequin-redis-data"
        destination = "/data"
        read_only   = false
      }

      resources {
        cpu    = 100
        memory = 128
      }
    }

    task "sequin" {
      driver = "docker"

      config {
        image = "sequin/sequin:v0.14.6"
        ports = ["http"]
        volumes = [
          "/opt/nomad/config/sequin.yml:/config/sequin.yml:ro",
        ]
      }

      env {
        ENV                  = "production"
        CONFIG_FILE_PATH     = "/config/sequin.yml"
        PG_HOSTNAME          = "127.0.0.1"
        PG_PORT              = "5433"
        PG_DATABASE          = "sequin"
        PG_USERNAME          = "sequin"
        SOURCE_DB_HOST       = "127.0.0.1"
        SOURCE_DB_PORT       = "5432"
        SOURCE_DB_NAME       = "rezics_server"
        SOURCE_DB_USER       = "postgres"
        REACTION_DB_HOST     = "127.0.0.1"
        REACTION_DB_PORT     = "5432"
        REACTION_DB_NAME     = "rezics_reaction"
        REACTION_DB_USER     = "postgres"
        JOB_RUNNER_BASE_URL  = "http://127.0.0.1:3005"
      }

      template {
        data        = <<-EOT
{{ with nomadVar "rezics/infra" }}
PG_PASSWORD={{ .PG_PASSWORD }}
SECRET_KEY_BASE={{ .SECRET_KEY_BASE }}
VAULT_KEY={{ .VAULT_KEY }}
SEQUIN_WEBHOOK_SECRET={{ .SEQUIN_WEBHOOK_SECRET }}
SOURCE_DB_PASSWORD={{ .SOURCE_DB_PASSWORD }}
REACTION_DB_PASSWORD={{ .REACTION_DB_PASSWORD }}
{{ end }}
EOT
        destination = "secrets/env.env"
        env         = true
      }

      resources {
        cpu    = 300
        memory = 384
      }
    }
  }
}
