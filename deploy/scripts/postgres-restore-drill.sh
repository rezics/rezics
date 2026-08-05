#!/usr/bin/env bash

set -euo pipefail
umask 077
readonly drill_started_epoch="$(date +%s)"

for variable in RESTORE_DATABASE_URL R2_ENDPOINT R2_BUCKET R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY; do
	if [[ -z "${!variable:-}" ]]; then
		printf '%s is required\n' "${variable}" >&2
		exit 64
	fi
done
if [[ "${RESTORE_DATABASE_URL}" != *"/rezics_restore_drill"* ]]; then
	printf '%s\n' "RESTORE_DATABASE_URL must target the disposable rezics_restore_drill database" >&2
	exit 64
fi
readonly restore_jobs="${RESTORE_JOBS:-2}"
if [[ ! "${restore_jobs}" =~ ^[1-9][0-9]*$ ]] || ((restore_jobs > 8)); then
	printf '%s\n' "RESTORE_JOBS must be an integer between 1 and 8" >&2
	exit 64
fi

export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
export AWS_DEFAULT_REGION=auto
completion_key="$(aws s3api list-objects-v2 \
	--endpoint-url "${R2_ENDPOINT}" --bucket "${R2_BUCKET}" --prefix postgresql/ \
	| jq -er '[.Contents[]? | select(.Key | endswith("/COMPLETED.json"))]
	  | sort_by(.LastModified) | last | .Key')"
readonly completion_key
readonly remote_prefix="${completion_key%/COMPLETED.json}"
readonly staging_root="${RESTORE_STAGING_ROOT:-/alloc/data}"
staging_directory="$(mktemp -d "${staging_root%/}/postgres-restore.XXXXXX")"
readonly staging_directory
cleanup() {
	local status=$?
	rm -rf "${staging_directory}"
	exit "${status}"
}
trap cleanup EXIT

aws s3 cp "s3://${R2_BUCKET}/${remote_prefix}/" "${staging_directory}/" \
	--endpoint-url "${R2_ENDPOINT}" --recursive --no-progress >/dev/null
readonly expected_manifest_hash="$(jq -er '.manifestSha256' "${staging_directory}/COMPLETED.json")"
readonly expected_object_count="$(jq -er '.objectCount | select(type == "number" and . >= 1)' \
	"${staging_directory}/COMPLETED.json")"
readonly downloaded_object_count="$(find "${staging_directory}" -type f ! -name COMPLETED.json \
	| wc -l | tr -d ' ')"
if [[ "${downloaded_object_count}" != "${expected_object_count}" ]]; then
	printf '%s\n' "Downloaded object count does not match the completion marker" >&2
	exit 1
fi
readonly actual_manifest_hash="$(sha256sum "${staging_directory}/SHA256SUMS" | cut -d' ' -f1)"
if [[ "${actual_manifest_hash}" != "${expected_manifest_hash}" ]]; then
	printf '%s\n' "Completion marker does not match the downloaded manifest" >&2
	exit 1
fi
(
	cd "${staging_directory}"
	sha256sum --check --quiet --strict SHA256SUMS
)
readonly completion_backup_id="$(jq -er '.backupId' "${staging_directory}/COMPLETED.json")"
readonly metadata_backup_id="$(jq -er '.backupId' "${staging_directory}/metadata.json")"
if [[ "${completion_backup_id}" != "${metadata_backup_id}" \
	|| "${remote_prefix##*/}" != "${metadata_backup_id}" ]]; then
	printf '%s\n' "Backup identity does not match its immutable R2 prefix" >&2
	exit 1
fi
readonly archive_server_major="$(jq -er '.serverVersion | split(".")[0]' \
	"${staging_directory}/metadata.json")"
if [[ "${archive_server_major}" != "18" || "$(pg_restore --version)" != pg_restore\ \(PostgreSQL\)\ 18.* ]]; then
	printf '%s\n' "PostgreSQL 18 archive and restore client are required" >&2
	exit 1
fi
pg_restore --list "${staging_directory}/archive" >"${staging_directory}/restore.toc"
cp "${staging_directory}/restore.toc" "${staging_directory}/restore-without-pgroonga.toc"
readonly excluded_indexes="$(grep -Ec 'INDEX .* (unit_localization_pgroonga_metadata_idx|unit_localization_pgroonga_content_idx) ' "${staging_directory}/restore.toc")"
if [[ "${excluded_indexes}" != "2" ]]; then
	printf 'Expected exactly two canonical PGroonga indexes in the archive TOC; found %s\n' \
		"${excluded_indexes}" >&2
	exit 1
fi
sed -Ei '/INDEX .* (unit_localization_pgroonga_metadata_idx|unit_localization_pgroonga_content_idx) /d' \
	"${staging_directory}/restore-without-pgroonga.toc"

for attempt in $(seq 1 60); do
	pg_isready -d "${RESTORE_DATABASE_URL}" >/dev/null 2>&1 && break
	if [[ "${attempt}" == "60" ]]; then
		printf '%s\n' "Disposable PostgreSQL did not become ready" >&2
		exit 1
	fi
	sleep 2
done
pg_restore "${staging_directory}/archive" \
	--dbname="${RESTORE_DATABASE_URL}" \
	--use-list="${staging_directory}/restore-without-pgroonga.toc" \
	--jobs="${restore_jobs}" \
	--exit-on-error \
	--no-owner \
	--no-privileges
psql "${RESTORE_DATABASE_URL}" -X --set ON_ERROR_STOP=1 \
	--file=/opt/rezics/pgroonga-indexes.sql
psql "${RESTORE_DATABASE_URL}" -X --set ON_ERROR_STOP=1 <<'SQL'
ANALYZE;
DO $verify$
BEGIN
  IF (SELECT count(*) FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
      WHERE c.relname IN ('unit_localization_pgroonga_metadata_idx',
                          'unit_localization_pgroonga_content_idx')
        AND i.indisvalid AND i.indisready) <> 2 THEN
    RAISE EXCEPTION 'canonical PGroonga indexes are not ready';
  END IF;
  IF (SELECT extversion FROM pg_extension WHERE extname = 'pgroonga') <> '4.0.8' THEN
    RAISE EXCEPTION 'unexpected PGroonga version';
  END IF;
END
$verify$;
SELECT count(*) AS unit_localization_rows FROM public.unit_localization;
SQL
psql "${RESTORE_DATABASE_URL}" -XAt --set ON_ERROR_STOP=1 >"${staging_directory}/restored-search-parity.json" <<'SQL'
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
if ! cmp --silent "${staging_directory}/search-parity.json" \
	"${staging_directory}/restored-search-parity.json"; then
	printf '%s\n' "Restored PGroonga search results do not match the backup fixture" >&2
	exit 1
fi
readonly downloaded_bytes="$(du -sb "${staging_directory}" | cut -f1)"
readonly elapsed_seconds="$(( $(date +%s) - drill_started_epoch ))"
printf 'Complete isolated restore drill passed for %s (%s downloaded bytes, %ss)\n' \
	"${remote_prefix}" "${downloaded_bytes}" "${elapsed_seconds}"
