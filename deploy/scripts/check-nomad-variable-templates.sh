#!/usr/bin/env bash

set -euo pipefail

readonly tuple_range='{{- range .Tuples }}'
readonly tuple_render='{{ .K }}={{ .V | toJSON }}'
readonly legacy_render='.V.Value'
readonly sequin_redis_url="REDIS_URL: (\"redis://default:\" + \$valkeyPassword + \"@127.0.0.1:6379\"),"
checked_templates=0

for jobspec in deploy/nomad/*.nomad.hcl; do
	range_count="$(grep -F -c "${tuple_range}" "${jobspec}" || true)"
	if ((range_count == 0)); then
		continue
	fi
	checked_templates=$((checked_templates + range_count))
	render_count="$(grep -F -c "${tuple_render}" "${jobspec}" || true)"
	legacy_count="$(grep -F -c "${legacy_render}" "${jobspec}" || true)"
	if ((legacy_count != 0 || render_count != range_count)); then
		printf 'Invalid Nomad Variable tuple rendering in %s\n' "${jobspec}" >&2
		exit 1
	fi
done

if ((checked_templates == 0)); then
	printf '%s\n' "No Nomad Variable tuple templates were checked" >&2
	exit 1
fi

if ! grep -Fq "${sequin_redis_url}" \
	deploy/scripts/install-production-variables.sh; then
	printf '%s\n' \
		"Sequin REDIS_URL must authenticate as the Valkey default user" >&2
	exit 1
fi

printf 'Validated %s Nomad Variable tuple templates\n' "${checked_templates}"
