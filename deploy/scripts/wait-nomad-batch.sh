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

timeline() {
	printf 'REZICS_TIMELINE %s %s\n' \
		"$(date --utc +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

stream_pid=""
# Invoked indirectly by the EXIT trap below.
# shellcheck disable=SC2329
cleanup() {
	if [[ -n "${stream_pid}" ]]; then
		kill "${stream_pid}" 2>/dev/null || true
	fi
}
trap cleanup EXIT

job_status=""
allocations=""
for _attempt in $(seq 1 30); do
	if job_status="$(${nomad_command} job status -namespace="${namespace}" -json "${job_id}" 2>/dev/null)" &&
		allocations="$(${nomad_command} job allocs -namespace="${namespace}" -json "${job_id}" 2>/dev/null)"; then
		break
	fi
	sleep 1
done
if [[ -z "${job_status}" || -z "${allocations}" ]]; then
	printf 'Nomad batch job %s was not readable after the bounded startup wait\n' \
		"${job_id}" >&2
	exit 1
fi
latest_version="$(jq -r 'if length == 0 then empty else map(.JobVersion // 0) | max end' <<<"${allocations}")"
if [[ -n "${latest_version}" ]]; then
	latest_statuses="$(jq -r --argjson version "${latest_version}" \
		'[.[] | select(.JobVersion == $version) | .ClientStatus] | unique | .[]' \
		<<<"${allocations}")"
	if grep -Eq '^(failed|lost)$' <<<"${latest_statuses}"; then
		timeline "job=${job_id} version=${latest_version} status=failed"
		printf 'Nomad batch job %s version %s failed\n' "${job_id}" "${latest_version}" >&2
		exit 1
	fi
	if [[ "${latest_statuses}" == complete ]]; then
		timeline "job=${job_id} version=${latest_version} status=complete"
		printf 'Nomad batch job %s version %s completed\n' "${job_id}" "${latest_version}"
		exit 0
	fi
fi

modify_index="$(jq -r '([.[].ModifyIndex] | max) // empty' <<<"${allocations}")"
if [[ -z "${modify_index}" ]]; then
	modify_index="$(jq -er '
		if type == "array" then .[0].JobModifyIndex // .[0].ModifyIndex
		else .JobModifyIndex // .ModifyIndex
		end
	' <<<"${job_status}")"
fi

stream_directory="$(mktemp -d)"
stream_fifo="${stream_directory}/events"
stream_status_file="${stream_directory}/status"
mkfifo "${stream_fifo}"
# Invoked indirectly by the EXIT trap below.
# shellcheck disable=SC2329
cleanup_stream() {
	rm -rf "${stream_directory}"
}
trap 'cleanup_stream; cleanup' EXIT

(
	set +e
	timeout --signal=TERM --kill-after=5s "${timeout_seconds}" \
		"${nomad_command}" operator api \
		-X GET \
		"/v1/event/stream?namespace=${namespace}&index=${modify_index}&topic=Allocation:*" |
		jq --unbuffered -c -nr --arg job_id "${job_id}" '
			inputs |
			.Events[]? |
			select(.Topic == "Allocation") |
			.Payload.Allocation |
			select(.JobID == $job_id) |
			{
				id: .ID,
				client_status: (.ClientStatus // ""),
				client_description: (.ClientDescription // ""),
				desired_status: (.DesiredStatus // ""),
				desired_description: (.DesiredDescription // ""),
				task_states: [
					(.TaskStates // {}) | to_entries[] |
					"\(.key)=\(.value.State // "?")/\(.value.Events[-1].Type // "")"
				] | join(",")
			}
		' >"${stream_fifo}"
	pipeline_status=("${PIPESTATUS[@]}")
	printf '%s\n' "${pipeline_status[*]}" >"${stream_status_file}"
) &
stream_pid="$!"

terminal_status=""
while IFS= read -r record; do
	allocation_id="$(jq -r '.id' <<<"${record}")"
	client_status="$(jq -r '.client_status' <<<"${record}")"
	client_description="$(jq -r '.client_description' <<<"${record}" | tr $'\r\n' '  ' | cut -c1-512)"
	desired_status="$(jq -r '.desired_status' <<<"${record}")"
	desired_description="$(jq -r '.desired_description' <<<"${record}" | tr $'\r\n' '  ' | cut -c1-512)"
	task_states="$(jq -r '.task_states' <<<"${record}")"
	timeline "alloc=${allocation_id} client=${client_status} desired=${desired_status} tasks=${task_states} ${client_description} ${desired_description}"
	case "${client_status}" in
		complete)
			terminal_status=complete
			break
			;;
		failed|lost)
			terminal_status="${client_status}"
			break
			;;
	esac
done <"${stream_fifo}"

if [[ -n "${terminal_status}" && -n "${stream_pid}" ]]; then
	kill "${stream_pid}" 2>/dev/null || true
fi
wait "${stream_pid}" 2>/dev/null || true
stream_status_text=""
if [[ -r "${stream_status_file}" ]]; then
	stream_status_text="$(<"${stream_status_file}")"
fi
if [[ "${terminal_status}" == complete ]]; then
	timeline "job=${job_id} status=complete"
	printf 'Nomad batch job %s completed\n' "${job_id}"
	exit 0
fi
if [[ "${terminal_status}" =~ ^(failed|lost)$ ]]; then
	timeline "job=${job_id} status=${terminal_status}"
	printf 'Nomad batch job %s ended with status %s\n' "${job_id}" "${terminal_status}" >&2
	exit 1
fi

printf 'Nomad allocation event stream ended with status %s before %s completed\n' \
	"${stream_status_text}" "${job_id}" >&2
exit 1
