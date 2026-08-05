#!/usr/bin/env bash

set -euo pipefail

if (($# != 3)) || [[ "$1" != "--confirm-stateful-maintenance" ]]; then
	printf '%s\n' \
		"Usage: deploy-production-infrastructure.sh --confirm-stateful-maintenance <postgres-image> <backup-image>" >&2
	exit 64
fi

readonly postgres_image="$2"
readonly backup_image="$3"
readonly nomad_command="${NOMAD_BIN:-nomad}"
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly repository_root
readonly jobs_directory="${repository_root}/deploy/nomad"
readonly infrastructure_namespace="rezics-infrastructure"

for image in "${postgres_image}" "${backup_image}"; do
	if [[ ! "${image}" =~ @sha256:[0-9a-f]{64}$ ]]; then
		printf 'Image must be immutable and include a sha256 digest: %s\n' "${image}" >&2
		exit 64
	fi
done

if "${nomad_command}" job inspect -json rezics-infrastructure >/dev/null 2>&1; then
	printf '%s\n' \
		"Stopping the legacy combined infrastructure job before the one-time split"
	"${nomad_command}" job stop -no-color rezics-infrastructure
fi

"${repository_root}/deploy/scripts/apply-nomad-job.sh" \
	"${jobs_directory}/postgres.nomad.hcl" \
	-var "postgres_image=${postgres_image}"
"${repository_root}/deploy/scripts/wait-loopback-service.sh" 127.0.0.1 5432
"${repository_root}/deploy/scripts/wait-nomad-deployment.sh" \
	--namespace "${infrastructure_namespace}" rezics-postgres

"${repository_root}/deploy/scripts/apply-nomad-job.sh" \
	"${jobs_directory}/postgres-backup.nomad.hcl" \
	-var "backup_image=${backup_image}"
"${repository_root}/deploy/scripts/apply-nomad-job.sh" \
	"${jobs_directory}/postgres-restore-drill.nomad.hcl" \
	-var "backup_image=${backup_image}" \
	-var "postgres_image=${postgres_image}"
