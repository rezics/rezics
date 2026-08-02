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
	exit 64
fi

readonly nomad_operator="${NOMAD_OPERATOR_BIN:-rezics-nomad-operator}"
readonly runtime_directory="${REZICS_BOOTSTRAP_RUNTIME_DIRECTORY:-/run}"
readonly turnstile_secret_file="${TURNSTILE_SECRET_FILE:-/run/secrets/turnstile_secret_key}"

for command in aws curl jq openssl "${nomad_operator}"; do
	if ! command -v "${command}" >/dev/null 2>&1; then
		printf 'Required bootstrap command is unavailable: %s\n' "${command}" >&2
		exit 1
	fi
done

if [[ ! -r "${turnstile_secret_file}" || ! -s "${turnstile_secret_file}" ]]; then
	printf 'Turnstile secret is unavailable: %s\n' "${turnstile_secret_file}" >&2
	exit 1
fi

readonly variables=(
	"rezics application/runtime"
	"rezics database/operations"
	"rezics-infrastructure nomad/jobs/rezics-postgres/postgres/postgres"
	"rezics-infrastructure nomad/jobs/rezics-meilisearch/meilisearch/meilisearch"
	"rezics-infrastructure nomad/jobs/rezics-sequin-postgres/postgres/postgres"
	"rezics-infrastructure nomad/jobs/rezics-sequin-valkey/valkey/valkey"
	"rezics-infrastructure nomad/jobs/rezics-sequin/sequin/sequin"
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
		printf '%s\n' \
			"Variable installation failed; removing only Variables created by this attempt" >&2
		while read -r namespace path; do
			"${nomad_operator}" var purge -namespace="${namespace}" "${path}" \
				>/dev/null 2>&1 || true
		done <"${installed_file}"
	fi
	rm -rf "${work_directory}"
	exit "${status}"
}
trap cleanup EXIT

install -m 0600 /dev/stdin "${credentials_file}"
: >"${installed_file}"

jq -e '
    type == "object" and
    (keys | sort) == ["cloudflare", "r2", "schemaVersion"] and
    .schemaVersion == 1 and
    (.cloudflare | type == "object") and
    (.cloudflare | keys | sort) == ["accountId", "emailApiToken"] and
    (.cloudflare.accountId | test("^[0-9a-f]{32}$")) and
    (.cloudflare.emailApiToken | test("^cfat_[A-Za-z0-9_-]{40,}$")) and
    (.r2 | type == "object") and
    (.r2 | keys | sort) == ["application", "endpoint"] and
    .r2.endpoint == ("https://" + .cloudflare.accountId + ".r2.cloudflarestorage.com") and
    (.r2.application | keys | sort) == ["accessKeyId", "bucket", "secretAccessKey"] and
    .r2.application.bucket == "rezics-production" and
    (.r2.application.accessKeyId | test("^[0-9A-Fa-f]{32}$")) and
    (.r2.application.secretAccessKey | test("^[0-9A-Fa-f]{64}$"))
' "${credentials_file}" >/dev/null

account_id="$(jq -er '.cloudflare.accountId' "${credentials_file}")"
readonly account_id
email_token="$(jq -er '.cloudflare.emailApiToken' "${credentials_file}")"
r2_endpoint="$(jq -er '.r2.endpoint' "${credentials_file}")"
readonly r2_endpoint

cloudflare_config="${work_directory}/cloudflare.curl"
printf 'header = "Authorization: Bearer %s"\n' "${email_token}" >"${cloudflare_config}"
curl --fail --silent --show-error \
	--config "${cloudflare_config}" \
	--output "${work_directory}/email-token-verification.json" \
	"https://api.cloudflare.com/client/v4/accounts/${account_id}/tokens/verify"
jq -e '.success == true and .result.status == "active"' \
	"${work_directory}/email-token-verification.json" >/dev/null

for workload in application; do
	access_key_id="$(jq -er --arg workload "${workload}" '.r2[$workload].accessKeyId' "${credentials_file}")"
	secret_access_key="$(jq -er --arg workload "${workload}" '.r2[$workload].secretAccessKey' "${credentials_file}")"
	bucket="$(jq -er --arg workload "${workload}" '.r2[$workload].bucket' "${credentials_file}")"
	AWS_ACCESS_KEY_ID="${access_key_id}" \
		AWS_SECRET_ACCESS_KEY="${secret_access_key}" \
		AWS_DEFAULT_REGION=auto \
		aws s3api head-bucket \
		--endpoint-url "${r2_endpoint}" \
		--bucket "${bucket}" >/dev/null
done
unset access_key_id secret_access_key bucket email_token
printf '%s\n' "Cloudflare Email and the scoped application R2 credentials are valid"

