#!/usr/bin/env bash

set -euo pipefail

if (($# != 3)); then
	printf '%s\n' \
		"Usage: run-search-index-operation.sh <check|reindex-concurrently> <release> <database-image>" >&2
	exit 64
fi

readonly action="$1"
readonly release="$2"
readonly database_image="$3"
readonly nomad_command="${NOMAD_BIN:-nomad}"
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly repository_root

case "${action}" in
	check | reindex-concurrently) ;;
	*)
		printf 'Unsupported search index action: %s\n' "${action}" >&2
		exit 64
		;;
esac
if [[ ! "${database_image}" =~ @sha256:[0-9a-f]{64}$ ]]; then
	printf 'Image must be immutable and include a sha256 digest: %s\n' \
		"${database_image}" >&2
	exit 64
fi

"${repository_root}/deploy/scripts/apply-nomad-job.sh" \
	"${repository_root}/deploy/nomad/search-index.nomad.hcl" \
	-var "release=${release}" \
	-var "database_image=${database_image}" \
	-var "search_action=${action}"
NOMAD_BATCH_TIMEOUT_SECONDS="${SEARCH_INDEX_BATCH_TIMEOUT_SECONDS:-2100}" \
	"${repository_root}/deploy/scripts/wait-nomad-batch.sh" rezics-search-index
"${nomad_command}" job stop -no-color -purge rezics-search-index
