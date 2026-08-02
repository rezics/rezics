#!/usr/bin/env bash

set -euo pipefail

if (($# != 3)) || [[ "$1" != "--confirm-new-worker" ]]; then
	printf '%s\n' \
		"Usage: bootstrap-cloudflare-worker.sh --confirm-new-worker <release> <worker-secrets-file>" >&2
	exit 64
fi

readonly release="$2"
readonly worker_secrets_file="$3"
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly repository_root
readonly wrangler_config="${repository_root}/apps/web/dist/server/wrangler.json"

if [[ ! -f "${worker_secrets_file}" ]]; then
	printf 'Worker secrets file does not exist: %s\n' "${worker_secrets_file}" >&2
	exit 64
fi

turnstile_site_key="$(
	jq -er '.TURNSTILE_SITE_KEY | strings | select(length > 0)' \
		"${worker_secrets_file}"
)"
readonly turnstile_site_key

cd "${repository_root}"

CLOUDFLARE_ENV=production TURNSTILE_SITE_KEY="${turnstile_site_key}" \
	yarn workspace @rezics/frontend run generate:offline
CLOUDFLARE_ENV=production TURNSTILE_SITE_KEY="${turnstile_site_key}" \
	yarn workspace @rezics/frontend run build
if [[ ! -f "${wrangler_config}" ]]; then
	printf '%s\n' "Production Worker build did not emit a Wrangler configuration" >&2
	exit 1
fi
yarn workspace @rezics/frontend exec wrangler deploy \
	--config "${wrangler_config}" \
	--tag "${release}" \
	--message "Initial REZICS Worker deployment ${release}" \
	--secrets-file "${worker_secrets_file}" \
	--strict
