#!/usr/bin/env bash

set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly repository_root
empty_state="$(mktemp)"
matching_state="$(mktemp)"
first_plan="$(mktemp)"
second_plan="$(mktemp)"
maintenance_plan="$(mktemp)"
ordinary_plan="$(mktemp)"
readonly empty_state matching_state first_plan second_plan maintenance_plan ordinary_plan
trap 'rm -f "${empty_state}" "${matching_state}" "${first_plan}" "${second_plan}" "${maintenance_plan}" "${ordinary_plan}"' EXIT

printf '%s\n' '{}' >"${empty_state}"
"${repository_root}/deploy/scripts/plan-release-components.sh" \
	"${empty_state}" >"${first_plan}"

jq -e '
	.schemaVersion == 1 and
	.maintenanceRequired == false and
	([.components[].name] == ["database", "api", "worker", "projection"]) and
	([.components[] | select(.changed)] | length == 4) and
	(.changed == ["database", "api", "worker", "projection"])
' "${first_plan}" >/dev/null

jq '{
	schemaVersion: 2,
	components: (.components | map({
		key: .name,
		value: {inputHash: .inputHash}
	}) | from_entries)
}' "${first_plan}" >"${matching_state}"

"${repository_root}/deploy/scripts/plan-release-components.sh" \
	"${matching_state}" >"${second_plan}"
jq -e '
	(.changed | length == 0) and
	all(.components[]; .changed == false and .previousInputHash == .inputHash)
' "${second_plan}" >/dev/null

"${repository_root}/deploy/scripts/plan-release-components.sh" \
	"${matching_state}" v1.3.0 >"${maintenance_plan}"
jq -e '.maintenanceRequired == true' "${maintenance_plan}" >/dev/null

"${repository_root}/deploy/scripts/plan-release-components.sh" \
	"${matching_state}" v1.3.1 >"${ordinary_plan}"
jq -e '.maintenanceRequired == false' "${ordinary_plan}" >/dev/null

printf '%s\n' 'Validated deterministic component and maintenance-cutover planning'
