#!/usr/bin/env bash

set -euo pipefail

readonly operation="${1:-}"

case "${operation}" in
	install | release | preflight | migrate | verify | project | search-index) ;;
	*)
		printf '%s\n' \
			"Usage: database-operation.sh <install|release|preflight|migrate|verify|project|search-index>" >&2
		exit 64
		;;
esac

if [[ -z "${DATABASE_ADMIN_URL:-}" || -z "${DATABASE_URL:-}" ]]; then
	printf '%s\n' "DATABASE_ADMIN_URL and DATABASE_URL are required" >&2
	exit 64
fi

validate_database_identity() {
	local variable_name="$1"
	node -e '
		const variableName = process.argv[1];
		const expectedDatabase = process.env.REZICS_EXPECTED_DATABASE ?? "rezics";
		const value = process.env[variableName];
		if (!value) process.exit(64);
		const database = new URL(value).pathname.replace(/^\//u, "");
		if (database !== expectedDatabase) {
			console.error(`${variableName} targets ${database || "no database"}; expected ${expectedDatabase}`);
			process.exit(64);
		}
	' "${variable_name}"
}

validate_database_identity DATABASE_ADMIN_URL
validate_database_identity DATABASE_URL

cd /workspace/services/main

preflight() {
	yarn exec atlas migrate status --env main --url "${DATABASE_ADMIN_URL}"
	yarn exec tsx scripts/verify-platform-core.ts
}

migrate() {
	PGOPTIONS="-c lock_timeout=5s -c statement_timeout=5min -c idle_in_transaction_session_timeout=60s" \
		yarn exec atlas migrate apply --env main --url "${DATABASE_ADMIN_URL}" \
		--lock-timeout 5s
	yarn exec tsx scripts/ensure-database-privileges.ts
}

verify() {
	yarn exec tsx scripts/verify-postgres-runtime.ts
	yarn exec tsx scripts/verify-platform-core.ts
}

project() {
	yarn exec tsx scripts/rebuild-content-metrics.ts
	yarn exec tsx scripts/rebuild-studio.ts
}

search_index() {
	if (($# != 1)); then
		printf '%s\n' \
			"Usage: database-operation.sh search-index <check|reindex-concurrently>" >&2
		exit 64
	fi
	if [[ "$1" == "check" ]]; then
		yarn exec tsx scripts/search-index.ts check
	elif [[ "$1" == "reindex-concurrently" ]]; then
		yarn exec tsx scripts/search-index.ts reindex-concurrently --yes
	else
		printf 'Unsupported search index action: %s\n' "$1" >&2
		exit 64
	fi
}

case "${operation}" in
	install)
		migrate
		yarn exec tsx scripts/install-platform.ts --yes
		verify
		project
		;;
	release)
		preflight
		migrate
		verify
		search_index check
		;;
	preflight) preflight ;;
	migrate) migrate ;;
	verify) verify ;;
	project) project ;;
	search-index)
		shift
		search_index "$@"
		;;
esac
