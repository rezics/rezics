#!/usr/bin/env bash
# Database-per-service bootstrap for the single infra-db Postgres instance.
# Runs once, on first container start (docker-entrypoint-initdb.d), as the
# superuser. Creates one database per service so each service connects through
# its own explicit *_DATABASE_URL.
#
# Optional per-service login roles: set <SERVICE>_DB_PASSWORD in the postgres
# accessory env (e.g. SERVER_DB_PASSWORD) to create a dedicated owner role;
# otherwise the database is owned by the superuser and the service connects
# with the superuser credential (acceptable for a single-instance v1).
set -euo pipefail

# Service key -> database name. The `server` schema owns `rezics_server`.
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

for service in "${!DATABASES[@]}"; do
  db="${DATABASES[$service]}"
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
