#!/usr/bin/env bash

set -euo pipefail
umask 077

if (($# != 1)) || [[ "$1" != "--confirm-production" ]]; then
	printf '%s\n' "Usage: configure-production-meilisearch.sh --confirm-production" >&2
	exit 64
fi

if [[ "$(id -u)" != 0 ]]; then
	printf '%s\n' "Meilisearch credentials must be configured by a root operator" >&2
	exit 64
fi

readonly nomad_operator="${NOMAD_OPERATOR_BIN:-rezics-nomad-operator}"
readonly meilisearch_url="http://127.0.0.1:7700"
readonly current_index="rezics_units_v1_20260804"
readonly history_index="rezics_revisions_v1_20260804"
readonly runtime_directory="${REZICS_BOOTSTRAP_RUNTIME_DIRECTORY:-/run}"

for command in curl jq "${nomad_operator}"; do
	if ! command -v "${command}" >/dev/null 2>&1; then
		printf 'Required bootstrap command is unavailable: %s\n' "${command}" >&2
		exit 1
	fi
done

work_directory="$(mktemp -d "${runtime_directory}/rezics-meilisearch.XXXXXX")"
readonly work_directory
trap 'rm -rf "${work_directory}"' EXIT

master_key="$("${nomad_operator}" var get \
	-namespace=rezics-infrastructure \
	-item=MEILI_MASTER_KEY \
	nomad/jobs/rezics-meilisearch/meilisearch/meilisearch)"
if [[ -z "${master_key}" ]]; then
	printf '%s\n' "Meilisearch master key is missing" >&2
	exit 1
fi

curl_config="${work_directory}/meilisearch.curl"
printf 'header = "Authorization: Bearer %s"\nheader = "Content-Type: application/json"\n' \
	"${master_key}" >"${curl_config}"
unset master_key

create_or_validate_key() {
	local output_name="$1"
	local uid="$2"
	local name="$3"
	local actions="$4"
	local indexes="$5"
	local response="${work_directory}/${output_name}-response.json"
	local request="${work_directory}/${output_name}-request.json"
	local status

	status="$(curl --silent --show-error \
		--config "${curl_config}" \
		--output "${response}" \
		--write-out '%{http_code}' \
		"${meilisearch_url}/keys/${uid}")"
	if [[ "${status}" == 404 ]]; then
		jq -n \
			--arg uid "${uid}" \
			--arg name "${name}" \
			--argjson actions "${actions}" \
			--argjson indexes "${indexes}" \
			'{uid: $uid, name: $name, actions: $actions, indexes: $indexes, expiresAt: null}' \
			>"${request}"
		status="$(curl --silent --show-error \
			--config "${curl_config}" \
			--request POST \
			--data-binary "@${request}" \
			--output "${response}" \
			--write-out '%{http_code}' \
			"${meilisearch_url}/keys")"
	fi
	if [[ "${status}" != 200 && "${status}" != 201 ]]; then
		printf 'Meilisearch key %s returned HTTP %s\n' "${name}" "${status}" >&2
		exit 1
	fi
	jq -e \
		--arg uid "${uid}" \
		--argjson actions "${actions}" \
		--argjson indexes "${indexes}" '
		.uid == $uid and
		(.key | type == "string" and length >= 32) and
		(.actions | sort) == ($actions | sort) and
		(.indexes | sort) == ($indexes | sort) and
		.expiresAt == null
	' "${response}" >/dev/null
	jq -jr '.key' "${response}" >"${work_directory}/${output_name}.key"
}

create_or_validate_key \
	query 2df6c602-6e0d-4e5d-9f5a-204dc7bed768 \
	"REZICS production query" \
	'["search"]' \
	"[\"${current_index}\"]"
create_or_validate_key \
	reconciler 63663e28-9869-40d3-8a6e-23f7c915ff2a \
	"REZICS search lifecycle reconciler" \
	'["documents.get","indexes.*","settings.*","stats.get","tasks.get"]' \
	'["rezics_units_v*","rezics_revisions_v*"]'
create_or_validate_key \
	current-sink c2dd0f69-5294-4485-a4a6-4f54ab4a6a62 \
	"REZICS current projection sink" \
	'["documents.add","documents.delete","indexes.get","tasks.get"]' \
	"[\"${current_index}\"]"
create_or_validate_key \
	history-sink af8fa49c-8d48-4ec0-96d9-59f0fcf9a877 \
	"REZICS revision projection sink" \
	'["documents.add","documents.delete","indexes.get","tasks.get"]' \
	"[\"${history_index}\"]"

update_variable() {
	local namespace="$1"
	local path="$2"
	local transform="$3"
	local current="${work_directory}/$(tr '/' '-' <<<"${path}")-current.json"
	local updated="${work_directory}/$(tr '/' '-' <<<"${path}")-updated.json"

	"${nomad_operator}" var get -namespace="${namespace}" -out=json "${path}" >"${current}"
	jq \
		--rawfile queryKey "${work_directory}/query.key" \
		--rawfile reconcilerKey "${work_directory}/reconciler.key" \
		--rawfile currentSinkKey "${work_directory}/current-sink.key" \
		--rawfile historySinkKey "${work_directory}/history-sink.key" \
		"${transform}" "${current}" >"${updated}"
	"${nomad_operator}" var put -in=json - <"${updated}" >/dev/null
}

update_variable rezics application/runtime '
    .Items.MEILISEARCH_QUERY_KEY = $queryKey
'
update_variable rezics database/operations '
    .Items.MEILISEARCH_QUERY_KEY = $queryKey |
    .Items.MEILISEARCH_RECONCILER_KEY = $reconcilerKey
'
update_variable \
	rezics-infrastructure \
	nomad/jobs/rezics-sequin/sequin/sequin '
    .Items.MEILISEARCH_CURRENT_SINK_KEY = $currentSinkKey |
    .Items.MEILISEARCH_HISTORY_SINK_KEY = $historySinkKey
'

printf '%s\n' "Four least-privilege Meilisearch keys are reconciled into Nomad Variables"
