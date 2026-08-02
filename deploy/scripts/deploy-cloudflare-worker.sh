#!/usr/bin/env bash

set -euo pipefail

if (($# != 2)); then
	printf '%s\n' \
		"Usage: deploy-cloudflare-worker.sh <release> <worker-secrets-file>" >&2
	exit 64
fi

readonly release="$1"
readonly worker_secrets_input="$2"
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly repository_root
if [[ "${worker_secrets_input}" == /* ]]; then
	worker_secrets_file="${worker_secrets_input}"
else
	worker_secrets_file="${repository_root}/${worker_secrets_input}"
fi
readonly worker_secrets_file
readonly web_root="${repository_root}/apps/web"
readonly wrangler_config="${web_root}/dist/server/wrangler.json"
readonly worker_name="rezics-web"
readonly worker_url="https://www.rezics.com/"
readonly settle_seconds="${CLOUDFLARE_VERSION_SETTLE_SECONDS:-5}"
readonly result_file="${REZICS_DEPLOY_RESULT_FILE:-}"

if [[ ! -f "${worker_secrets_file}" ]]; then
	printf 'Worker secrets file does not exist: %s\n' "${worker_secrets_file}" >&2
	exit 64
fi

jq -er '.TURNSTILE_SITE_KEY | strings | select(length > 0)' \
	"${worker_secrets_file}" >/dev/null

if [[ ! -f "${wrangler_config}" ]]; then
	printf '%s\n' "Production Worker build is missing; build it before deployment" >&2
	exit 64
fi

wrangler_output="$(mktemp)"
response_headers="$(mktemp)"
response_body="$(mktemp)"
readonly wrangler_output response_headers response_body
previous_version=""
new_version=""
deployment_changed=false

probe_production_version() {
	local expected_version="$1"
	local observed_version
	: >"${response_headers}"
	: >"${response_body}"
	curl --fail --silent --show-error \
		--connect-timeout 5 --max-time 30 \
		--header 'X-Rezics-Deployment-Probe: 1' \
		--dump-header "${response_headers}" \
		--output "${response_body}" \
		"${worker_url}"
	observed_version="$({
		awk '
			BEGIN { IGNORECASE = 1 }
			/^x-rezics-worker-version:/ {
				sub(/^[^:]+:[[:space:]]*/, "")
				sub(/\r$/, "")
				value = $0
			}
			END { print value }
		' "${response_headers}"
	})"
	[[ "${observed_version}" == "${expected_version}" ]] &&
		grep -Fq 'data-font-awesome="configured"' "${response_body}" &&
		grep -Fq 'https://fa.rezics.com/fontawesome/7.2.0/css/rezics.min.css' \
			"${response_body}"
}

probe_override_version() {
	local expected_version="$1"
	local observed_version=""
	: >"${response_headers}"
	: >"${response_body}"
	curl --fail --silent --show-error \
		--connect-timeout 5 --max-time 30 \
		--header "Cloudflare-Workers-Version-Overrides: ${worker_name}=\"${expected_version}\"" \
		--header 'X-Rezics-Deployment-Probe: 1' \
		--dump-header "${response_headers}" \
		--output "${response_body}" \
		"${worker_url}"
	observed_version="$({
		awk '
			BEGIN { IGNORECASE = 1 }
			/^x-rezics-worker-version:/ {
				sub(/^[^:]+:[[:space:]]*/, "")
				sub(/\r$/, "")
				value = $0
			}
			END { print value }
		' "${response_headers}"
	})"
	if [[ "${observed_version}" == "${expected_version}" ]] &&
		grep -Fq 'data-font-awesome="configured"' "${response_body}" &&
		grep -Fq 'https://fa.rezics.com/fontawesome/7.2.0/css/rezics.min.css' \
			"${response_body}"; then
		return 0
	fi
	printf 'Version override returned %s instead of verified version %s\n' \
		"${observed_version:-no version header}" "${expected_version}" >&2
	return 1
}

