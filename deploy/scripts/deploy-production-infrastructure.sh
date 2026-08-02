#!/usr/bin/env bash

set -euo pipefail

bootstrap_search_credentials=false
if (($# == 4)) && [[ "$1" == "--bootstrap-search-credentials" ]]; then
	bootstrap_search_credentials=true
	shift
fi

if (($# != 3)) || [[ "$1" != "--confirm-stateful-maintenance" ]]; then
	printf '%s\n' \
		"Usage: deploy-production-infrastructure.sh [--bootstrap-search-credentials] --confirm-stateful-maintenance <postgres-image> <sequin-image>" >&2
	exit 64
fi

readonly postgres_image="$2"
readonly sequin_image="$3"
readonly nomad_command="${NOMAD_BIN:-nomad}"
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly repository_root
readonly jobs_directory="${repository_root}/deploy/nomad"
readonly infrastructure_namespace="rezics-infrastructure"

for image in "${postgres_image}" "${sequin_image}"; do
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
	"${jobs_directory}/meilisearch.nomad.hcl"
"${repository_root}/deploy/scripts/wait-loopback-service.sh" \
	127.0.0.1 7700 http://127.0.0.1:7700/health
"${repository_root}/deploy/scripts/wait-nomad-deployment.sh" \
	--namespace "${infrastructure_namespace}" rezics-meilisearch

if [[ "${bootstrap_search_credentials}" == true ]]; then
	"${repository_root}/deploy/scripts/configure-production-meilisearch.sh" \
		--confirm-production
fi

"${repository_root}/deploy/scripts/apply-nomad-job.sh" \
	"${jobs_directory}/sequin-postgres.nomad.hcl"
"${repository_root}/deploy/scripts/wait-loopback-service.sh" 127.0.0.1 5433
"${repository_root}/deploy/scripts/wait-nomad-deployment.sh" \
	--namespace "${infrastructure_namespace}" rezics-sequin-postgres

"${repository_root}/deploy/scripts/apply-nomad-job.sh" \
	"${jobs_directory}/sequin-valkey.nomad.hcl"
"${repository_root}/deploy/scripts/wait-loopback-service.sh" 127.0.0.1 6379
"${repository_root}/deploy/scripts/wait-nomad-deployment.sh" \
	--namespace "${infrastructure_namespace}" rezics-sequin-valkey

if [[ "${bootstrap_search_credentials}" != true ]]; then
	"${repository_root}/deploy/scripts/deploy-production-sequin.sh" \
		"${sequin_image}"
fi
