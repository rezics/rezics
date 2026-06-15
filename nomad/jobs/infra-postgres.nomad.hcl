# PostgreSQL 18.4 — primary database for all rezics services
# PostgreSQL 18.4 — rezics 全服务主数据库

job "infra-postgres" {
  datacenters = ["dc1"]
  type        = "service"

  update {
    max_parallel = 0
  }

  group "postgres" {
    count = 1

    network {
      port "db" {
        static = 5432
        to     = 5432
      }
    }

    volume "postgres-data" {
      type      = "host"
      source    = "postgres-data"
      read_only = false
    }

    service {
      name     = "postgres"
      port     = "db"
      provider = "nomad"
    }

    task "postgres" {
      driver = "docker"

      config {
        image = "postgres:18.4-trixie"
        ports = ["db"]
        args = [
          "-c", "wal_level=logical",
          "-c", "max_replication_slots=10",
          "-c", "max_wal_senders=10",
        ]
        volumes = [
          "local/init:/docker-entrypoint-initdb.d",
        ]
      }

      volume_mount {
        volume      = "postgres-data"
        destination = "/var/lib/postgresql/data"
        read_only   = false
      }

      template {
        data = <<-SCRIPT
#!/usr/bin/env bash
set -euo pipefail
declare -A DATABASES=(
  [server]=rezics_server
  [auth]=rezics_auth
  [notify]=rezics_notify
  [reaction]=rezics_reaction
  [history]=rezics_history
  [ranking]=rezics_ranking
  [job]=rezics_job
)
psql_super() { psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" "$@"; }
for service in "$${!DATABASES[@]}"; do
  db="$${DATABASES[$service]}"
  pw_var="$(echo "$service" | tr '[:lower:]' '[:upper:]')_DB_PASSWORD"
  pw="${!pw_var:-}"
  if [[ -n "$pw" ]]; then
    psql_super <<-SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${service}') THEN
    CREATE ROLE "${service}" LOGIN PASSWORD '${pw}';
  END IF;
END \$\$;
SQL
    psql_super -c "CREATE DATABASE \"${db}\" OWNER \"${service}\";" \
      2>/dev/null || echo "database ${db} already exists, skipping"
  else
    psql_super -c "CREATE DATABASE \"${db}\";" \
      2>/dev/null || echo "database ${db} already exists, skipping"
  fi
done
SCRIPT
        destination = "local/init/10-databases.sh"
        perms       = "0755"
      }

      env {
        POSTGRES_USER = "postgres"
      }

      template {
        data        = <<-EOT
{{ with nomadVar "rezics/infra" }}
POSTGRES_PASSWORD={{ .POSTGRES_PASSWORD }}
{{ end }}
EOT
        destination = "secrets/env.env"
        env         = true
      }

      resources {
        cpu        = 1000
        memory     = 1024
        memory_max = 1536
      }
    }
  }
}