record_result() {
	local worker_version="$1"
	local result_directory
	local temporary_result
	[[ -n "${result_file}" ]] || return 0
	result_directory="$(dirname "${result_file}")"
	if [[ ! -d "${result_directory}" || ! -w "${result_directory}" ]]; then
		printf 'Worker result directory is not writable: %s\n' \
			"${result_directory}" >&2
		return 1
	fi
	temporary_result="$(mktemp "${result_file}.XXXXXX")"
	jq -n \
		--arg release "${release}" \
		--arg worker_version "${worker_version}" \
		'{
		  component: "web",
		  release: $release,
		  artifact: {workerVersion: $worker_version}
		}' >"${temporary_result}"
	chmod 0600 "${temporary_result}"
	mv "${temporary_result}" "${result_file}"
}

restore_previous_deployment() {
	local exit_status=$?
	if [[ "${deployment_changed}" == "true" && -n "${previous_version}" ]]; then
		printf 'Worker verification failed; restoring version %s\n' \
			"${previous_version}" >&2
		set +e
		yarn workspace @rezics/frontend exec wrangler versions deploy \
			"${previous_version}@100%" --yes \
			--config "${wrangler_config}" \
			--message "Automatic rollback after failed ${release} verification" >&2
		set -e
	fi
	rm -f "${wrangler_output}" "${response_headers}" "${response_body}"
	exit "${exit_status}"
}
trap restore_previous_deployment EXIT

cd "${repository_root}"

if ! deployment_status="$({
	yarn workspace @rezics/frontend exec wrangler deployments status \
		--config "${wrangler_config}" --json 2>/dev/null
})"; then
	WRANGLER_OUTPUT_FILE_PATH="${wrangler_output}" \
		yarn workspace @rezics/frontend exec wrangler deploy \
		--config "${wrangler_config}" \
		--tag "${release}" \
		--message "Initial REZICS Worker deployment ${release}" \
		--secrets-file "${worker_secrets_file}" \
		--strict
	deployment_status="$({
		yarn workspace @rezics/frontend exec wrangler deployments status \
			--config "${wrangler_config}" --json
	})"
	new_version="$({
		jq -er '
			if (.versions | length) == 1 and .versions[0].percentage == 100
			then .versions[0].version_id
			else error("initial Worker deployment must have exactly one version at 100%")
			end
		' <<<"${deployment_status}"
	})"
	sleep "${settle_seconds}"
	if ! probe_production_version "${new_version}"; then
		printf 'Initial Worker version %s did not pass the production probe\n' \
			"${new_version}" >&2
		exit 1
	fi
	record_result "${new_version}"
	printf 'Initial Worker version %s is serving 100%% of production traffic\n' \
		"${new_version}"
	exit 0
fi

WRANGLER_OUTPUT_FILE_PATH="${wrangler_output}" \
	yarn workspace @rezics/frontend exec wrangler versions upload \
	--config "${wrangler_config}" \
	--tag "${release}" \
	--message "REZICS ${release}" \
	--secrets-file "${worker_secrets_file}" \
	--strict

new_version="$({
	jq -rs -er \
		'[.[] | select(.type == "version-upload")][-1].version_id | strings' \
		"${wrangler_output}"
})"
readonly new_version

previous_version="$({
	jq -er '
		if (.versions | length) == 1 and .versions[0].percentage == 100
		then .versions[0].version_id
		else error("production Worker must have exactly one version at 100%")
		end
	' <<<"${deployment_status}"
})"
readonly previous_version

if [[ "${new_version}" == "${previous_version}" ]]; then
	printf '%s\n' "Uploaded Worker version is already serving 100% of traffic"
	deployment_changed=false
	record_result "${new_version}"
	exit 0
fi

deployment_changed=true
yarn workspace @rezics/frontend exec wrangler versions deploy \
	"${previous_version}@100%" "${new_version}@0%" \
	--yes --config "${wrangler_config}" \
	--message "Stage ${release} for version-override verification"

yarn workspace @rezics/frontend exec wrangler triggers deploy \
	--config "${wrangler_config}"

sleep "${settle_seconds}"
if ! probe_override_version "${new_version}"; then
	exit 1
fi

yarn workspace @rezics/frontend exec wrangler versions deploy \
	"${new_version}@100%" --yes --config "${wrangler_config}" \
	--message "Promote verified ${release}"

sleep "${settle_seconds}"
if ! probe_production_version "${new_version}"; then
	printf 'Promoted Worker version %s did not pass the production probe\n' \
		"${new_version}" >&2
	exit 1
fi

deployment_changed=false
record_result "${new_version}"
printf 'Worker version %s is serving 100%% of production traffic\n' "${new_version}"
