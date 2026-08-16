#!/usr/bin/env bash

set -euo pipefail

readonly volume_destination='destination = "/var/lib/postgresql"'
readonly production_init_copy='COPY --chmod=0755 services/main/docker/postgres/init /docker-entrypoint-initdb.d'

for jobspec in deploy/nomad/postgres.nomad.hcl; do
	pgdata_count="$(grep -E -c \
		'^[[:space:]]*PGDATA[[:space:]]*=[[:space:]]*"/var/lib/postgresql/18/docker"' \
		"${jobspec}" || true)"
	volume_count="$(grep -F -c "${volume_destination}" "${jobspec}" || true)"

	if ((pgdata_count != 1 || volume_count != 1)); then
		printf 'Invalid PostgreSQL 18 volume layout in %s\n' "${jobspec}" >&2
		exit 1
	fi

done

for setting in \
	'"-c", "wal_level=replica"' \
	'"-c", "max_replication_slots=0"' \
	'"-c", "max_wal_size=16GB"' \
	'"-c", "min_wal_size=4GB"' \
	'"-c", "max_worker_processes=16"'; do
	if ! grep -Fq "${setting}" deploy/nomad/postgres.nomad.hcl; then
		printf 'Production PostgreSQL is missing the no-logical-CDC contract: %s\n' "${setting}" >&2
		exit 1
	fi
done

if ! grep -Fq '"-c", "pgroonga.enable_wal=off"' deploy/nomad/postgres.nomad.hcl; then
	printf '%s\n' 'Legacy PGroonga WAL must be explicitly disabled with WAL Resource Manager' >&2
	exit 1
fi

if ! grep -Fq '"-c", "shared_preload_libraries=pg_stat_statements,pgroonga_wal_resource_manager,pgroonga_crash_safer"' \
	deploy/nomad/postgres.nomad.hcl; then
	printf '%s\n' 'Production PostgreSQL must preload statistics and PGroonga WAL/crash modules' >&2
	exit 1
fi

for setting in \
	'"-c", "pgroonga.enable_wal_resource_manager=on"' \
	'"-c", "pgroonga.enable_crash_safe=on"' \
	'"-c", "compute_query_id=on"' \
	'"-c", "pg_stat_statements.track=all"' \
	'"-c", "track_io_timing=on"' \
	'"-c", "track_wal_io_timing=on"'; do
	if ! grep -Fq "${setting}" deploy/nomad/postgres.nomad.hcl; then
		printf 'Production PostgreSQL is missing required setting: %s\n' "${setting}" >&2
		exit 1
	fi
done

if ! grep -Fxq "${production_init_copy}" Dockerfile; then
	printf '%s\n' 'Production PostgreSQL init scripts must have checkout-independent executable modes' >&2
	exit 1
fi

if grep -Fq 'POSTGRES_USER = "postgres"' deploy/nomad/postgres.nomad.hcl; then
	printf '%s\n' 'Production PostgreSQL superuser must come from its Nomad Variable' >&2
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

for required in \
	'databasus/databasus:v3\.51\.0@sha256:' \
	'database/databasus-control' \
	'/databasus-data/secret.key:ro'; do
	if ! grep -Eq "${required}" deploy/scripts/deploy-production-infrastructure.sh \
		deploy/nomad/databasus.nomad.hcl; then
		printf 'Databasus production contract is missing: %s\n' "${required}" >&2
		exit 1
	fi
done

if ! grep -Fq '"verificationPgImageRepo":' \
	deploy/nomad/databasus-verification-agent.nomad.hcl; then
	printf '%s\n' 'Databasus verification must use the REZICS PostgreSQL image repository' >&2
	exit 1
fi

if ! grep -Fq 'FROM postgres AS postgres-verification' Dockerfile || \
	! grep -Fq 'scripts/render-search-restore-acceptance.ts' Dockerfile; then
	printf '%s\n' 'The PostgreSQL verification image must generate REZICS search acceptance' >&2
	exit 1
fi

for removed in \
	deploy/nomad/postgres-backup.nomad.hcl \
	deploy/nomad/postgres-restore-drill.nomad.hcl \
	deploy/scripts/postgres-logical-backup.sh \
	deploy/scripts/postgres-restore-drill.sh; do
	if [[ -e "${removed}" ]]; then
		printf 'Superseded custom backup implementation still exists: %s\n' "${removed}" >&2
		exit 1
	fi
done

for cutover_contract in \
	'--confirm-verified-managed-backup' \
	'rezics-postgres-backup' \
	'database/backup-uploader'; do
	if ! grep -Fq -- "${cutover_contract}" deploy/scripts/finalize-databasus-cutover.sh; then
		printf 'Managed-backup cutover contract is missing: %s\n' "${cutover_contract}" >&2
		exit 1
	fi
done

printf '%s\n' 'Validated PostgreSQL 18 and Databasus Nomad contracts'
