variable "project_root" {
  description = "Absolute path to the project root"
  type        = string
}

job "rezics-dev" {
  type = "service"

  # ── Postgres ────────────────────────────────────────────────────────────

  group "postgres" {
    service {
      name     = "postgres"
      port     = "db"
      provider = "nomad"
    }

    network {
      port "db" {
        static       = 5432
        to           = 5432
        host_network = "loopback"
      }
    }

    task "postgres" {
      driver = "docker"

      config {
        image           = "postgres:18"
        network_mode    = "rezics"
        network_aliases = ["postgres"]
        ports           = ["db"]
        args            = ["-c", "config_file=/etc/postgresql/custom.conf"]

        volumes = [
          "local/custom.conf:/etc/postgresql/custom.conf:ro",
          "local/init-databases.sh:/docker-entrypoint-initdb.d/init-databases.sh:ro",
        ]

        mount {
          type   = "volume"
          source = "rezics-postgres"
          target = "/var/lib/postgresql"
        }
      }

      env {
        POSTGRES_DB       = "rezics_server"
        POSTGRES_USER     = "postgres"
        POSTGRES_PASSWORD = "postgres"
      }

      template {
        data = <<-EOF
        listen_addresses = '*'
        wal_level = logical
        max_replication_slots = 10
        max_wal_senders = 10
        EOF

        destination = "local/custom.conf"
      }

      template {
        data = <<-EOF
        #!/bin/sh
        set -e
        for db in rezics_auth rezics_notify rezics_reaction \
                  rezics_history rezics_ranking rezics_jobs sequin; do
          exists="$(psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -tAc "SELECT 1 FROM pg_database WHERE datname = '$db'")"
          if [ "$exists" != "1" ]; then
            psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c "CREATE DATABASE \"$db\""
          fi
        done
        EOF

        destination = "local/init-databases.sh"
        perms       = "0755"
      }

      resources {
        cpu    = 500
        memory = 512
      }
    }
  }

  # ── Meilisearch ─────────────────────────────────────────────────────────

  group "meilisearch" {
    service {
      name     = "meilisearch"
      port     = "http"
      provider = "nomad"
    }

    network {
      port "http" {
        static       = 7700
        to           = 7700
        host_network = "loopback"
      }
    }

    task "meilisearch" {
      driver = "docker"

      config {
        image           = "getmeili/meilisearch:v1.12"
        network_mode    = "rezics"
        network_aliases = ["meilisearch"]
        ports           = ["http"]

        mount {
          type   = "volume"
          source = "rezics-meilisearch"
          target = "/meili_data"
        }
      }

      env {
        MEILI_ENV          = "development"
        MEILI_MASTER_KEY   = "masterKey"
        MEILI_NO_ANALYTICS = "true"
      }

      resources {
        cpu    = 500
        memory = 512
      }
    }
  }

  # ── Redis ───────────────────────────────────────────────────────────────

  group "redis" {
    service {
      name     = "redis"
      port     = "redis"
      provider = "nomad"
    }

    network {
      port "redis" {
        static       = 6379
        to           = 6379
        host_network = "loopback"
      }
    }

    task "redis" {
      driver = "docker"

      config {
        image           = "redis:7"
        network_mode    = "rezics"
        network_aliases = ["redis"]
        ports           = ["redis"]
      }

      resources {
        cpu    = 100
        memory = 128
      }
    }
  }

  # ── RustFS (S3) ─────────────────────────────────────────────────────────

  group "rustfs" {
    service {
      name     = "rustfs"
      port     = "s3"
      provider = "nomad"
    }

    network {
      port "s3" {
        to           = 9000
        host_network = "loopback"
      }
      port "console" {
        to           = 9001
        host_network = "loopback"
      }
    }

    task "rustfs" {
      driver = "docker"

      config {
        image           = "rustfs/rustfs"
        network_mode    = "rezics"
        network_aliases = ["rustfs"]
        ports           = ["s3", "console"]
        args            = ["server", "/data", "--console-address", ":9001"]

        mount {
          type   = "volume"
          source = "rezics-rustfs"
          target = "/data"
        }
      }

      env {
        RUSTFS_ROOT_USER     = "rustfsadmin"
        RUSTFS_ROOT_PASSWORD = "rustfsadmin"
      }

      resources {
        cpu    = 100
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
        network_mode = "rezics"
        entrypoint   = ["/bin/sh", "-c"]
        args = [
          "until mc alias set local http://rustfs:9000 rustfsadmin rustfsadmin 2>/dev/null; do sleep 2; done && mc mb --ignore-existing local/rezics && mc anonymous set download local/rezics",
        ]
      }

      resources {
        cpu    = 50
        memory = 64
      }
    }
  }

  # ── Sequin (CDC) ────────────────────────────────────────────────────────

  group "sequin" {
    service {
      name     = "sequin"
      port     = "http"
      provider = "nomad"
    }

    restart {
      attempts = 10
      interval = "5m"
      delay    = "10s"
    }

    network {
      port "http" {
        static       = 7376
        to           = 7376
        host_network = "loopback"
      }
    }

    task "sequin" {
      driver = "docker"

      config {
        image           = "sequin/sequin:v0.14.6"
        network_mode    = "rezics"
        network_aliases = ["sequin"]
        ports           = ["http"]
      }

      env {
        ENV                   = "development"
        PG_HOSTNAME           = "postgres"
        PG_PORT               = "5432"
        PG_DATABASE           = "sequin"
        PG_USERNAME           = "postgres"
        PG_PASSWORD           = "postgres"
        PG_POOL_SIZE          = "10"
        REDIS_URL             = "redis://redis:6379"
        SECRET_KEY_BASE       = "ENxZNJ8GgthCCaRFFuOUO8ZgSVihwgDsrwyEzzbqGM8aym4V9tlsR2cwv7VN5I9v"
        VAULT_KEY             = "wYd0etI+QcXxPj0Qq6cFkI91TSSK7IlQvcToD+JJnjY="
        SEQUIN_WEBHOOK_SECRET = "6a4ded3260d452d5ce5afc38f440abba8c966dabdd8a755ef53238c2cd3c6347"
        SOURCE_DB_HOST        = "postgres"
        SOURCE_DB_PORT        = "5432"
        SOURCE_DB_NAME        = "rezics_server"
        SOURCE_DB_USER        = "postgres"
        SOURCE_DB_PASSWORD    = "postgres"
        SOURCE_DB_POOL_SIZE   = "10"
        REACTION_DB_HOST      = "postgres"
        REACTION_DB_PORT      = "5432"
        REACTION_DB_NAME      = "rezics_reaction"
        REACTION_DB_USER      = "postgres"
        REACTION_DB_PASSWORD  = "postgres"
        REACTION_DB_POOL_SIZE = "5"
        JOB_RUNNER_BASE_URL   = "http://host.docker.internal:3005"
      }

      resources {
        cpu    = 300
        memory = 768
      }
    }
  }

  # ── App (backend + frontend) ────────────────────────────────────────────

  group "app" {
    network {
      port "server" {
        static       = 30000
        host_network = "loopback"
      }
      port "app" {
        static       = 35001
        host_network = "loopback"
      }
    }

    task "server" {
      driver = "raw_exec"

      config {
        command = "/bin/sh"
        args    = ["${NOMAD_TASK_DIR}/run.sh"]
      }

      template {
        data        = <<-SCRIPT
        #!/bin/sh
        until pg_isready -h 127.0.0.1 -p 5432 -q 2>/dev/null; do sleep 1; done
        cd ${var.project_root}
        exec task backend:dev
        SCRIPT
        destination = "local/run.sh"
        perms       = "0755"
      }

      env {
        NODE_ENV     = "development"
        DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/rezics_server"
        CORS_ORIGINS = "http://localhost:35001"
      }

      resources {
        cpu        = 500
        memory     = 512
        memory_max = 768
      }
    }

    task "app" {
      driver = "raw_exec"

      config {
        command = "/bin/sh"
        args    = ["${NOMAD_TASK_DIR}/run.sh"]
      }

      template {
        data        = <<-SCRIPT
        #!/bin/sh
        cd ${var.project_root}
        exec task frontend:dev
        SCRIPT
        destination = "local/run.sh"
        perms       = "0755"
      }

      env {
        NODE_ENV    = "development"
        PORT        = "35001"
        BACKEND_URL = "http://localhost:30000"
      }

      resources {
        cpu        = 500
        memory     = 512
        memory_max = 768
      }
    }
  }
}
