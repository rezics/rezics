#!/usr/bin/env bash
set -euo pipefail

service_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly service_root

exec yarn --cwd "${service_root}" exec tsx scripts/generate-database-migration.ts "$@"
