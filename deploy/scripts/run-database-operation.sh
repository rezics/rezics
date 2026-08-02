#!/usr/bin/env bash

set -euo pipefail

if (($# != 3)); then
	printf '%s\n' \
		"Usage: run-database-operation.sh <preflight|migrate|verify|project> <release> <database-image>" >&2
	exit 64
fi

readonly operation="$1"
readonly release="$2"
readonly database_image="$3"
readonly nomad_command="${NOMAD_BIN:-nomad}"
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly repository_root

case "${operation}" in
	preflight | migrate | verify | project) ;;
	*)
		printf 'Unsupported database operation: %s\n' "${operation}" >&2
		exit 64
		;;
esac

if [[ ! "${database_image}" =~ @sha256:[0-9a-f]{64}$ ]]; then
	printf 'Image must be immutable and include a sha256 digest: %s\n' \
		"${database_image}" >&2
	exit 64
fi

readonly job_id="rezics-database-${operation}"
readonly jobspec="${repository_root}/deploy/nomad/database-${operation}.nomad.hcl"

"${repository_root}/deploy/scripts/apply-nomad-job.sh" \
	"${jobspec}" \
	-var "release=${release}" \
	-var "database_image=${database_image}"
"${repository_root}/deploy/scripts/wait-nomad-batch.sh" "${job_id}"
"${nomad_command}" job stop -no-color -purge "${job_id}"
