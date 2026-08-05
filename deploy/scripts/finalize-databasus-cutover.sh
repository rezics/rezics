#!/usr/bin/env bash

set -euo pipefail

if (($# != 1)) || [[ "$1" != "--confirm-verified-managed-backup" ]]; then
	printf '%s\n' \
		"Usage: finalize-databasus-cutover.sh --confirm-verified-managed-backup" >&2
	exit 64
fi

readonly nomad_command="${NOMAD_BIN:-nomad}"
readonly namespace="rezics-infrastructure"

for job in rezics-databasus rezics-databasus-verification-agent; do
	if ! "${nomad_command}" job inspect -namespace="${namespace}" -json "${job}" \
		>/dev/null 2>&1; then
		printf 'Required managed-backup job is not installed: %s\n' "${job}" >&2
		exit 1
	fi
done

for legacy_job in rezics-postgres-backup rezics-postgres-restore-drill; do
	if "${nomad_command}" job inspect -namespace="${namespace}" -json "${legacy_job}" \
		>/dev/null 2>&1; then
		printf 'Purging superseded custom backup job %s\n' "${legacy_job}"
		"${nomad_command}" job stop -namespace="${namespace}" -no-color -purge "${legacy_job}"
	fi
done

for legacy_variable in database/backup-uploader database/backup-reader; do
	if "${nomad_command}" var get -namespace="${namespace}" "${legacy_variable}" \
		>/dev/null 2>&1; then
		printf 'Purging superseded custom backup Variable %s\n' "${legacy_variable}"
		"${nomad_command}" var purge -namespace="${namespace}" -no-color "${legacy_variable}"
	fi
done

printf '%s\n' "Finalized Databasus cutover and purged superseded backup state"
