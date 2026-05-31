import { createEnv } from "@t3-oss/env-core";
import * as v from "valibot";

export const env = createEnv({
  server: {
    /**
     * Selects the server runtime mode.
     * Use `production` for live traffic and delivery integrations.
     */
    NODE_ENV: v.optional(
      v.union([
        v.literal("development"),
        v.literal("test"),
        v.literal("production"),
      ]),
    ),

    /**
     * PostgreSQL connection string used by Prisma for the main server database.
     * This value is required at startup.
     */
    DATABASE_URL: v.string(),

    /**
     * Internal base URL used by main for service-to-service auth calls.
     */
    AUTH_INTERNAL_BASE_URL: v.string(),

    /**
     * Browser-facing public auth boundary exposed by main.
     */
    AUTH_PUBLIC_BASE_URL: v.string(),

    /**
     * Public issuer URL for auth/OIDC metadata.
     */
    AUTH_PUBLIC_ISSUER_URL: v.string(),

    /**
     * Shared secret for internal auth token endpoints when main must call them.
     */
    AUTH_INTERNAL_TOKEN_GATEWAY_SECRET: v.string(),

    /**
     * Bootstrap-only audience for auth JWT validation metadata seeding.
     * Defaults to 'rezics'.
     */
    AUTH_JWT_AUDIENCE: v.optional(v.string()),

    /**
     * Allowed JWT clock skew in seconds, provided as a string.
     * Defaults to `5` when omitted.
     */
    AUTH_JWT_CLOCK_TOLERANCE_SECONDS: v.optional(v.string()),

    /**
     * Rezics session token lifetime in seconds. Defaults to 900 (15 minutes).
     */
    MAIN_SESSION_JWT_TTL_SECONDS: v.optional(v.string()),

    /**
     * JWKS signing key rotation interval in seconds. Defaults to 2592000 (30 days).
     */
    MAIN_SESSION_JWKS_ROTATION_SECONDS: v.optional(v.string()),

    /**
     * SMTP host used by main product email verification flows.
     * Main validates this value locally and passes it to `@rezics/email`.
     */
    SMTP_HOST: v.string(),

    /**
     * SMTP port used by main product email verification flows.
     * Defaults to `465`.
     */
    SMTP_PORT: v.fallback(v.string(), "465"),

    /**
     * Whether main SMTP delivery uses TLS from connection start.
     * Defaults to `true`; set to `false` for STARTTLS-style ports.
     */
    SMTP_SECURE: v.fallback(v.string(), "true"),

    /**
     * SMTP username used by main product email verification flows.
     * Pair it with `SMTP_HOST` and `SMTP_PASSWORD` when configuring delivery.
     */
    SMTP_USER: v.string(),

    /**
     * SMTP password used by main product email verification flows.
     * Pair it with `SMTP_HOST` and `SMTP_USER` when configuring an SMTP transport.
     */
    SMTP_PASSWORD: v.string(),

    /**
     * From email for main-owned product email verification messages.
     */
    MAIN_EMAIL_FROM_EMAIL: v.fallback(v.string(), "noreply@rezics.com"),

    /**
     * From display name for main-owned product email verification messages.
     */
    MAIN_EMAIL_FROM_NAME: v.optional(v.string()),

    /**
     * Sender display name for SMTP-backed mail features.
     */
    SMTP_USER_NAME: v.optional(v.string()),

    /**
     * Cloudflare Turnstile secret used for server-side token verification.
     */
    TURNSTILE_SECRET: v.string(),

    /**
     * Meilisearch host URL.
     */
    MEILI_HOST: v.string(),

    /**
     * Meilisearch master/admin API key.
     */
    MEILI_MASTER_KEY: v.string(),

    /**
     * Configures the server HTTP listen port as a string value.
     * Defaults to `3000` when omitted.
     */
    PORT: v.optional(v.string()),

    /** Observability log output mode: local text or newline-delimited JSON. */
    OBSERVABILITY_LOG_FORMAT: v.optional(
      v.union([v.literal("local"), v.literal("json")]),
    ),
    /** Enables ANSI color for local observability output. */
    OBSERVABILITY_COLOR: v.optional(v.string()),
    /** Slow HTTP request threshold in milliseconds. */
    OBSERVABILITY_SLOW_REQUEST_MS: v.optional(v.string()),
    /** OpenTelemetry mode: auto, disabled, enabled, or required. */
    OBSERVABILITY_TELEMETRY: v.optional(
      v.union([
        v.literal("auto"),
        v.literal("disabled"),
        v.literal("enabled"),
        v.literal("required"),
      ]),
    ),
    /** OTLP HTTP traces endpoint. When omitted, telemetry export is disabled. */
    OTEL_EXPORTER_OTLP_ENDPOINT: v.optional(v.string()),

    /** Cloudflare R2 S3 API endpoint URL. */
    R2_ENDPOINT: v.optional(v.string()),
    /** Cloudflare R2 access key ID. */
    R2_ACCESS_KEY_ID: v.optional(v.string()),
    /** Cloudflare R2 secret access key. */
    R2_SECRET_ACCESS_KEY: v.optional(v.string()),
    /** Cloudflare R2 bucket name. */
    R2_BUCKET: v.optional(v.string()),
    /** Public base URL for serving uploaded images from R2. */
    R2_PUBLIC_URL: v.optional(v.string()),

    /** Base URL of the Notify service for internal calls. */
    NOTIFY_BASE_URL: v.string(),

    /** Shared secret for authenticating internal calls to the Notify service. */
    NOTIFY_INTERNAL_SECRET: v.string(),

    /** Base URL of the Reaction service for internal calls. */
    REACTION_BASE_URL: v.string(),

    /** Shared secret for authenticating internal calls to the Reaction service. */
    REACTION_INTERNAL_SECRET: v.string(),

    /**
     * Base URL of the History service for app-facing read proxy requests.
     * When omitted, history proxy endpoints return a clear service-unavailable
     * response instead of bypassing Unit visibility checks.
     */
    HISTORY_BASE_URL: v.optional(v.string()),

    /** Base URL of the dispatch hub for audit notifications. */
    DISPATCH_HUB_URL: v.optional(v.string()),

    /** HMAC shared secret for signing dispatch audit notifications. */
    DISPATCH_RECEIPT_SECRET: v.optional(v.string()),

    /** Project identifier for dispatch integration. */
    DISPATCH_PROJECT_ID: v.optional(v.string()),

    /** Internal base URL for durable job-runner enqueue requests. */
    JOB_RUNNER_BASE_URL: v.optional(v.string()),

    /** Shared secret for authenticating internal job-runner enqueue requests. */
    JOB_RUNNER_INTERNAL_SECRET: v.optional(v.string()),

    /** Browser-facing application URL shown on the internal status page. */
    STATUS_APP_URL: v.optional(v.string()),

    /** Browser/operator-facing main server URL shown on the status page. */
    STATUS_SERVER_URL: v.optional(v.string()),

    /** Auth service health URL used by the internal status aggregator. */
    STATUS_AUTH_HEALTH_URL: v.optional(v.string()),

    /** Job-runner health/admin base URL used by the internal status aggregator. */
    STATUS_JOB_RUNNER_URL: v.optional(v.string()),

    /** Meilisearch operator URL shown on the internal status page. */
    STATUS_MEILI_URL: v.optional(v.string()),

    /** Sequin UI URL shown on the internal status page. */
    STATUS_SEQUIN_UI_URL: v.optional(v.string()),

    /** Sequin health endpoint checked by the internal status aggregator. */
    STATUS_SEQUIN_HEALTH_URL: v.optional(v.string()),

    /** Safe display name for the Sequin sink/webhook target. */
    STATUS_SEQUIN_WEBHOOK_TARGET_NAME: v.optional(v.string()),

    /** Source database publication expected by Sequin CDC. */
    STATUS_CDC_PUBLICATION_NAME: v.optional(v.string()),

    /** Source database replication slot expected by Sequin CDC. */
    STATUS_CDC_REPLICATION_SLOT_NAME: v.optional(v.string()),

    /** Byte threshold where replication slot lag degrades CDC status. */
    STATUS_CDC_LAG_WARNING_BYTES: v.optional(v.string()),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
