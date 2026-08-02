#!/usr/bin/env bash

set -euo pipefail

namespace=""
if (($# == 3)) && [[ "$1" == "--namespace" ]]; then
	namespace="$2"
	shift 2
fi

if (($# != 1)); then
	printf '%s\n' \
		"Usage: wait-nomad-deployment.sh [--namespace <namespace>] <job-id>" >&2
	exit 64
fi

readonly job_id="$1"
readonly timeout_seconds="${NOMAD_DEPLOYMENT_TIMEOUT_SECONDS:-2400}"
readonly nomad_command="${NOMAD_BIN:-nomad}"
readonly namespace="${namespace:-${NOMAD_NAMESPACE:-default}}"

if [[ ! "${job_id}" =~ ^[a-zA-Z0-9_-]+$ ]] ||
	[[ ! "${namespace}" =~ ^[a-zA-Z0-9_-]+$ ]]; then
	printf '%s\n' "Nomad job ID or namespace is malformed" >&2
	exit 64
fi

job_status="$(${nomad_command} job status -namespace="${namespace}" -json "${job_id}")"
deployment_id="$(jq -r '
	if type == "array" then .[0].LatestDeployment.ID // empty
	else .LatestDeployment.ID // empty
	end
' <<<"${job_status}")"
if [[ -z "${deployment_id}" ]]; then
	printf 'Job %s has no deployment after its evaluation completed\n' "${job_id}" >&2
	exit 1
fi

deployment_status="$(${nomad_command} deployment status -namespace="${namespace}" -json "${deployment_id}")"
status="$(jq -er '.Status' <<<"${deployment_status}")"
case "${status}" in
	successful)
		printf 'Nomad deployment %s for %s completed\n' "${deployment_id}" "${job_id}"
		exit 0
		;;
	failed | cancelled | blocked)
		printf 'Nomad deployment %s for %s ended with status %s\n' \
			"${deployment_id}" "${job_id}" "${status}" >&2
	exit 1
		;;
esac

modify_index="$(jq -er '.ModifyIndex' <<<"${deployment_status}")"
terminal_status_file="$(mktemp)"
readonly terminal_status_file
trap 'rm -f "${terminal_status_file}"' EXIT

set +e
timeout --signal=TERM --kill-after=5s "${timeout_seconds}" \
	"${nomad_command}" operator api \
	-X GET \
	"/v1/event/stream?namespace=${namespace}&index=${modify_index}&topic=Deployment:*" |
	jq --unbuffered -nr --arg deployment_id "${deployment_id}" '
		first(
			inputs |
			.Events[]? |
			select(.Topic == "Deployment") |
			.Payload.Deployment |
			select(.ID == $deployment_id) |
			.Status |
			select(
				. == "successful" or . == "failed" or
				. == "cancelled" or . == "blocked"
			)
		)
	' >"${terminal_status_file}"
stream_status=${PIPESTATUS[0]}
set -e

status="$(<"${terminal_status_file}")"
if [[ "${status}" == successful ]]; then
	final_status="$(${nomad_command} deployment status -namespace="${namespace}" -json "${deployment_id}")"
	jq -e '.Status == "successful"' <<<"${final_status}" >/dev/null
	printf 'Nomad deployment %s for %s completed\n' "${deployment_id}" "${job_id}"
	exit 0
fi
if [[ "${status}" =~ ^(failed|cancelled|blocked)$ ]]; then
	printf 'Nomad deployment %s for %s ended with status %s\n' \
		"${deployment_id}" "${job_id}" "${status}" >&2
	"${nomad_command}" deployment status -namespace="${namespace}" \
		"${deployment_id}" >&2
	exit 1
fi

printf 'Nomad deployment event stream ended with status %s before %s completed\n' \
	"${stream_status}" "${deployment_id}" >&2
exit 1
