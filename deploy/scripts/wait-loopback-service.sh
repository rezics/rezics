#!/usr/bin/env bash

set -euo pipefail

if (($# < 2 || $# > 3)); then
	printf '%s\n' "Usage: wait-loopback-service.sh <host> <port> [http-health-url]" >&2
	exit 64
fi

readonly host="$1"
readonly port="$2"
readonly health_url="${3:-}"
readonly timeout_seconds="${SERVICE_START_TIMEOUT_SECONDS:-300}"
readonly deadline=$((SECONDS + timeout_seconds))

while ((SECONDS < deadline)); do
	if [[ -n "${health_url}" ]]; then
		if curl --fail --silent --show-error --max-time 3 "${health_url}" >/dev/null; then
			exit 0
		fi
	elif (exec 3<>"/dev/tcp/${host}/${port}") 2>/dev/null; then
		exit 0
	fi
	sleep 2
done

printf 'Timed out after %s seconds waiting for %s:%s\n' \
	"${timeout_seconds}" "${host}" "${port}" >&2
exit 1
