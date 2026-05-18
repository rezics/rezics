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

    /** Base URL of the dispatch hub for audit notifications. */
    DISPATCH_HUB_URL: v.optional(v.string()),

    /** HMAC shared secret for signing dispatch audit notifications. */
    DISPATCH_RECEIPT_SECRET: v.optional(v.string()),

    /** Project identifier for dispatch integration. */
    DISPATCH_PROJECT_ID: v.optional(v.string()),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
