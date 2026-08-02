#!/usr/bin/env bash

set -euo pipefail

if (($# != 4)); then
	printf '%s\n' \
		"Usage: deploy-production.sh <release> <api-image> <worker-image> <database-image>" >&2
	exit 64
fi

readonly release="$1"
readonly api_image="$2"
readonly worker_image="$3"
readonly database_image="$4"
readonly nomad_command="${NOMAD_BIN:-nomad}"
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly repository_root

for image in "${api_image}" "${worker_image}" "${database_image}"; do
	if [[ ! "${image}" =~ @sha256:[0-9a-f]{64}$ ]]; then
		printf 'Image must be immutable and include a sha256 digest: %s\n' "${image}" >&2
		exit 64
	fi
done

"${repository_root}/deploy/scripts/wait-loopback-service.sh" 127.0.0.1 5432
"${repository_root}/deploy/scripts/wait-loopback-service.sh" \
	127.0.0.1 7700 http://127.0.0.1:7700/health

"${repository_root}/deploy/scripts/run-database-operation.sh" \
	preflight "${release}" "${database_image}"
"${repository_root}/deploy/scripts/run-database-operation.sh" \
	migrate "${release}" "${database_image}"
"${repository_root}/deploy/scripts/run-database-operation.sh" \
	verify "${release}" "${database_image}"
"${repository_root}/deploy/scripts/apply-nomad-job.sh" \
	"${repository_root}/deploy/nomad/api.nomad.hcl" \
	-var "release=${release}" \
	-var "api_image=${api_image}"
"${repository_root}/deploy/scripts/wait-nomad-deployment.sh" rezics-api

"${repository_root}/deploy/scripts/apply-nomad-job.sh" \
	"${repository_root}/deploy/nomad/worker.nomad.hcl" \
	-var "release=${release}" \
	-var "worker_image=${worker_image}"
"${repository_root}/deploy/scripts/wait-nomad-deployment.sh" rezics-worker

"${repository_root}/deploy/scripts/run-database-operation.sh" \
	project "${release}" "${database_image}"

if "${nomad_command}" job inspect -json rezics-main >/dev/null 2>&1; then
	printf '%s\n' "Stopping the superseded combined application job"
	"${nomad_command}" job stop -no-color rezics-main
fi
