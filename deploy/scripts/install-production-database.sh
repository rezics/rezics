#!/usr/bin/env bash

set -euo pipefail

if (($# != 3)) || [[ "$1" != "--confirm-empty-database" ]]; then
	printf '%s\n' \
		"Usage: install-production-database.sh --confirm-empty-database <release> <database-image>" >&2
	exit 64
fi

readonly release="$2"
readonly database_image="$3"
readonly nomad_command="${NOMAD_BIN:-nomad}"
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly repository_root

if [[ ! "${database_image}" =~ @sha256:[0-9a-f]{64}$ ]]; then
	printf 'Image must be immutable and include a sha256 digest: %s\n' "${database_image}" >&2
	exit 64
fi

"${repository_root}/deploy/scripts/apply-nomad-job.sh" \
	"${repository_root}/deploy/nomad/database-install.nomad.hcl" \
	-var "release=${release}" \
	-var "database_image=${database_image}"
"${repository_root}/deploy/scripts/wait-nomad-batch.sh" rezics-database-install
allocation_id="$(
	"${nomad_command}" job allocs -json rezics-database-install |
		jq -er 'max_by(.CreateIndex).ID'
)"
readonly allocation_id
printf '%s\n' "One-time database installation output follows; store issued credentials now:"
"${nomad_command}" alloc logs -stdout "${allocation_id}" install
"${nomad_command}" job stop -no-color -purge rezics-database-install
