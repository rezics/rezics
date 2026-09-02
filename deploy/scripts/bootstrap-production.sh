#!/usr/bin/env bash

set -euo pipefail

if (($# != 5)) || [[ "$1" != "--confirm-empty-database" ]]; then
	printf '%s\n' \
		"Usage: bootstrap-production.sh --confirm-empty-database <release> <api-image> <worker-image> <database-image>" >&2
	exit 64
fi

readonly release="$2"
readonly api_image="$3"
readonly worker_image="$4"
readonly database_image="$5"
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly repository_root
readonly jobs_directory="${repository_root}/deploy/nomad"

for image in "${api_image}" "${worker_image}" "${database_image}"; do
	if [[ ! "${image}" =~ @sha256:[0-9a-f]{64}$ ]]; then
		printf 'Image must be immutable and include a sha256 digest: %s\n' "${image}" >&2
		exit 64
	fi
done

"${repository_root}/deploy/scripts/install-production-database.sh" \
	--confirm-empty-database "${release}" "${database_image}"

"${repository_root}/deploy/scripts/run-search-index-operation.sh" \
	check "${release}" "${database_image}"

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
