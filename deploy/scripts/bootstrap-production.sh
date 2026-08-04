#!/usr/bin/env bash

set -euo pipefail

if (($# != 7)) || [[ "$1" != "--confirm-empty-database" ]]; then
	printf '%s\n' \
		"Usage: bootstrap-production.sh --confirm-empty-database <release> <api-image> <worker-image> <database-image> <postgres-image> <sequin-image>" >&2
	exit 64
fi

readonly release="$2"
readonly api_image="$3"
readonly worker_image="$4"
readonly database_image="$5"
readonly postgres_image="$6"
readonly sequin_image="$7"
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly repository_root
readonly jobs_directory="${repository_root}/deploy/nomad"
readonly current_search_index="rezics_units_v1_20260804"

for image in "${api_image}" "${worker_image}" "${database_image}" "${postgres_image}" "${sequin_image}"; do
	if [[ ! "${image}" =~ @sha256:[0-9a-f]{64}$ ]]; then
		printf 'Image must be immutable and include a sha256 digest: %s\n' "${image}" >&2
		exit 64
	fi
done

"${repository_root}/deploy/scripts/deploy-production-infrastructure.sh" \
	--bootstrap-search-credentials \
	--confirm-stateful-maintenance "${postgres_image}" "${sequin_image}"

"${repository_root}/deploy/scripts/install-production-database.sh" \
	--confirm-empty-database "${release}" "${database_image}"

"${repository_root}/deploy/scripts/run-search-index-operation.sh" \
	prepare current "${current_search_index}" "${release}" "${database_image}"
"${repository_root}/deploy/scripts/deploy-production-sequin.sh" \
	"${sequin_image}"
"${repository_root}/deploy/scripts/run-search-index-operation.sh" \
	reconcile current "${current_search_index}" "${release}" "${database_image}"
"${repository_root}/deploy/scripts/run-search-index-operation.sh" \
	promote current "${current_search_index}" "${release}" "${database_image}"

"${repository_root}/deploy/scripts/apply-nomad-job.sh" \
	"${jobs_directory}/api.nomad.hcl" \
	-var "release=${release}" \
	-var "api_image=${api_image}"
"${repository_root}/deploy/scripts/wait-nomad-deployment.sh" rezics-api
"${repository_root}/deploy/scripts/apply-nomad-job.sh" \
	"${jobs_directory}/worker.nomad.hcl" \
	-var "release=${release}" \
	-var "worker_image=${worker_image}"
"${repository_root}/deploy/scripts/wait-nomad-deployment.sh" rezics-worker
