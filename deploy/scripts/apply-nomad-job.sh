#!/usr/bin/env bash

set -euo pipefail

if (($# < 1)); then
	printf '%s\n' "Usage: apply-nomad-job.sh <jobspec> [nomad -var arguments...]" >&2
	exit 64
fi

readonly jobspec="$1"
shift
readonly nomad_command="${NOMAD_BIN:-nomad}"
readonly evaluation_timeout_seconds="${NOMAD_EVALUATION_TIMEOUT_SECONDS:-300}"

plan_output="$(mktemp)"
readonly plan_output
trap 'rm -f "${plan_output}"' EXIT

set +e
"${nomad_command}" job plan -no-color "$@" "${jobspec}" | tee "${plan_output}"
plan_status=${PIPESTATUS[0]}
set -e

if ((plan_status != 0 && plan_status != 1)); then
	printf 'Nomad plan failed with exit status %s\n' "${plan_status}" >&2
	exit "${plan_status}"
fi

modify_index="$(sed -n 's/^Job Modify Index: //p' "${plan_output}" | tail -n 1)"
if [[ ! "${modify_index}" =~ ^[0-9]+$ ]]; then
	printf '%s\n' "Nomad plan did not return a valid Job Modify Index" >&2
	exit 1
fi

set +e
run_output="$(
	"${nomad_command}" job run -no-color -detach \
		-check-index="${modify_index}" "$@" "${jobspec}" 2>&1
)"
run_status=$?
set -e
printf '%s\n' "${run_output}"

if ((run_status != 0)); then
	exit "${run_status}"
fi

evaluation_id="$({
	printf '%s\n' "${run_output}" |
		sed -n 's/^Evaluation ID:[[:space:]]*//p' |
		tail -n 1
})"

if [[ -n "${evaluation_id}" ]]; then
	# The jobspec may target a namespace other than NOMAD_NAMESPACE. Evaluation
	# IDs are unique, so query all namespaces authorized to the deployment token.
	# Nomad 2 follows the deployment after the evaluation completes. Stop the
	# event stream at the evaluation terminal event so a manual canary can be
	# verified and promoted by its owning deployment script.
	set +e
	timeout --signal=TERM --kill-after=5s "${evaluation_timeout_seconds}" \
		"${nomad_command}" eval status -no-color -namespace='*' -monitor \
		"${evaluation_id}" |
		awk '
			{ print; fflush() }
			/^==> .*Evaluation .* finished with status / { exit }
		'
	monitor_status=${PIPESTATUS[0]}
	set -e

	evaluation_json="$({
		"${nomad_command}" eval status -json -namespace='*' "${evaluation_id}"
	})"
	evaluation_status="$(jq -er '.Status' <<<"${evaluation_json}")"
	if [[ "${evaluation_status}" == complete ]] &&
		jq -e '(.FailedTGAllocs // {}) | length == 0' \
			<<<"${evaluation_json}" >/dev/null; then
		printf 'Nomad evaluation %s completed\n' "${evaluation_id}"
		exit 0
	fi

	printf 'Nomad evaluation %s ended with status %s (monitor exit %s)\n' \
		"${evaluation_id}" "${evaluation_status}" "${monitor_status}" >&2
	"${nomad_command}" eval status -no-color -namespace='*' \
		"${evaluation_id}" >&2
	if [[ "${evaluation_status}" == complete ]]; then
		exit 2
	fi
	exit 1
fi

if grep -Fqx 'Job registration successful' <<<"${run_output}"; then
	# Periodic and parameterized jobs register a parent without creating an
	# evaluation until a scheduled or dispatched child exists.
	exit 0
fi

printf '%s\n' "Nomad did not return an evaluation or registration confirmation" >&2
exit 1
