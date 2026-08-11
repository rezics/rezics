#!/usr/bin/env bash

set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly repository_root
readonly compose_project="rezics-check-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"

cleanup() {
	local exit_status=$?
	set +e
	cd "${repository_root}"
	COMPOSE_PROJECT_NAME="${compose_project}" \
		docker compose --profile migration-test down \
		--timeout 30 --remove-orphans --volumes >/dev/null 2>&1
	exit "${exit_status}"
}
trap cleanup EXIT INT TERM

cd "${repository_root}"
export COMPOSE_PROJECT_NAME="${compose_project}"

bash deploy/scripts/check-released-migration-history.sh
yarn install --immutable
task apps-web:offline:check
task apps-web:cloudflare:typegen:check
task format:check
task counts:check
bash deploy/scripts/check-release-component-plan.sh
bash deploy/scripts/check-docker-build-context-contracts.sh
bash deploy/scripts/check-nomad-job-apply-contracts.sh
bash deploy/scripts/check-nomad-variable-templates.sh
bash deploy/scripts/check-postgres-nomad-contracts.sh
task db:check
task infra:up
task seed:contract
task openapi:check
task typecheck
task test
task aspire-apphost:smoke
task apps-web:build
task apps-about:build
task apps-about:test:dist
