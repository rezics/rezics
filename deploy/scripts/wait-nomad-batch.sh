#!/usr/bin/env bash

set -euo pipefail

namespace=""
if (($# == 3)) && [[ "$1" == "--namespace" ]]; then
	namespace="$2"
	shift 2
fi

if (($# != 1)); then
	printf '%s\n' "Usage: wait-nomad-batch.sh [--namespace <namespace>] <job-id>" >&2
	exit 64
fi

readonly job_id="$1"
readonly timeout_seconds="${NOMAD_BATCH_TIMEOUT_SECONDS:-900}"
readonly nomad_command="${NOMAD_BIN:-nomad}"
readonly namespace="${namespace:-${NOMAD_NAMESPACE:-default}}"

if [[ ! "${job_id}" =~ ^[a-zA-Z0-9_-]+(/dispatch-[0-9]+-[a-zA-Z0-9]+)?$ ]] ||
	[[ ! "${namespace}" =~ ^[a-zA-Z0-9_-]+$ ]]; then
	printf '%s\n' "Nomad job ID or namespace is malformed" >&2
	exit 64
fi

job_status="$(${nomad_command} job status -namespace="${namespace}" -json "${job_id}")"
allocations="$(${nomad_command} job allocs -namespace="${namespace}" -json "${job_id}")"
latest_version="$(jq -r 'if length == 0 then empty else map(.JobVersion) | max end' <<<"${allocations}")"
if [[ -n "${latest_version}" ]]; then
	latest_statuses="$(jq -r --argjson version "${latest_version}" \
		'[.[] | select(.JobVersion == $version) | .ClientStatus] | unique | .[]' \
		<<<"${allocations}")"
	if grep -Eq '^(failed|lost)$' <<<"${latest_statuses}"; then
		printf 'Nomad batch job %s version %s failed\n' "${job_id}" "${latest_version}" >&2
		exit 1
	fi
	if [[ "${latest_statuses}" == complete ]]; then
		printf 'Nomad batch job %s version %s completed\n' "${job_id}" "${latest_version}"
		exit 0
	fi
fi

modify_index="$(jq -r '
	([.[].ModifyIndex] | max) // empty
' <<<"${allocations}")"
if [[ -z "${modify_index}" ]]; then
	modify_index="$(jq -er '
		if type == "array" then .[0].JobModifyIndex // .[0].ModifyIndex
		else .JobModifyIndex // .ModifyIndex
		end
	' <<<"${job_status}")"
fi

terminal_status_file="$(mktemp)"
readonly terminal_status_file
trap 'rm -f "${terminal_status_file}"' EXIT
set +e
timeout --signal=TERM --kill-after=5s "${timeout_seconds}" \
	"${nomad_command}" operator api \
	-X GET \
	"/v1/event/stream?namespace=${namespace}&index=${modify_index}&topic=Allocation:*" |
	jq --unbuffered -nr --arg job_id "${job_id}" '
		first(
			inputs |
			.Events[]? |
			select(.Topic == "Allocation") |
			.Payload.Allocation |
			select(.JobID == $job_id) |
			.ClientStatus |
			select(. == "complete" or . == "failed" or . == "lost")
		)
	' >"${terminal_status_file}"
stream_status=${PIPESTATUS[0]}
set -e

status="$(<"${terminal_status_file}")"
if [[ "${status}" == complete ]]; then
	printf 'Nomad batch job %s completed\n' "${job_id}"
	exit 0
fi
if [[ "${status}" =~ ^(failed|lost)$ ]]; then
	printf 'Nomad batch job %s ended with status %s\n' "${job_id}" "${status}" >&2
	exit 1
fi

printf 'Nomad allocation event stream ended with status %s before %s completed\n' \
	"${stream_status}" "${job_id}" >&2
exit 1