printf 'u%s\n' "$(openssl rand -hex 10 | cut -c 1-19)" >"${work_directory}/postgres-username"
printf 'u%s\n' "$(openssl rand -hex 10 | cut -c 1-19)" >"${work_directory}/application-database-username"
printf 'u%s\n' "$(openssl rand -hex 10 | cut -c 1-19)" >"${work_directory}/sequin-source-username"
openssl rand -hex 32 >"${work_directory}/postgres-password"
openssl rand -hex 32 >"${work_directory}/application-database-password"
openssl rand -hex 32 >"${work_directory}/sequin-source-password"
openssl rand -hex 32 >"${work_directory}/better-auth-secret"
openssl rand -hex 32 >"${work_directory}/meilisearch-master-key"
openssl rand -hex 32 >"${work_directory}/sequin-postgres-password"
openssl rand -hex 32 >"${work_directory}/valkey-password"
openssl rand -base64 64 | tr -d '\n' >"${work_directory}/sequin-secret-key-base"
openssl rand -base64 32 | tr -d '\n' >"${work_directory}/sequin-vault-key"
openssl rand -hex 32 >"${work_directory}/sequin-admin-password"
openssl rand -hex 32 >"${work_directory}/sequin-api-token"

jq -n \
	--slurpfile external "${credentials_file}" \
	--rawfile turnstileSecret "${turnstile_secret_file}" \
	--rawfile postgresUsername "${work_directory}/postgres-username" \
	--rawfile applicationDatabaseUsername "${work_directory}/application-database-username" \
	--rawfile sequinSourceUsername "${work_directory}/sequin-source-username" \
	--rawfile postgresPassword "${work_directory}/postgres-password" \
	--rawfile applicationDatabasePassword "${work_directory}/application-database-password" \
	--rawfile sequinSourcePassword "${work_directory}/sequin-source-password" \
	--rawfile betterAuthSecret "${work_directory}/better-auth-secret" \
	--rawfile meilisearchMasterKey "${work_directory}/meilisearch-master-key" \
	--rawfile sequinPostgresPassword "${work_directory}/sequin-postgres-password" \
	--rawfile valkeyPassword "${work_directory}/valkey-password" \
	--rawfile sequinSecretKeyBase "${work_directory}/sequin-secret-key-base" \
	--rawfile sequinVaultKey "${work_directory}/sequin-vault-key" \
	--rawfile sequinAdminPassword "${work_directory}/sequin-admin-password" \
	--rawfile sequinApiToken "${work_directory}/sequin-api-token" '
	def value: rtrimstr("\n");
	($external[0]) as $external |
	($turnstileSecret | value) as $turnstileSecret |
	($postgresUsername | value) as $postgresUsername |
	($applicationDatabaseUsername | value) as $applicationDatabaseUsername |
	($sequinSourceUsername | value) as $sequinSourceUsername |
	($postgresPassword | value) as $postgresPassword |
	($applicationDatabasePassword | value) as $applicationDatabasePassword |
	($sequinSourcePassword | value) as $sequinSourcePassword |
	($betterAuthSecret | value) as $betterAuthSecret |
	($meilisearchMasterKey | value) as $meilisearchMasterKey |
	($sequinPostgresPassword | value) as $sequinPostgresPassword |
	($valkeyPassword | value) as $valkeyPassword |
	($sequinSecretKeyBase | value) as $sequinSecretKeyBase |
	($sequinVaultKey | value) as $sequinVaultKey |
	($sequinAdminPassword | value) as $sequinAdminPassword |
	($sequinApiToken | value) as $sequinApiToken |
	{
		DATABASE_URL: ("postgres://" + $applicationDatabaseUsername + ":" + $applicationDatabasePassword + "@127.0.0.1:5432/rezics?sslmode=disable"),
		BETTER_AUTH_SECRET: $betterAuthSecret,
		BETTER_AUTH_URL: "https://www.rezics.com",
		BETTER_AUTH_TRUSTED_ORIGINS: "https://www.rezics.com",
		TURNSTILE_SECRET_KEY: $turnstileSecret,
		TURNSTILE_ALLOWED_HOSTNAMES: "www.rezics.com,rezics.com",
		EMAIL_MODE: "cloudflare",
		EMAIL_FROM: "no-reply@rezics.com",
		EMAIL_FROM_NAME: "REZICS",
		CLOUDFLARE_ACCOUNT_ID: $external.cloudflare.accountId,
		CLOUDFLARE_EMAIL_API_TOKEN: $external.cloudflare.emailApiToken,
		EMAIL_DISPATCH_POLL_INTERVAL_MS: "1000",
		EMAIL_DISPATCH_BATCH_SIZE: "20",
		EMAIL_DISPATCH_MAX_ATTEMPTS: "5",
		S3_ENDPOINT: $external.r2.endpoint,
		S3_REGION: "auto",
		S3_ACCESS_KEY_ID: $external.r2.application.accessKeyId,
		S3_SECRET_ACCESS_KEY: $external.r2.application.secretAccessKey,
		S3_BUCKET: $external.r2.application.bucket,
		S3_FORCE_PATH_STYLE: "false",
		S3_PRESIGN_EXPIRES_IN: "900",
		IMAGE_ASSET_CLEANUP_INTERVAL_MS: "300000",
		IMAGE_ASSET_CLEANUP_GRACE_MS: "300000",
		IMAGE_ASSET_CLEANUP_BATCH_SIZE: "100",
		API_QUOTA_CLEANUP_INTERVAL_MS: "3600000",
		MEILISEARCH_URL: "http://127.0.0.1:7700",
		RECOMMENDATION_REFRESH_INTERVAL_MS: "300000"
	} as $applicationRuntime |
	($applicationRuntime + {
		DATABASE_ADMIN_URL: ("postgres://" + $postgresUsername + ":" + $postgresPassword + "@127.0.0.1:5432/rezics?sslmode=disable"),
		SEQUIN_URL: "http://127.0.0.1:7376",
		SEQUIN_API_TOKEN: $sequinApiToken,
		SEQUIN_SOURCE_USERNAME: $sequinSourceUsername
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
					REZICS_DATABASE_PASSWORD: $applicationDatabasePassword,
					SEQUIN_SOURCE_USERNAME: $sequinSourceUsername,
					SEQUIN_SOURCE_PASSWORD: $sequinSourcePassword
				}
			},
			{
				Namespace: "rezics-infrastructure",
				Path: "nomad/jobs/rezics-meilisearch/meilisearch/meilisearch",
				Items: {MEILI_MASTER_KEY: $meilisearchMasterKey}
			},
			{
				Namespace: "rezics-infrastructure",
				Path: "nomad/jobs/rezics-sequin-postgres/postgres/postgres",
				Items: {POSTGRES_PASSWORD: $sequinPostgresPassword}
			},
			{
				Namespace: "rezics-infrastructure",
				Path: "nomad/jobs/rezics-sequin-valkey/valkey/valkey",
				Items: {VALKEY_PASSWORD: $valkeyPassword}
			},
			{
				Namespace: "rezics-infrastructure",
				Path: "nomad/jobs/rezics-sequin/sequin/sequin",
				Items: {
					PG_PASSWORD: $sequinPostgresPassword,
					REDIS_URL: ("redis://default:" + $valkeyPassword + "@127.0.0.1:6379"),
					SECRET_KEY_BASE: $sequinSecretKeyBase,
					VAULT_KEY: $sequinVaultKey,
					SEQUIN_ADMIN_EMAIL: "operations@rezics.com",
					SEQUIN_ADMIN_PASSWORD: $sequinAdminPassword,
					SEQUIN_API_TOKEN: $sequinApiToken,
					SEQUIN_SOURCE_USERNAME: $sequinSourceUsername,
					SEQUIN_SOURCE_PASSWORD: $sequinSourcePassword,
					MEILISEARCH_CURRENT_INDEX_UID: "rezics_units_v1_20260801",
					MEILISEARCH_CURRENT_SINK_NAME: "rezics-units-v1-20260801",
					MEILISEARCH_HISTORY_INDEX_UID: "rezics_revisions_v1_20260801",
					MEILISEARCH_HISTORY_SINK_NAME: "rezics-revisions-v1-20260801"
				}
			}
		]
	}
