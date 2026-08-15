#!/usr/bin/env bash

set -euo pipefail
umask 077

if (($# != 4)); then
	printf '%s\n' "Usage: follow-nomad-release.sh <timeline-url> <job-id> <eval-id> <oidc-audience>" >&2
	exit 64
fi

timeline_url="$1"
job_id="$2"
evaluation_id="$3"
oidc_audience="$4"
if [[ ! "$timeline_url" =~ ^https:// ]] ||
	[[ ! "$job_id" =~ ^rezics-release/dispatch-[0-9]+-[A-Za-z0-9]+$ ]] ||
	[[ ! "$evaluation_id" =~ ^[A-Za-z0-9_-]{1,128}$ ]] ||
	[[ -z "$oidc_audience" ]]; then
	printf '%s\n' "Nomad timeline arguments are malformed" >&2
	exit 64
fi

runner_temp="$(printenv RUNNER_TEMP || true)"
tmp_dir="$(printenv TMPDIR || true)"
oidc_request_token="$(printenv ACTIONS_ID_TOKEN_REQUEST_TOKEN || true)"
oidc_request_url="$(printenv ACTIONS_ID_TOKEN_REQUEST_URL || true)"
if [[ -z "$oidc_request_token" || -z "$oidc_request_url" ]]; then
	printf '%s\n' "GitHub Actions OIDC request environment is missing" >&2
	exit 1
fi
temporary_root=/tmp
if [[ -n "$runner_temp" ]]; then
	temporary_root="$runner_temp"
elif [[ -n "$tmp_dir" ]]; then
	temporary_root="$tmp_dir"
fi
temporary_directory="$(mktemp -d "$temporary_root/rezics-timeline.XXXXXX")"
stream_pid=""
cleanup() {
	if [[ -n "$stream_pid" ]]; then
		kill "$stream_pid" 2>/dev/null || true
	fi
	rm -rf "$temporary_directory"
}
trap cleanup EXIT INT TERM

get_oidc_token() {
	curl --fail --silent --show-error \
		--header "Authorization: bearer $oidc_request_token" \
		--get \
		--data-urlencode "audience=$oidc_audience" \
		"$oidc_request_url" |
		jq -er '.value'
}

uri_encode() {
	jq -rn --arg value "$1" '$value | @uri'
}

cursor=""
connection_failures=0
while true; do
	oidc_token="$(get_oidc_token)"
	stream_fifo="$temporary_directory/stream"
	curl_error="$temporary_directory/curl-error"
	rm -f "$stream_fifo" "$curl_error"
	mkfifo "$stream_fifo"

	query="job_id=$(uri_encode "$job_id")&eval_id=$(uri_encode "$evaluation_id")"
	if [[ -n "$cursor" ]]; then
		query+="&cursor=$(uri_encode "$cursor")"
	fi

	curl --fail --silent --show-error --no-buffer \
		--connect-timeout 15 \
		--header "Authorization: Bearer $oidc_token" \
		--header "Accept: text/event-stream" \
		"$timeline_url?$query" \
		>"$stream_fifo" 2>"$curl_error" &
	stream_pid="$!"
	unset oidc_token

	event=""
	terminal_status=""
	while IFS= read -r line || [[ -n "$line" ]]; do
		case "$line" in
			event:\ *)
				event="$(printf '%s' "$line" | cut -c8-)"
				;;
			id:\ *)
				cursor="$(printf '%s' "$line" | cut -c5-)"
				;;
			data:\ *)
				payload="$(printf '%s' "$line" | cut -c7-)"
				if [[ "$event" == heartbeat ]]; then
					continue
				fi
				if [[ "$event" == terminal ]]; then
					terminal_status="$(jq -er '.status' <<<"$payload")"
					printf 'REZICS_TIMELINE terminal status=%s allocation=%s\n' \
						"$terminal_status" \
						"$(jq -r '.allocation_id // \"unknown\"' <<<"$payload")"
					break
				fi
				printf '%s\n' "$payload"
				;;
			"")
				event=""
				;;
		esac
	done <"$stream_fifo"

	if [[ -n "$terminal_status" ]]; then
		kill "$stream_pid" 2>/dev/null || true
		wait "$stream_pid" 2>/dev/null || true
		if [[ "$terminal_status" == successful ]]; then
			exit 0
		fi
		exit 1
	fi

	curl_status=0
	wait "$stream_pid" 2>/dev/null || curl_status="$?"
	connection_failures=$((connection_failures + 1))
	if ((connection_failures >= 12)); then
		printf 'Nomad timeline connection failed after %s attempts (curl=%s): ' \
			"$connection_failures" "$curl_status" >&2
		head -c 2048 "$curl_error" >&2 || true
		printf '\n' >&2
		exit 1
	fi
	if [[ -s "$curl_error" ]]; then
		printf 'Nomad timeline connection interrupted (attempt %s, curl=%s): ' \
			"$connection_failures" "$curl_status" >&2
		head -c 2048 "$curl_error" >&2 || true
		printf '\n' >&2
	else
		printf 'Nomad timeline connection ended before terminal state (attempt %s, curl=%s)\n' \
			"$connection_failures" "$curl_status" >&2
	fi
	sleep 2
done
