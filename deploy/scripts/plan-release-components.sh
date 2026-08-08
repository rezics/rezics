#!/usr/bin/env bash

set -euo pipefail

if (($# < 1 || $# > 2)); then
	printf '%s\n' \
		"Usage: plan-release-components.sh <component-state.json> [release]" >&2
	exit 64
fi

readonly state_file="$1"
readonly release="${2:-}"
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly repository_root
readonly manifest_file="${repository_root}/deploy/release/components.json"

cd "${repository_root}"

jq -e '
	.schemaVersion == 1 and
	(.maintenanceCutovers | type == "array") and
	([.maintenanceCutovers[]] | unique | length) == (.maintenanceCutovers | length) and
	all(.maintenanceCutovers[];
		type == "string" and test("^v[0-9]+\\.[0-9]+\\.[0-9]+$")) and
	(.components | type == "object" and length > 0) and
	all(.components[];
		(.order | type == "number") and
		(.inputs | type == "array" and length > 0) and
		all(.inputs[]; type == "string" and length > 0))
' "${manifest_file}" >/dev/null

if [[ -n "${release}" && ! "${release}" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
	printf 'Release identity is malformed: %s\n' "${release}" >&2
	exit 64
fi

if [[ -s "${state_file}" ]]; then
	jq -e 'type == "object"' "${state_file}" >/dev/null
	state_json="$(<"${state_file}")"
else
	state_json='{}'
fi
readonly state_json
commit="$(git rev-parse 'HEAD^{commit}')"
readonly commit
components_file="$(mktemp)"
readonly components_file
trap 'rm -f "${components_file}"' EXIT

while IFS= read -r component; do
	mapfile -t inputs < <(
		jq -r --arg component "${component}" \
			'.components[$component].inputs[]' "${manifest_file}"
	)
	if ((${#inputs[@]} == 0)); then
		printf 'Release component %s has no inputs\n' "${component}" >&2
		exit 1
	fi

	# Diff the immutable commit against Git's canonical empty tree so include and
	# exclude pathspecs produce a complete, worktree-independent blob manifest.
	input_hash="$({
		printf 'rezics-component-v1\0%s\0' "${component}"
		git diff-tree --no-commit-id --raw -r -z --no-renames --abbrev=40 \
			4b825dc642cb6eb9a060e54bf8d69288fbee4904 "${commit}" -- \
			"${inputs[@]}"
	} | sha256sum | cut -d' ' -f1)"
	if [[ ! "${input_hash}" =~ ^[0-9a-f]{64}$ ]]; then
		printf 'Could not calculate input hash for %s\n' "${component}" >&2
		exit 1
	fi
	previous_hash="$(
		jq -r --arg component "${component}" \
			'.components[$component].inputHash // empty' <<<"${state_json}"
	)"
	order="$(jq -er --arg component "${component}" \
		'.components[$component].order' "${manifest_file}")"
	changed=true
	if [[ "${previous_hash}" == "${input_hash}" ]]; then
		changed=false
	fi

	jq -cn \
		--arg name "${component}" \
		--arg input_hash "${input_hash}" \
		--arg previous_hash "${previous_hash}" \
		--argjson order "${order}" \
		--argjson changed "${changed}" \
		'{
		  name: $name,
		  order: $order,
		  inputHash: $input_hash,
		  previousInputHash: (if $previous_hash == "" then null else $previous_hash end),
		  changed: $changed
		}' >>"${components_file}"
done < <(jq -r '.components | keys[]' "${manifest_file}")

jq -s \
	--arg commit "${commit}" \
	--arg release "${release}" \
	--slurpfile manifest "${manifest_file}" \
	'sort_by(.order) as $components | {
	  schemaVersion: 1,
	  commit: $commit,
	  maintenanceRequired: (
	    $release != "" and ($manifest[0].maintenanceCutovers | index($release)) != null
	  ),
	  components: $components,
	  changed: ([$components[] | select(.changed) | .name])
	}' "${components_file}"
