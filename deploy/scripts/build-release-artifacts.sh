#!/usr/bin/env bash

set -euo pipefail
umask 077

if (($# != 4)); then
	printf '%s\n' \
		"Usage: build-release-artifacts.sh <release> <commit> <database,api,worker> <result.json>" >&2
	exit 64
fi

readonly release="$1"
readonly commit="$2"
readonly requested_components="$3"
readonly result_file="$4"
repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly repository_root
readonly artifacts_directory="${repository_root}/.rezics-release-artifacts"

if [[ ! "${release}" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] ||
	[[ ! "${commit}" =~ ^[0-9a-f]{40}$ ]] ||
	[[ ! "${requested_components}" =~ ^(database|api|worker)(,(database|api|worker))*$ ]]; then
	printf '%s\n' "Release build identity is malformed" >&2
	exit 64
fi

cd "${repository_root}"
if [[ "$(git rev-parse 'HEAD^{commit}')" != "${commit}" ]] ||
	[[ "$(git rev-parse "refs/tags/${release}^{commit}")" != "${commit}" ]]; then
	printf '%s\n' "Build workspace does not match the dispatched release" >&2
	exit 1
fi

build_image() {
	local target="$1"
	local archive="${artifacts_directory}/${target}.docker.tar"
	local image="rezics-release-${target}:${commit}"
	rm -f "${archive}"
	if ! docker buildx build \
		--target "${target}" \
		--label "org.opencontainers.image.revision=${commit}" \
		--label "org.opencontainers.image.version=${release}" \
		--tag "${image}" \
		--load . >&2; then
		docker image rm --force "${image}" >/dev/null 2>&1 || true
		return 1
	fi
	if [[ "$(docker image inspect --format \
		'{{ index .Config.Labels "org.opencontainers.image.revision" }}' \
		"${image}")" != "${commit}" ]] ||
		[[ "$(docker image inspect --format \
			'{{ index .Config.Labels "org.opencontainers.image.version" }}' \
			"${image}")" != "${release}" ]]; then
		printf 'Built image identity does not match %s at %s\n' \
			"${release}" "${commit}" >&2
		docker image rm --force "${image}" >/dev/null 2>&1 || true
		exit 1
	fi
	if ! docker image save --output "${archive}" "${image}"; then
		docker image rm --force "${image}" >/dev/null 2>&1 || true
		return 1
	fi
	docker image rm "${image}" >/dev/null
	if [[ ! -s "${archive}" ]]; then
		printf 'Build did not produce a Docker image archive for %s\n' "${target}" >&2
		exit 1
	fi
	printf '%s\n' "${archive}"
}

install -d -m 0700 "${artifacts_directory}"
temporary_result="$(mktemp "${result_file}.XXXXXX")"
readonly temporary_result
cleanup() {
	rm -f "${temporary_result}"
}
trap cleanup EXIT
jq -n --arg release "${release}" --arg commit "${commit}" \
	'{schemaVersion: 1, release: $release, commit: $commit, artifacts: {}}' \
	>"${temporary_result}"

IFS=',' read -r -a components <<<"${requested_components}"
declare -A seen=()
for component in "${components[@]}"; do
	if [[ -v "seen[${component}]" ]]; then
		printf 'Release build component is duplicated: %s\n' "${component}" >&2
		exit 64
	fi
	seen["${component}"]=1
	case "${component}" in
		database | api | worker)
			archive="$(build_image "${component}")"
			jq --arg component "${component}" --arg archive "${archive}" \
				'.artifacts[$component] = {dockerArchive: $archive}' \
				"${temporary_result}" >"${temporary_result}.next"
			mv "${temporary_result}.next" "${temporary_result}"
			;;
	esac
done

result_directory="$(dirname "${result_file}")"
readonly result_directory
if [[ ! -d "${result_directory}" || ! -w "${result_directory}" ]]; then
	printf 'Release build result directory is not writable: %s\n' \
		"${result_directory}" >&2
	exit 1
fi
chmod 0600 "${temporary_result}"
mv "${temporary_result}" "${result_file}"
trap - EXIT
printf 'Built release artifacts for %s\n' "${requested_components}"
