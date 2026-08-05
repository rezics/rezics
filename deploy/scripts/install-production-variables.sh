#!/usr/bin/env bash

set -euo pipefail
umask 077

if (($# != 1)) || [[ "$1" != "--confirm-empty-variables" ]]; then
	printf '%s\n' \
		"Usage: install-production-variables.sh --confirm-empty-variables < production-credentials.json" >&2
	exit 64
fi
if [[ "$(id -u)" != 0 ]]; then
	printf '%s\n' "Production Variables must be installed by a root operator" >&2
	exit 1
fi

readonly nomad_operator="${NOMAD_OPERATOR_BIN:-rezics-nomad-operator}"
readonly runtime_directory="${REZICS_BOOTSTRAP_RUNTIME_DIRECTORY:-/run}"
readonly turnstile_secret_file="${TURNSTILE_SECRET_FILE:-/run/secrets/turnstile_secret_key}"
for command in aws jq openssl "${nomad_operator}"; do
	command -v "${command}" >/dev/null 2>&1 || {
		printf 'Required bootstrap command is unavailable: %s\n' "${command}" >&2
		exit 1
	}
done
if [[ ! -r "${turnstile_secret_file}" || ! -s "${turnstile_secret_file}" ]]; then
	printf 'Turnstile secret is unavailable: %s\n' "${turnstile_secret_file}" >&2
	exit 1
fi

readonly variables=(
	"rezics application/runtime"
	"rezics database/operations"
	"rezics-infrastructure nomad/jobs/rezics-postgres/postgres/postgres"
	"rezics-infrastructure database/backup-uploader"
	"rezics-infrastructure database/backup-reader"
)
for variable in "${variables[@]}"; do
	read -r namespace path <<<"${variable}"
	if "${nomad_operator}" var get -namespace="${namespace}" "${path}" >/dev/null 2>&1; then
		printf 'Refusing to replace an existing Nomad Variable: %s/%s\n' \
			"${namespace}" "${path}" >&2
		exit 1
	fi
done

work_directory="$(mktemp -d "${runtime_directory}/rezics-bootstrap.XXXXXX")"
readonly work_directory
readonly credentials_file="${work_directory}/production-credentials.json"
readonly variables_file="${work_directory}/variables.json"
readonly installed_file="${work_directory}/installed-variables"
bootstrap_complete=false
cleanup() {
	local status=$?
	if [[ "${bootstrap_complete}" != true && -s "${installed_file}" ]]; then
		while read -r namespace path; do
			"${nomad_operator}" var purge -namespace="${namespace}" "${path}" >/dev/null 2>&1 || true
		done <"${installed_file}"
	fi
	rm -rf "${work_directory}"
	exit "${status}"
}
trap cleanup EXIT
install -m 0600 /dev/stdin "${credentials_file}"
: >"${installed_file}"

jq -e '
  type == "object" and .schemaVersion == 1 and
  (.cloudflare | keys | sort) == ["accountId", "emailApiToken"] and
  (.r2 | keys | sort) == ["application", "backupReader", "backupUploader", "endpoint"] and
  (.r2.application | keys | sort) == ["accessKeyId", "bucket", "secretAccessKey"] and
  (.r2.backupReader | keys | sort) == ["accessKeyId", "bucket", "secretAccessKey"] and
  (.r2.backupUploader | keys | sort) == ["accessKeyId", "bucket", "secretAccessKey"] and
  .r2.application.bucket != .r2.backupUploader.bucket and
  .r2.backupReader.bucket == .r2.backupUploader.bucket and
  (.r2.endpoint | startswith("https://"))
' "${credentials_file}" >/dev/null

readonly r2_endpoint="$(jq -er '.r2.endpoint' "${credentials_file}")"
for workload in application backupUploader backupReader; do
	access_key_id="$(jq -er --arg workload "${workload}" '.r2[$workload].accessKeyId' "${credentials_file}")"
	secret_access_key="$(jq -er --arg workload "${workload}" '.r2[$workload].secretAccessKey' "${credentials_file}")"
	bucket="$(jq -er --arg workload "${workload}" '.r2[$workload].bucket' "${credentials_file}")"
	AWS_ACCESS_KEY_ID="${access_key_id}" AWS_SECRET_ACCESS_KEY="${secret_access_key}" \
		AWS_DEFAULT_REGION=auto aws s3api head-bucket \
		--endpoint-url "${r2_endpoint}" --bucket "${bucket}" >/dev/null
done
unset access_key_id secret_access_key bucket

printf 'u%s\n' "$(openssl rand -hex 10 | cut -c 1-19)" >"${work_directory}/postgres-username"
printf 'u%s\n' "$(openssl rand -hex 10 | cut -c 1-19)" >"${work_directory}/application-database-username"
openssl rand -hex 32 >"${work_directory}/postgres-password"
openssl rand -hex 32 >"${work_directory}/application-database-password"
openssl rand -hex 32 >"${work_directory}/better-auth-secret"

jq -n \
	--slurpfile external "${credentials_file}" \
	--rawfile turnstileSecret "${turnstile_secret_file}" \
	--rawfile postgresUsername "${work_directory}/postgres-username" \
	--rawfile applicationDatabaseUsername "${work_directory}/application-database-username" \
	--rawfile postgresPassword "${work_directory}/postgres-password" \
	--rawfile applicationDatabasePassword "${work_directory}/application-database-password" \
	--rawfile betterAuthSecret "${work_directory}/better-auth-secret" '
  def value: rtrimstr("\n");
  ($external[0]) as $external |
  ($postgresUsername | value) as $postgresUsername |
  ($applicationDatabaseUsername | value) as $applicationDatabaseUsername |
  ($postgresPassword | value) as $postgresPassword |
  ($applicationDatabasePassword | value) as $applicationDatabasePassword |
  {
    DATABASE_URL: ("postgres://" + $applicationDatabaseUsername + ":" + $applicationDatabasePassword + "@127.0.0.1:5432/rezics?sslmode=disable"),
    BETTER_AUTH_SECRET: ($betterAuthSecret | value),
    BETTER_AUTH_URL: "https://www.rezics.com",
    BETTER_AUTH_TRUSTED_ORIGINS: "https://www.rezics.com",
    TURNSTILE_SECRET_KEY: ($turnstileSecret | value),
    TURNSTILE_ALLOWED_HOSTNAMES: "www.rezics.com,rezics.com",
    EMAIL_MODE: "cloudflare",
    EMAIL_FROM: "no-reply@rezics.com",
    EMAIL_FROM_NAME: "REZICS",
    CLOUDFLARE_ACCOUNT_ID: $external.cloudflare.accountId,
    CLOUDFLARE_EMAIL_API_TOKEN: $external.cloudflare.emailApiToken,
    S3_ENDPOINT: $external.r2.endpoint,
    S3_REGION: "auto",
    S3_ACCESS_KEY_ID: $external.r2.application.accessKeyId,
    S3_SECRET_ACCESS_KEY: $external.r2.application.secretAccessKey,
    S3_BUCKET: $external.r2.application.bucket,
    S3_FORCE_PATH_STYLE: "false",
    S3_PRESIGN_EXPIRES_IN: "900",
    SEARCH_STATEMENT_TIMEOUT_MS: "1500",
    SEARCH_CANDIDATE_SCAN_LIMIT: "512",
    SEARCH_FACET_SCAN_LIMIT: "1000",
    RECOMMENDATION_REFRESH_INTERVAL_MS: "300000"
  } as $applicationRuntime |
  ($applicationRuntime + {
    DATABASE_ADMIN_URL: ("postgres://" + $postgresUsername + ":" + $postgresPassword + "@127.0.0.1:5432/rezics?sslmode=disable")
  }) as $databaseOperations |
  {
    variables: [
      {Namespace: "rezics", Path: "application/runtime", Items: $applicationRuntime},
      {Namespace: "rezics", Path: "database/operations", Items: $databaseOperations},
      {
        Namespace: "rezics-infrastructure",
        Path: "nomad/jobs/rezics-postgres/postgres/postgres",
        Items: {
          POSTGRES_USER: $postgresUsername,
          POSTGRES_PASSWORD: $postgresPassword,
          REZICS_DATABASE_USERNAME: $applicationDatabaseUsername,
          REZICS_DATABASE_PASSWORD: $applicationDatabasePassword
        }
      },
      {
        Namespace: "rezics-infrastructure",
        Path: "database/backup-uploader",
        Items: {
          DATABASE_URL: ("postgres://" + $postgresUsername + ":" + $postgresPassword + "@127.0.0.1:5432/rezics?sslmode=disable"),
          R2_ENDPOINT: $external.r2.endpoint,
          R2_BUCKET: $external.r2.backupUploader.bucket,
          R2_ACCESS_KEY_ID: $external.r2.backupUploader.accessKeyId,
          R2_SECRET_ACCESS_KEY: $external.r2.backupUploader.secretAccessKey
        }
      },
      {
        Namespace: "rezics-infrastructure",
        Path: "database/backup-reader",
        Items: {
          R2_ENDPOINT: $external.r2.endpoint,
          R2_BUCKET: $external.r2.backupReader.bucket,
          R2_ACCESS_KEY_ID: $external.r2.backupReader.accessKeyId,
          R2_SECRET_ACCESS_KEY: $external.r2.backupReader.secretAccessKey
        }
      }
    ]
  }
' >"${variables_file}"

while IFS=$'\t' read -r namespace path items; do
	printf '%s' "${items}" | "${nomad_operator}" var put -namespace="${namespace}" -in=json "${path}" - >/dev/null
	printf '%s %s\n' "${namespace}" "${path}" >>"${installed_file}"
done < <(jq -rc '.variables[] | [.Namespace, .Path, (.Items | tojson)] | @tsv' "${variables_file}")

bootstrap_complete=true
printf '%s\n' "Installed production runtime, PostgreSQL, and independently scoped backup Variables"
