#!/usr/bin/env bash

set -euo pipefail

if (($# != 1)); then
	printf '%s\n' "Usage: deploy-production-sequin.sh <sequin-image>" >&2
	exit 64
fi

readonly sequin_image="$1"
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly repository_root
readonly infrastructure_namespace="rezics-infrastructure"

if [[ ! "${sequin_image}" =~ @sha256:[0-9a-f]{64}$ ]]; then
	printf 'Image must be immutable and include a sha256 digest: %s\n' \
		"${sequin_image}" >&2
	exit 64
fi

"${repository_root}/deploy/scripts/apply-nomad-job.sh" \
	"${repository_root}/deploy/nomad/sequin.nomad.hcl" \
	-var "sequin_image=${sequin_image}"
"${repository_root}/deploy/scripts/wait-loopback-service.sh" \
	127.0.0.1 7376 http://127.0.0.1:7376/health
"${repository_root}/deploy/scripts/wait-nomad-deployment.sh" \
	--namespace "${infrastructure_namespace}" rezics-sequin
