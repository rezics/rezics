[[ define "postgres" -]]
  group "postgres" {
    service {
      name     = "postgres"
      port     = "db"
      provider = "nomad"
    }

    network {
      port "db" {
        to           = 5432
        host_network = "loopback"
      }
    }

    task "postgres" {
      driver = "docker"

      config {
        image           = "postgres:18"
        network_mode    = "[[ var "network" . ]]"
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
        POSTGRES_USER     = "[[ var "postgres_user" . ]]"
        POSTGRES_PASSWORD = "[[ var "postgres_password" . ]]"
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
[[- end ]]