' >"${variables_file}"

jq -e '
    (.variables | map(select(
        .Namespace == "rezics-infrastructure" and
        .Path == "nomad/jobs/rezics-sequin-valkey/valkey/valkey"
    )) | .[0].Items.VALKEY_PASSWORD) as $valkeyPassword |
    (.variables | map(select(
        .Namespace == "rezics-infrastructure" and
        .Path == "nomad/jobs/rezics-sequin/sequin/sequin"
    )) | .[0].Items.REDIS_URL) as $redisUrl |
	(.variables | length == 7) and
    all(.variables[]; (.Items | type == "object") and all(.Items[]; type == "string" and length > 0)) and
    $redisUrl == ("redis://default:" + $valkeyPassword + "@127.0.0.1:6379")
' "${variables_file}" >/dev/null

while IFS= read -r specification; do
	namespace="$(jq -r '.Namespace' <<<"${specification}")"
	path="$(jq -r '.Path' <<<"${specification}")"
	printf '%s %s\n' "${namespace}" "${path}" >>"${installed_file}"
	printf '%s' "${specification}" |
		"${nomad_operator}" var put -check-index=0 -in=json - >/dev/null
done < <(jq -c '.variables[]' "${variables_file}")

bootstrap_complete=true
printf '%s\n' "Seven create-only production Nomad Variables are installed"
