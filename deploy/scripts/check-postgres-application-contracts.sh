#!/usr/bin/env bash

set -euo pipefail

readonly production_init_copy='COPY --chmod=0755 services/main/docker/postgres/init /docker-entrypoint-initdb.d'

for nixos_owned in \
	deploy/nomad/postgres.nomad.hcl \
	deploy/nomad/pgbouncer.nomad.hcl \
	deploy/nomad/databasus.nomad.hcl \
	deploy/nomad/databasus-verification-agent.nomad.hcl \
	deploy/scripts/deploy-production-infrastructure.sh; do
	if [[ -e "${nixos_owned}" ]]; then
		printf 'NixOS-owned database runtime definition returned to REZICS: %s\n' \
			"${nixos_owned}" >&2
		exit 1
	fi
done

for setting in 'max_wal_size=16GB' 'min_wal_size=4GB'; do
	if [[ "$(grep -F -c "${setting}" compose.yaml || true)" != 2 ]]; then
		printf 'Development and CI PostgreSQL must retain the WAL contract: %s\n' \
			"${setting}" >&2
		exit 1
	fi
done

if ! grep -Fq 'CLI_ARGS: --yes --suppress-credential-output' Taskfile.yml; then
	printf '%s\n' 'CI seed installation must not print disposable platform credentials' >&2
	exit 1
fi

for two_host_contract in \
	'@10.64.0.2:5432/rezics?sslmode=disable' \
	'POSTGRES_HOST: "10.64.0.2"' \
	'nomad/jobs/signoz-agent' \
	'REZICS_DATABASE_MONITORING_USERNAME' \
	'({Items: .Items} | tojson)'; do
	if ! grep -Fq "${two_host_contract}" deploy/scripts/install-production-variables.sh; then
		printf 'Production Variable bootstrap is missing the two-host contract: %s\n' \
			"${two_host_contract}" >&2
		exit 1
	fi
done

for monitoring_contract in \
	'REZICS_DATABASE_MONITORING_USERNAME' \
	'REZICS_DATABASE_MONITORING_PASSWORD' \
	'GRANT pg_monitor'; do
	if ! grep -Fq "${monitoring_contract}" services/main/docker/postgres/init/001-roles.sh; then
		printf 'PostgreSQL bootstrap is missing the monitoring contract: %s\n' \
			"${monitoring_contract}" >&2
		exit 1
	fi
done

for monitoring_variable in \
	'REZICS_DATABASE_MONITORING_USERNAME' \
	'REZICS_DATABASE_MONITORING_PASSWORD'; do
	if ! grep -Fq "${monitoring_variable}" compose.yaml; then
		printf 'Disposable PostgreSQL is missing the monitoring role input: %s\n' \
			"${monitoring_variable}" >&2
		exit 1
	fi
done

if ! grep -Fq 'wait-loopback-service.sh" 10.64.0.2 5432' \
	deploy/scripts/deploy-production.sh; then
	printf '%s\n' 'Production deployment must wait for B PostgreSQL readiness' >&2
	exit 1
fi

if ! grep -Fq 'Items: {' deploy/scripts/install-databasus-verification-agent.sh; then
	printf '%s\n' 'Databasus agent bootstrap must submit a complete Nomad Variable specification' >&2
	exit 1
fi

if ! grep -Fxq "${production_init_copy}" Dockerfile; then
	printf '%s\n' 'Production PostgreSQL init scripts must have checkout-independent executable modes' >&2
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

if grep -Fq 'apply-nomad-job.sh' deploy/scripts/install-databasus-verification-agent.sh; then
	printf '%s\n' 'The application repository must not submit the NixOS-owned verification-agent job' >&2
	exit 1
fi

if ! grep -Fq 'FROM postgres AS postgres-verification' Dockerfile || \
	! grep -Fq 'scripts/render-search-restore-acceptance.ts' Dockerfile; then
	printf '%s\n' 'The PostgreSQL verification image must generate REZICS search acceptance' >&2
	exit 1
fi

readonly search_acceptance_template="services/main/docker/postgres-verification/search-acceptance.sql.template"
if grep -Fq 'alias.deleted_at' "${search_acceptance_template}" || \
	[[ "$(grep -F -c 'alias.withdrawn_at IS NULL' "${search_acceptance_template}" || true)" != 2 ]]; then
	printf '%s\n' 'Restore acceptance must use the current unit_alias withdrawal contract' >&2
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

printf '%s\n' 'Validated REZICS PostgreSQL application and recovery contracts'
