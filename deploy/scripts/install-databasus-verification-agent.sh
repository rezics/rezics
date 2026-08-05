#!/usr/bin/env bash

set -euo pipefail
umask 077

if (($# != 4)) || [[ "$1" != "--confirm-new-agent" ]]; then
	printf '%s\n' \
		"Usage: install-databasus-verification-agent.sh --confirm-new-agent <agent-id> <runner-image> <verification-postgres-image-repository> < token" >&2
	exit 64
fi

readonly agent_id="$2"
readonly runner_image="$3"
readonly verification_postgres_image_repository="$4"
readonly nomad_command="${NOMAD_BIN:-nomad}"
readonly variable_path="database/databasus-verification-agent"
readonly namespace="rezics-infrastructure"
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly repository_root

for command in jq "${nomad_command}"; do
	if ! command -v "${command}" >/dev/null 2>&1; then
		printf 'Required command is unavailable: %s\n' "${command}" >&2
		exit 69
	fi
done

if [[ ! "${agent_id}" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$ ]]; then
	printf '%s\n' "Databasus verification agent ID must be a UUID" >&2
	exit 64
fi
if [[ ! "${runner_image}" =~ @sha256:[0-9a-f]{64}$ ]]; then
	printf '%s\n' "Runner image must include an immutable sha256 digest" >&2
	exit 64
fi
if [[ ! "${verification_postgres_image_repository}" =~ ^[a-zA-Z0-9./_-]+$ ]]; then
	printf '%s\n' "Verification PostgreSQL image repository must not include a tag or digest" >&2
	exit 64
fi
IFS= read -r agent_token
if [[ -z "${agent_token}" ]]; then
	printf '%s\n' "Databasus verification agent token is required on standard input" >&2
	exit 64
fi
if "${nomad_command}" var get -namespace="${namespace}" "${variable_path}" >/dev/null 2>&1; then
	printf 'Refusing to replace existing Nomad Variable: %s/%s\n' \
		"${namespace}" "${variable_path}" >&2
	exit 1
fi

jq -n --arg id "${agent_id}" --arg token "${agent_token}" '{
  DATABASUS_VERIFICATION_AGENT_ID: $id,
  DATABASUS_VERIFICATION_AGENT_TOKEN: $token
}' | "${nomad_command}" var put -namespace="${namespace}" -in=json \
	"${variable_path}" - >/dev/null
unset agent_token

"${repository_root}/deploy/scripts/apply-nomad-job.sh" \
	"${repository_root}/deploy/nomad/databasus-verification-agent.nomad.hcl" \
	-var "runner_image=${runner_image}" \
	-var "verification_postgres_image_repository=${verification_postgres_image_repository}"
"${repository_root}/deploy/scripts/wait-nomad-deployment.sh" \
	--namespace "${namespace}" rezics-databasus-verification-agent

printf '%s\n' "Installed the Databasus verification agent without exposing its token in argv"
