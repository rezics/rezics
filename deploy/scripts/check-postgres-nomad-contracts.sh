#!/usr/bin/env bash

set -euo pipefail

readonly volume_destination='destination = "/var/lib/postgresql"'
readonly production_socket_argument='"-c", "unix_socket_directories=/var/lib/postgresql/18/docker"'
readonly production_init_copy='COPY --chmod=0755 services/main/docker/postgres/init /docker-entrypoint-initdb.d'

for jobspec in \
	deploy/nomad/postgres.nomad.hcl \
	deploy/nomad/sequin-postgres.nomad.hcl; do
	pgdata_count="$(grep -E -c \
		'^[[:space:]]*PGDATA[[:space:]]*=[[:space:]]*"/var/lib/postgresql/18/docker"' \
		"${jobspec}" || true)"
	volume_count="$(grep -F -c "${volume_destination}" "${jobspec}" || true)"

	if ((pgdata_count != 1 || volume_count != 1)); then
		printf 'Invalid PostgreSQL 18 volume layout in %s\n' "${jobspec}" >&2
		exit 1
	fi

done

production_socket_count="$(grep -F -c \
	"${production_socket_argument}" deploy/nomad/postgres.nomad.hcl || true)"
if ((production_socket_count != 1)); then
	printf '%s\n' 'Production PostgreSQL must expose its socket through the backup volume' >&2
	exit 1
fi

if ! grep -Fq '"-c", "max_slot_wal_keep_size=32GB"' deploy/nomad/postgres.nomad.hcl; then
	printf '%s\n' 'Production PostgreSQL must retain 32GB per logical replication slot' >&2
	exit 1
fi

if ! grep -Fq '"-c", "shared_preload_libraries=pg_stat_statements"' \
	deploy/nomad/postgres.nomad.hcl; then
	printf '%s\n' 'Production PostgreSQL must preload pg_stat_statements' >&2
	exit 1
fi

if grep -Fq 'unix_socket_directories' deploy/nomad/sequin-postgres.nomad.hcl; then
	printf '%s\n' 'Sequin PostgreSQL must retain the entrypoint initialization socket' >&2
	exit 1
fi

if ! grep -Fxq "${production_init_copy}" Dockerfile; then
	printf '%s\n' 'Production PostgreSQL init scripts must have checkout-independent executable modes' >&2
	exit 1
fi

if grep -Fq 'POSTGRES_USER = "postgres"' deploy/nomad/postgres.nomad.hcl; then
	printf '%s\n' 'Production PostgreSQL superuser must come from its Nomad Variable' >&2
	exit 1
fi

if grep -Fq 'SEQUIN_SOURCE_USERNAME         = "rezics_sequin"' \
	deploy/nomad/sequin.nomad.hcl; then
	printf '%s\n' 'Sequin source username must come from its Nomad Variable' >&2
	exit 1
fi

if grep -Fq 'atlas migrate validate' deploy/scripts/database-operation.sh; then
	printf '%s\n' 'Production database operations must not require an Atlas dev database' >&2
	exit 1
fi

if ! grep -Fq 'yarn exec atlas migrate validate --dir file://src/services/database/migrations' \
	services/main/Taskfile.yml; then
	printf '%s\n' 'CI must retain Atlas migration validation' >&2
	exit 1
fi

printf '%s\n' 'Validated PostgreSQL 18 Nomad initialization contracts'
