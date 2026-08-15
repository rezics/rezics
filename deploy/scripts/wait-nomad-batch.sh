#!/usr/bin/env bash

set -euo pipefail

namespace=""
forward_logs=false
while (($# > 0)); do
	case "$1" in
		--namespace)
			if (($# < 2)); then
				printf '%s\n' "--namespace requires a value" >&2
				exit 64
			fi
			namespace="$2"
			shift 2
			;;
		--forward-logs)
			forward_logs=true
			shift
			;;
		--)
			shift
			break
			;;
		-*)
			printf 'Unknown option: %s\n' "$1" >&2
			exit 64
			;;
		*)
			break
			;;
	esac
done

if (($# != 1)); then
	printf '%s\n' "Usage: wait-nomad-batch.sh [--namespace <namespace>] [--forward-logs] <job-id>" >&2
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

job_base="${job_id%%/dispatch-*}"
logs_allowed=false
if [[ "${forward_logs}" == true ]] &&
	[[ "${job_base}" =~ ^rezics-release-(maintenance|database|api-deploy|worker-deploy|projection)$ ]]; then
	logs_allowed=true
fi

declare -a log_forwarder_pids=()
declare -A log_forwarder_keys=()
stream_pid=""
# Invoked indirectly by the EXIT trap below.
# shellcheck disable=SC2329
cleanup() {
	local pid
	if [[ -n "${stream_pid}" ]]; then
		kill "${stream_pid}" 2>/dev/null || true
	fi
	for pid in "${log_forwarder_pids[@]}"; do
		kill "${pid}" 2>/dev/null || true
	done
}
trap cleanup EXIT

start_allocation_logs() {
	local allocation_id="$1"
	local allocation_json task_name task_state key
	[[ "${logs_allowed}" == true ]] || return 0

	allocation_json="$(${nomad_command} alloc status -namespace="${namespace}" -json "${allocation_id}" 2>/dev/null || true)"
	[[ -n "${allocation_json}" ]] || return 0
	while IFS=$'\t' read -r task_name task_state; do
		[[ -n "${task_name}" ]] || continue
		case "${task_state}" in
			running|dead|failed|complete) ;;
			*) continue ;;
		esac
		key="${allocation_id}/${task_name}"
		[[ -z "${log_forwarder_keys[${key}]+set}" ]] || continue
		log_forwarder_keys["${key}"]=1
		(
			set +e
			"${nomad_command}" alloc logs \
				-namespace="${namespace}" \
				-f \
				-tail -n 200 \
				"${allocation_id}" "${task_name}" 2>&1 |
			{
				line_count=0
				byte_count=0
				while IFS= read -r line || [[ -n "${line}" ]]; do
					((line_count += 1))
					((byte_count += ${#line} + 1))
					if ((line_count > 4000 || byte_count > 1048576)); then
						printf 'REZICS_TIMELINE %s alloc=%s task=%s log forwarding stopped after the bounded limit\n' \
							"$(date --utc +%Y-%m-%dT%H:%M:%SZ)" \
							"${allocation_id}" "${task_name}"
						break
					fi
					line="${line//$'\r'/}"
					printf 'REZICS_TIMELINE %s alloc=%s task=%s %s\n' \
						"$(date --utc +%Y-%m-%dT%H:%M:%SZ)" \
						"${allocation_id}" "${task_name}" "${line}"
				done
			}
		) &
		log_forwarder_pids+=("$!")
	done < <(
		jq -r '.TaskStates // {} | to_entries[] | [.key, (.value.State // "")] | @tsv' \
			<<<"${allocation_json}"
	)
}

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
	while IFS= read -r allocation_id; do
		[[ -n "${allocation_id}" ]] || continue
		start_allocation_logs "${allocation_id}"
	done < <(jq -r --argjson version "${latest_version}" \
		'.[] | select(.JobVersion == $version) | .ID' <<<"${allocations}")
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
	start_allocation_logs "${allocation_id}"
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
