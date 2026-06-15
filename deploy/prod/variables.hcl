// ── Docker images (required) ────────────────────────────────────────────────
// Runtime images — compiled Bun binaries on debian:bookworm-slim.

variable "image_server" {
  description = "ghcr.io/rezics/rezics-server:sha-<sha>"
  type        = string
}

variable "image_auth" {
  description = "ghcr.io/rezics/rezics-auth:sha-<sha>"
  type        = string
}

variable "image_notify" {
  description = "ghcr.io/rezics/rezics-notify:sha-<sha>"
  type        = string
}

variable "image_reaction" {
  description = "ghcr.io/rezics/rezics-reaction:sha-<sha>"
  type        = string
}

variable "image_history" {
  description = "ghcr.io/rezics/rezics-history:sha-<sha>"
  type        = string
}

variable "image_ranking" {
  description = "ghcr.io/rezics/rezics-ranking:sha-<sha>"
  type        = string
}

variable "image_preview" {
  description = "ghcr.io/rezics/rezics-preview:sha-<sha>"
  type        = string
}

variable "image_job_runner" {
  description = "ghcr.io/rezics/rezics-job-runner:sha-<sha>"
  type        = string
}

// Migrate images — build-stage snapshots with the full workspace + Drizzle Kit.

variable "image_server_migrate" {
  description = "ghcr.io/rezics/rezics-server-migrate:sha-<sha>"
  type        = string
}

variable "image_auth_migrate" {
  description = "ghcr.io/rezics/rezics-auth-migrate:sha-<sha>"
  type        = string
}

variable "image_notify_migrate" {
  description = "ghcr.io/rezics/rezics-notify-migrate:sha-<sha>"
  type        = string
}

variable "image_reaction_migrate" {
  description = "ghcr.io/rezics/rezics-reaction-migrate:sha-<sha>"
  type        = string
}

variable "image_history_migrate" {
  description = "ghcr.io/rezics/rezics-history-migrate:sha-<sha>"
  type        = string
}

variable "image_ranking_migrate" {
  description = "ghcr.io/rezics/rezics-ranking-migrate:sha-<sha>"
  type        = string
}

variable "image_job_runner_migrate" {
  description = "ghcr.io/rezics/rezics-job-runner-migrate:sha-<sha>"
  type        = string
}

// ── Network ─────────────────────────────────────────────────────────────────

variable "network" {
  description = "Docker network name"
  type        = string
  default     = "rezics"
}

// ── Public URLs (required) ──────────────────────────────────────────────────

variable "server_public_url" {
  description = "Public URL of the server API (e.g., https://api.rezics.com)"
  type        = string
}

variable "auth_public_url" {
  description = "Public URL of the auth service (e.g., https://auth.rezics.com)"
  type        = string
}

variable "media_public_base_url" {
  description = "Public URL for serving uploaded media (e.g., https://cdn.rezics.com/rezics)"
  type        = string
}

// ── Postgres (required) ─────────────────────────────────────────────────────

variable "postgres_user" {
  type = string
}

variable "postgres_password" {
  type = string
}

// ── Meilisearch (required) ──────────────────────────────────────────────────

variable "meili_master_key" {
  type = string
}

// ── S3 / RustFS (required) ──────────────────────────────────────────────────

variable "s3_endpoint" {
  description = "S3-compatible endpoint URL (e.g., http://rustfs:9000 or external)"
  type        = string
}

variable "s3_access_key_id" {
  type = string
}

variable "s3_secret_access_key" {
  type = string
}

variable "s3_bucket" {
  type    = string
  default = "rezics"
}

variable "s3_region" {
  type    = string
  default = "us-east-1"
}

// ── Sequin (required) ───────────────────────────────────────────────────────

variable "sequin_secret_key_base" {
  type = string
}

variable "sequin_vault_key" {
  type = string
}

variable "sequin_webhook_secret" {
  type = string
}

// ── Auth secrets (required) ─────────────────────────────────────────────────

variable "better_auth_secret" {
  type = string
}

variable "auth_internal_token_gateway_secret" {
  type = string
}

// ── Internal service secrets (required) ─────────────────────────────────────

variable "notify_internal_secret" {
  type = string
}

variable "reaction_internal_secret" {
  type = string
}

variable "history_internal_secret" {
  type = string
}

variable "job_runner_internal_secret" {
  type = string
}

variable "ranking_internal_secret" {
  type = string
}

variable "preview_internal_secret" {
  type = string
}

// ── SMTP (required) ─────────────────────────────────────────────────────────

variable "smtp_host" {
  type = string
}

variable "smtp_user" {
  type = string
}

variable "smtp_password" {
  type = string
}

// ── Turnstile (required) ────────────────────────────────────────────────────

variable "turnstile_secret" {
  type = string
}

// ── OAuth providers (optional) ──────────────────────────────────────────────

variable "google_client_id" {
  type    = string
  default = ""
}

variable "google_client_secret" {
  type    = string
  default = ""
}

variable "microsoft_client_id" {
  type    = string
  default = ""
}

variable "microsoft_client_secret" {
  type    = string
  default = ""
}

variable "github_oauth_client_id" {
  type    = string
  default = ""
}

variable "github_oauth_client_secret" {
  type    = string
  default = ""
}

variable "twitter_client_id" {
  type    = string
  default = ""
}

variable "twitter_client_secret" {
  type    = string
  default = ""
}

variable "telegram_bot_token" {
  type    = string
  default = ""
}

// ── Host ports (optional, for reverse proxy) ────────────────────────────────

variable "server_port" {
  type    = number
  default = 3000
}

variable "auth_port" {
  type    = number
  default = 3001
}

variable "notify_port" {
  type    = number
  default = 3002
}

variable "reaction_port" {
  type    = number
  default = 3003
}

variable "history_port" {
  type    = number
  default = 3004
}

variable "job_runner_http_port" {
  type    = number
  default = 3005
}

variable "ranking_port" {
  type    = number
  default = 3006
}

variable "preview_port" {
  type    = number
  default = 3007
}

// ── Observability (optional) ────────────────────────────────────────────────

variable "otel_exporter_otlp_endpoint" {
  description = "OTLP HTTP endpoint (empty = telemetry disabled)"
  type        = string
  default     = ""
}
