#!/usr/bin/env bash

set -euo pipefail

service_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repository_root="$(cd "${service_root}/../.." && pwd)"
readonly service_root repository_root
readonly migration_directory="${service_root}/src/services/database/migrations"

if (($# != 1)); then
	printf '%s\n' 'Usage: generate-database-migration.sh <snake_case_name>' >&2
	exit 2
fi

readonly migration_name="$1"
if ((${#migration_name} > 80)) || [[ ! "${migration_name}" =~ ^[a-z][a-z0-9]*(_[a-z0-9]+)*$ ]]; then
	printf 'Migration name must be lower snake_case: %s\n' "${migration_name}" >&2
	exit 2
fi

readonly migration_port="${POSTGRES_MIGRATION_LOCAL_PORT:-5433}"
if [[ ! "${migration_port}" =~ ^[0-9]+$ ]] || ((migration_port < 1 || migration_port > 65535)); then
	printf 'Invalid POSTGRES_MIGRATION_LOCAL_PORT: %s\n' "${migration_port}" >&2
	exit 2
fi
readonly shadow_url="postgres://postgres:postgres@localhost:${migration_port}/rezics_atlas?search_path=public&sslmode=disable"

mkdir -p "${repository_root}/.temp"
work_directory="$(mktemp -d "${repository_root}/.temp/database-migration.XXXXXX")"
readonly work_directory
readonly draft_file="${work_directory}/migration.sql"
readonly checksum_backup="${work_directory}/atlas.sum"
target_file=''
completed=false

cleanup() {
	local exit_status=$?
	trap - EXIT INT TERM
	if [[ "${completed}" != true && -n "${target_file}" && -e "${target_file}" ]]; then
		rm -f "${target_file}"
		cp "${checksum_backup}" "${migration_directory}/atlas.sum"
	fi
	rm -rf "${work_directory}"
	exit "${exit_status}"
}
trap cleanup EXIT INT TERM

cp "${migration_directory}/atlas.sum" "${checksum_backup}"

cd "${service_root}"
yarn exec atlas schema diff --env main \
	--from "${shadow_url}" \
	--to env://schema.src \
	--exclude atlas_schema_revisions \
	--exclude '*[type=extension|function|trigger]' \
	--exclude 'unit_localization.unit_localization_pgroonga_*[type=index]' \
	>"${draft_file}"

if grep -Fqx 'Schemas are synced, no changes to be made.' "${draft_file}"; then
	printf '%s\n' 'The replayed migrations already match the Drizzle schema; no migration was created.'
	exit 0
fi
if [[ ! -s "${draft_file}" ]]; then
	printf '%s\n' 'Atlas produced an empty schema diff; no migration was created.' >&2
	exit 1
fi

latest_file="$(find "${migration_directory}" -maxdepth 1 -type f -name '[0-9]*_*.sql' -printf '%f\n' | sort | tail -n 1)"
readonly latest_file
latest_version="${latest_file%%_*}"
readonly latest_version
migration_version="$(date -u +%Y%m%d%H%M%S)"
readonly migration_version
if [[ ! "${latest_version}" =~ ^[0-9]{14}$ ]] || [[ "${migration_version}" < "${latest_version}" ]] || [[ "${migration_version}" == "${latest_version}" ]]; then
	printf 'Current UTC migration version %s must be later than %s\n' \
		"${migration_version}" "${latest_version}" >&2
	exit 1
fi

candidate_target_file="${migration_directory}/${migration_version}_${migration_name}.sql"
readonly candidate_target_file
if [[ -e "${candidate_target_file}" ]]; then
	printf 'Migration target already exists: %s\n' "${candidate_target_file}" >&2
	exit 1
fi

target_file="${candidate_target_file}"
mv "${draft_file}" "${target_file}"
yarn exec atlas migrate hash --env main
completed=true
printf 'Created reviewed migration draft: %s\n' "${target_file}"
