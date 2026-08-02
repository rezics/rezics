#!/usr/bin/env bash

set -euo pipefail

if (($# != 5)); then
	printf '%s\n' \
		"Usage: run-search-index-operation.sh <prepare|reconcile|promote|check> <current|history> <index-uid> <release> <database-image>" >&2
	exit 64
fi

readonly action="$1"
readonly projection="$2"
readonly index_uid="$3"
readonly release="$4"
readonly database_image="$5"
readonly nomad_command="${NOMAD_BIN:-nomad}"
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly repository_root

case "${action}" in
	prepare | reconcile | promote | check) ;;
	*)
		printf 'Unsupported search index action: %s\n' "${action}" >&2
		exit 64
		;;
esac
case "${projection}" in
	current | history) ;;
	*)
		printf 'Unsupported search projection: %s\n' "${projection}" >&2
		exit 64
		;;
esac
if [[ "${projection}" == current ]]; then
	readonly index_prefix=rezics_units
else
	readonly index_prefix=rezics_revisions
fi
if [[ ! "${index_uid}" =~ ^${index_prefix}_v[1-9][0-9]*_[0-9]{8,14}$ ]]; then
	printf 'Invalid versioned search index UID: %s\n' "${index_uid}" >&2
	exit 64
fi
if [[ ! "${database_image}" =~ @sha256:[0-9a-f]{64}$ ]]; then
	printf 'Image must be immutable and include a sha256 digest: %s\n' \
		"${database_image}" >&2
	exit 64
fi

"${repository_root}/deploy/scripts/apply-nomad-job.sh" \
	"${repository_root}/deploy/nomad/search-index.nomad.hcl" \
	-var "release=${release}" \
	-var "database_image=${database_image}" \
	-var "search_action=${action}" \
	-var "search_projection=${projection}" \
	-var "search_index_uid=${index_uid}"
NOMAD_BATCH_TIMEOUT_SECONDS="${SEARCH_INDEX_BATCH_TIMEOUT_SECONDS:-2100}" \
	"${repository_root}/deploy/scripts/wait-nomad-batch.sh" rezics-search-index
"${nomad_command}" job stop -no-color -purge rezics-search-index
