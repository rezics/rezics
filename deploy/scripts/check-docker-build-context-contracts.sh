#!/usr/bin/env bash

set -euo pipefail

readonly brand_dist_directory_exception='!packages/brand/dist/'
readonly brand_dist_content_exception='!packages/brand/dist/**'
readonly required_brand_asset='packages/brand/dist/avatar.png'
readonly postgres_init_copy='COPY --chmod=0755 services/main/docker/postgres/init /docker-entrypoint-initdb.d'
readonly api_stage='FROM backend-runtime AS api'
readonly worker_stage='FROM backend-runtime AS worker'

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

printf '%s\n' 'Validated Docker build-context contracts'
