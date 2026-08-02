#!/usr/bin/env bash

set -euo pipefail

if [[ "${POSTGRES_DB}" != "rezics" ]]; then
	exit 0
fi

for variable_name in POSTGRES_USER REZICS_DATABASE_USERNAME SEQUIN_SOURCE_USERNAME; do
	if [[ ! "${!variable_name:-}" =~ ^[a-z][a-z0-9_]{0,62}$ ]]; then
		printf '%s must be a safe PostgreSQL identifier\n' \
			"${variable_name}" >&2
		exit 64
	fi
done

for variable_name in REZICS_DATABASE_PASSWORD SEQUIN_SOURCE_PASSWORD; do
	if [[ -z "${!variable_name:-}" ]]; then
		printf '%s is required\n' "${variable_name}" >&2
		exit 64
	fi
done

if [[ "${REZICS_DATABASE_USERNAME}" == "${SEQUIN_SOURCE_USERNAME}" ]] ||
	[[ "${POSTGRES_USER}" == "${REZICS_DATABASE_USERNAME}" ]] ||
	[[ "${POSTGRES_USER}" == "${SEQUIN_SOURCE_USERNAME}" ]]; then
	printf '%s\n' "PostgreSQL production roles must be distinct" >&2
	exit 64
fi

psql \
	--username "${POSTGRES_USER}" \
	--dbname "${POSTGRES_DB}" \
	--set ON_ERROR_STOP=1 \
	--set app_username="${REZICS_DATABASE_USERNAME}" \
	--set app_password="${REZICS_DATABASE_PASSWORD}" \
	--set sequin_username="${SEQUIN_SOURCE_USERNAME}" \
	--set sequin_password="${SEQUIN_SOURCE_PASSWORD}" <<'SQL'
SELECT format(
	'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT',
	:'app_username', :'app_password'
)
WHERE NOT EXISTS (
	SELECT 1 FROM pg_roles WHERE rolname = :'app_username'
) \gexec

SELECT format(
	'CREATE ROLE %I LOGIN PASSWORD %L REPLICATION NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT',
	:'sequin_username', :'sequin_password'
)
WHERE NOT EXISTS (
	SELECT 1 FROM pg_roles WHERE rolname = :'sequin_username'
) \gexec
SQL
