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
     * Public base URL of the auth service.
     * Used to derive issuer, JWKS (via /.well-known/jwks.json), and API calls.
     * Defaults to 'http://localhost:3001'.
     */
    AUTH_BASE_URL: v.fallback(v.string(), "http://localhost:3001"),

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
     * Bootstrap-only PEM private key used to seed the local server signing key.
     * Steady-state signing uses the persisted server JWKS key store.
     */
    MAIN_SESSION_JWT_PRIVATE_JWK: v.optional(v.string()),

    /**
     * Bootstrap-only public JWK paired with `MAIN_SESSION_JWT_PRIVATE_JWK`.
     */
    MAIN_SESSION_JWT_PUBLIC_JWK: v.optional(v.string()),

    /**
     * Bootstrap-only issuer used to seed the local server JWT service metadata.
     */
    MAIN_SESSION_JWT_ISSUER: v.optional(v.string()),

    /**
     * Bootstrap-only audience used to seed the local server JWT service metadata.
     */
    MAIN_SESSION_JWT_AUDIENCE: v.optional(v.string()),

    /**
     * Bootstrap-only main-server session JWT lifetime in seconds.
     */
    MAIN_SESSION_JWT_TTL_SECONDS: v.optional(v.string()),

    /**
     * Optional SMTP host reserved for server-side mail features.
     * If mail delivery is enabled here, it is typically paired with `SMTP_USER` and `SMTP_PASSWORD`.
     */
    SMTP_HOST: v.optional(v.string()),

    /**
     * Optional SMTP username reserved for server-side mail features.
     * Pair it with `SMTP_HOST` and `SMTP_PASSWORD` when configuring an SMTP transport.
     */
    SMTP_USER: v.optional(v.string()),

    /**
     * Optional SMTP password reserved for server-side mail features.
     * Pair it with `SMTP_HOST` and `SMTP_USER` when configuring an SMTP transport.
     */
    SMTP_PASSWORD: v.optional(v.string()),

    /**
     * Optional sender display name reserved for server-side mail features.
     * Typically used to format a sender as `Name <email>`.
     */
    SMTP_USER_NAME: v.optional(v.string()),

    /**
     * Cloudflare Turnstile secret used for server-side token verification.
     */
    TURNSTILE_SECRET: v.optional(v.string()),

    /**
     * Meilisearch host URL.
     * Defaults to `http://localhost:7700` when omitted.
     */
    MEILI_HOST: v.fallback(v.string(), "http://127.0.0.1:7700"),

    /**
     * Meilisearch master/admin API key.
     * Defaults to `masterKey` when omitted.
     */
    MEILI_MASTER_KEY: v.fallback(v.string(), "masterKey"),

    /**
     * Configures the server HTTP listen port as a string value.
     * Defaults to `3000` when omitted.
     */
    PORT: v.optional(v.string()),

    /** Cloudflare R2 S3-compatible endpoint URL. */
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
    NOTIFY_BASE_URL: v.fallback(v.string(), "http://localhost:3002"),

    /** Shared secret for authenticating internal calls to the Notify service. */
    NOTIFY_INTERNAL_SECRET: v.optional(v.string()),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
