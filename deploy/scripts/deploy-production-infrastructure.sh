#!/usr/bin/env bash

set -euo pipefail

if (($# != 3)) || [[ "$1" != "--confirm-stateful-maintenance" ]]; then
	printf '%s\n' \
		"Usage: deploy-production-infrastructure.sh --confirm-stateful-maintenance <postgres-image> <databasus-image>" >&2
	exit 64
fi

readonly postgres_image="$2"
readonly databasus_image="$3"
readonly nomad_command="${NOMAD_BIN:-nomad}"
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly repository_root
readonly jobs_directory="${repository_root}/deploy/nomad"
readonly infrastructure_namespace="rezics-infrastructure"

if [[ ! "${postgres_image}" =~ @sha256:[0-9a-f]{64}$ ]]; then
	printf 'PostgreSQL image must be immutable and include a sha256 digest: %s\n' \
		"${postgres_image}" >&2
	exit 64
fi
if [[ ! "${databasus_image}" =~ ^(docker\.io/)?databasus/databasus:v3\.51\.0@sha256:[0-9a-f]{64}$ ]]; then
	printf 'Databasus must be pinned as databasus/databasus:v3.51.0@sha256:<digest>: %s\n' \
		"${databasus_image}" >&2
	exit 64
fi

if "${nomad_command}" job inspect -json rezics-infrastructure >/dev/null 2>&1; then
	printf '%s\n' \
		"Stopping the legacy combined infrastructure job before the one-time split"
	"${nomad_command}" job stop -no-color rezics-infrastructure
fi

"${repository_root}/deploy/scripts/apply-nomad-job.sh" \
	"${jobs_directory}/postgres.nomad.hcl" \
	-var "postgres_image=${postgres_image}"
"${repository_root}/deploy/scripts/wait-loopback-service.sh" 10.64.0.2 5432
"${repository_root}/deploy/scripts/wait-nomad-deployment.sh" \
	--namespace "${infrastructure_namespace}" rezics-postgres

"${repository_root}/deploy/scripts/apply-nomad-job.sh" \
	"${jobs_directory}/databasus.nomad.hcl" \
	-var "databasus_image=${databasus_image}"
"${repository_root}/deploy/scripts/wait-nomad-deployment.sh" \
	--namespace "${infrastructure_namespace}" rezics-databasus
