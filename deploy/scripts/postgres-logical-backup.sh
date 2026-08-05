#!/usr/bin/env bash

set -euo pipefail
umask 077

for variable in DATABASE_URL R2_ENDPOINT R2_BUCKET R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY; do
	if [[ -z "${!variable:-}" ]]; then
		printf '%s is required\n' "${variable}" >&2
		exit 64
	fi
done

readonly backup_jobs="${BACKUP_JOBS:-2}"
if [[ ! "${backup_jobs}" =~ ^[1-9][0-9]*$ ]] || ((backup_jobs > 8)); then
	printf '%s\n' "BACKUP_JOBS must be an integer between 1 and 8" >&2
	exit 64
fi

readonly started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
readonly started_epoch="$(date +%s)"
readonly day_of_month="$(date -u +%d)"
readonly day_of_week="$(date -u +%u)"
if [[ "${day_of_month}" == "01" ]]; then
	readonly tier="monthly"
elif [[ "${day_of_week}" == "7" ]]; then
	readonly tier="weekly"
else
	readonly tier="daily"
fi
readonly backup_id="$(date -u +%Y%m%dT%H%M%SZ)-${NOMAD_ALLOC_ID:-manual}"
readonly remote_prefix="postgresql/${tier}/${backup_id}"
readonly staging_root="${BACKUP_STAGING_ROOT:-/alloc/data}"
staging_directory="$(mktemp -d "${staging_root%/}/postgres-backup.XXXXXX")"
readonly staging_directory
readonly archive_directory="${staging_directory}/archive"
cleanup() {
	local status=$?
	if ((status == 0)); then
		rm -rf "${staging_directory}"
	else
		printf 'Backup failed; private staging retained at %s\n' "${staging_directory}" >&2
	fi
	exit "${status}"
}
trap cleanup EXIT

readonly client_major="$(pg_dump --version | sed -E 's/.* ([0-9]+)(\..*)?/\1/')"
readonly server_version="$(psql "${DATABASE_URL}" -XAtc 'show server_version')"
if [[ "${client_major}" != "18" || "${server_version%%.*}" != "18" ]]; then
	printf 'PostgreSQL 18 client/server required; client=%s server=%s\n' \
		"${client_major}" "${server_version}" >&2
	exit 1
fi

pg_dump "${DATABASE_URL}" \
	--format=directory \
	--jobs="${backup_jobs}" \
	--file="${archive_directory}" \
	--verbose 2>"${staging_directory}/pg_dump.log"
if grep -Eiq '(^|:)[[:space:]]*(warning|error):' "${staging_directory}/pg_dump.log"; then
	printf '%s\n' "pg_dump emitted a warning or error; snapshot rejected" >&2
	exit 1
fi
pg_restore --list "${archive_directory}" >"${staging_directory}/archive.toc"
psql "${DATABASE_URL}" -XAt --set ON_ERROR_STOP=1 >"${staging_directory}/search-parity.json" <<'SQL'
WITH query(value) AS (
  VALUES ('the'), ('book'), ('的'), ('書'), ('本'), ('人'), ('銀河'), ('の'), ('は'), ('이'), ('책')
), result AS (
  SELECT query.value,
    coalesce(jsonb_agg(candidate.unit_id ORDER BY candidate.unit_id), '[]'::jsonb) AS unit_ids
  FROM query
  LEFT JOIN LATERAL (
    SELECT localization.unit_id
    FROM public.unit_localization localization
    JOIN public.unit authoritative ON authoritative.id = localization.unit_id
    WHERE authoritative.status = 'published'
      AND authoritative.visibility = 'public'
      AND authoritative.moderation_status = 'approved'
      AND authoritative.deleted_at IS NULL
      AND (
        public.current_search_metadata_v1(
          localization.title, localization.summary, localization.description
        ) &@~ query.value
        OR public.current_search_text_v1(localization.content) &@~ query.value
      )
    ORDER BY localization.unit_id
    LIMIT 101
  ) candidate ON true
  GROUP BY query.value
)
SELECT jsonb_agg(jsonb_build_object('query', value, 'unitIds', unit_ids) ORDER BY value)
FROM result;
SQL

