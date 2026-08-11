#!/usr/bin/env bash

set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly repository_root
readonly migration_directory='services/main/src/services/database/migrations'

cd "${repository_root}"

release_ref_name="${GITHUB_REF_NAME:-}"
readonly release_ref_name
if [[ "${GITHUB_REF_TYPE:-}" == tag ]] && \
	[[ ! "${release_ref_name}" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
	printf 'Server release tags must match vMAJOR.MINOR.PATCH exactly: %s\n' \
		"${release_ref_name:-<unset>}" >&2
	exit 1
fi

head_commit="$(git rev-parse --verify HEAD^{commit})"
readonly head_commit
baseline_tag=''
baseline_commit=''
root_tag_count=0

while IFS= read -r tag; do
	if [[ ! "${tag}" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
		continue
	fi
	root_tag_count=$((root_tag_count + 1))
	tag_commit="$(git rev-parse --verify "${tag}^{commit}")"
	if [[ "${tag_commit}" == "${head_commit}" ]]; then
		continue
	fi
	if git merge-base --is-ancestor "${tag_commit}" "${head_commit}"; then
		baseline_tag="${tag}"
		baseline_commit="${tag_commit}"
		break
	fi
done < <(git tag --list 'v*' --sort=-version:refname)

if ((root_tag_count == 0)); then
	printf '%s\n' \
		'No root vMAJOR.MINOR.PATCH tags are available; fetch release tags before checking migration history.' >&2
	exit 1
fi

if [[ -z "${baseline_tag}" ]]; then
	printf '%s\n' \
		'No prior root release tag is an ancestor of HEAD; released migration history cannot be established.' >&2
	exit 1
fi

released_count=0
latest_released_migration=''
declare -A released_migrations=()
while IFS= read -r migration; do
	if [[ "${migration}" != *.sql ]]; then
		continue
	fi
	released_count=$((released_count + 1))
	released_migrations["${migration}"]=1
	if [[ -z "${latest_released_migration}" || "${migration}" > "${latest_released_migration}" ]]; then
		latest_released_migration="${migration}"
	fi
	if [[ ! -f "${migration}" ]]; then
		printf 'Released migration from %s was deleted: %s\n' \
			"${baseline_tag}" "${migration}" >&2
		exit 1
	fi
	released_blob="$(git rev-parse --verify "${baseline_commit}:${migration}")"
	current_blob="$(git hash-object -- "${migration}")"
	if [[ "${released_blob}" != "${current_blob}" ]]; then
		printf 'Released migration from %s was modified: %s\n' \
			"${baseline_tag}" "${migration}" >&2
		printf '%s\n' 'Repair released databases with a new forward migration instead.' >&2
		exit 1
	fi
done < <(git ls-tree -r --name-only "${baseline_commit}" -- "${migration_directory}")

if ((released_count == 0)); then
	printf 'Root release %s contains no SQL migrations under %s\n' \
		"${baseline_tag}" "${migration_directory}" >&2
	exit 1
fi

while IFS= read -r migration; do
	if [[ -n "${released_migrations[${migration}]+present}" ]]; then
		continue
	fi
	if [[ "${migration}" < "${latest_released_migration}" ]]; then
		printf 'New migration was inserted before the %s release boundary: %s\n' \
			"${baseline_tag}" "${migration}" >&2
		printf 'New migrations must sort after %s\n' "${latest_released_migration}" >&2
		exit 1
	fi
done < <(find "${migration_directory}" -maxdepth 1 -type f -name '*.sql' -print | sort)

printf 'Validated %s released migrations against %s\n' \
	"${released_count}" "${baseline_tag}"
