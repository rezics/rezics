#!/usr/bin/env bash

set -euo pipefail

readonly brand_dist_directory_exception='!packages/brand/dist/'
readonly brand_dist_content_exception='!packages/brand/dist/**'
readonly required_brand_asset='packages/brand/dist/avatar.png'
readonly postgres_init_copy='COPY --chmod=0755 services/main/docker/postgres/init /docker-entrypoint-initdb.d'
readonly api_stage='FROM ${BUN_IMAGE} AS api'
readonly worker_stage='FROM ${BUN_IMAGE} AS worker'
readonly api_binary_command='CMD ["/usr/local/bin/bun-modern", "/app/rezics-api.js"]'
readonly worker_binary_command='CMD ["/app/rezics-worker"]'
readonly compile_flag='--compile'
readonly bun_bundle_target='--target=bun'

for exception in \
	"${brand_dist_directory_exception}" \
	"${brand_dist_content_exception}"; do
	if ! grep -Fxq "${exception}" .dockerignore; then
		printf 'Docker build context is missing required exception: %s\n' \
			"${exception}" >&2
		exit 1
	fi
done

if [[ ! -s "${required_brand_asset}" ]] ||
	! git ls-files --error-unmatch "${required_brand_asset}" >/dev/null 2>&1; then
	printf 'Required brand bootstrap asset is missing or untracked: %s\n' \
		"${required_brand_asset}" >&2
	exit 1
fi

for dockerfile_contract in "${postgres_init_copy}"; do
	if ! grep -Fxq "${dockerfile_contract}" Dockerfile; then
		printf 'Dockerfile is missing required copy-mode contract: %s\n' \
			"${dockerfile_contract}" >&2
		exit 1
	fi
done

for runtime_stage in "${api_stage}" "${worker_stage}"; do
	if ! grep -Fxq "${runtime_stage}" Dockerfile; then
		printf 'Dockerfile is missing independent runtime stage: %s\n' \
			"${runtime_stage}" >&2
		exit 1
	fi
done

for binary_command in "${api_binary_command}" "${worker_binary_command}"; do
	if ! grep -Fxq "${binary_command}" Dockerfile; then
		printf 'Dockerfile is missing compiled runtime command: %s\n' \
			"${binary_command}" >&2
		exit 1
	fi
done

if [[ "$(grep -Fc -- "${compile_flag}" Dockerfile)" -ne 1 ]]; then
	printf 'Dockerfile must compile exactly the worker entrypoint\n' >&2
	exit 1
fi

if [[ "$(grep -Fc -- "${bun_bundle_target}" Dockerfile)" -ne 1 ]]; then
	printf 'Dockerfile must produce exactly one Bun-targeted API bundle\n' >&2
	exit 1
fi

printf '%s\n' 'Validated Docker build-context contracts'