readonly extension_versions="$(psql "${DATABASE_URL}" -XAtc \
	"select coalesce(jsonb_object_agg(extname, extversion), '{}'::jsonb) from pg_extension where extname in ('pgroonga','approx_count','pg_stat_statements','amcheck','pgstattuple')")"
readonly finished_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
readonly archive_bytes="$(du -sb "${archive_directory}" | cut -f1)"
jq -n \
	--arg backupId "${backup_id}" \
	--arg tier "${tier}" \
	--arg startedAt "${started_at}" \
	--arg finishedAt "${finished_at}" \
	--arg serverVersion "${server_version}" \
	--arg pgDumpVersion "$(pg_dump --version)" \
	--arg commit "${REZICS_COMMIT:-unknown}" \
	--argjson extensions "${extension_versions}" \
	--argjson archiveBytes "${archive_bytes}" \
	'{schemaVersion: 1, backupId: $backupId, tier: $tier, startedAt: $startedAt,
	  finishedAt: $finishedAt, serverVersion: $serverVersion, pgDumpVersion: $pgDumpVersion,
	  commit: $commit, extensions: $extensions, archiveBytes: $archiveBytes}' \
	>"${staging_directory}/metadata.json"

(
	cd "${staging_directory}"
	find archive -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum
	sha256sum archive.toc metadata.json search-parity.json
) >"${staging_directory}/SHA256SUMS"
readonly manifest_hash="$(sha256sum "${staging_directory}/SHA256SUMS" | cut -d' ' -f1)"
readonly object_count="$(find "${staging_directory}" -type f ! -name pg_dump.log | wc -l | tr -d ' ')"
readonly upload_bytes="$(find "${staging_directory}" -type f ! -name pg_dump.log -printf '%s\n' \
	| awk '{ total += $1 } END { print total + 0 }')"

export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
export AWS_DEFAULT_REGION=auto
while IFS= read -r -d '' path; do
	relative_path="${path#${staging_directory}/}"
	aws s3api put-object \
		--endpoint-url "${R2_ENDPOINT}" \
		--bucket "${R2_BUCKET}" \
		--key "${remote_prefix}/${relative_path}" \
		--body "${path}" \
		--if-none-match '*' >/dev/null
done < <(find "${staging_directory}" -type f ! -name pg_dump.log -print0 | LC_ALL=C sort -z)

remote_inventory="$(aws s3api list-objects-v2 \
	--endpoint-url "${R2_ENDPOINT}" --bucket "${R2_BUCKET}" --prefix "${remote_prefix}/")"
if [[ "$(jq '[.Contents[]?] | length' <<<"${remote_inventory}")" != "${object_count}" ]]; then
	printf '%s\n' "R2 inventory count does not match the upload candidate" >&2
	exit 1
fi
if [[ "$(jq '[.Contents[]?.Size] | add // 0' <<<"${remote_inventory}")" != "${upload_bytes}" ]]; then
	printf '%s\n' "R2 inventory size does not match the upload candidate" >&2
	exit 1
fi
jq -n --arg backupId "${backup_id}" --arg manifestSha256 "${manifest_hash}" \
	--argjson objectCount "${object_count}" --arg completedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
	'{schemaVersion: 1, backupId: $backupId, manifestSha256: $manifestSha256,
	  objectCount: $objectCount, completedAt: $completedAt}' \
	>"${staging_directory}/COMPLETED.json"
aws s3api put-object \
	--endpoint-url "${R2_ENDPOINT}" \
	--bucket "${R2_BUCKET}" \
	--key "${remote_prefix}/COMPLETED.json" \
	--body "${staging_directory}/COMPLETED.json" \
	--content-type application/json \
	--if-none-match '*' >/dev/null
aws s3api head-object --endpoint-url "${R2_ENDPOINT}" --bucket "${R2_BUCKET}" \
	--key "${remote_prefix}/COMPLETED.json" >/dev/null

printf 'Completed verified %s PostgreSQL logical backup %s (%s archive bytes, %s objects)\n' \
	"${tier}" "${backup_id}" "${archive_bytes}" "$((object_count + 1))"
