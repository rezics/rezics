import {createEnv} from '@t3-oss/env-core';
import * as v from 'valibot';

export const env = createEnv({
  server: {
    /**
     * Selects the server runtime mode.
     * Use `production` for live traffic and delivery integrations.
     */
    NODE_ENV: v.optional(
      v.union([
        v.literal('development'),
        v.literal('test'),
        v.literal('production'),
      ]),
    ),

    /**
     * PostgreSQL connection string used by Prisma for the main server database.
     * This value is required at startup.
     */
    DATABASE_URL: v.string(),

    /**
     * Secret used by the server for local JWT signing or verification flows.
     * Keep this secret private and unique per environment.
     */
    JWT_SECRET: v.string(),

    /**
     * Secret used by the server for refresh token handling.
     * Keep this secret private and different from other signing secrets.
     */
    REFRESH_TOKEN_SECRET: v.string(),

    /**
     * Bootstrap-only explicit JWKS endpoint used to seed the trusted auth JWT service record.
     * Steady-state verification reads the persisted trusted-issuer metadata table.
     */
    AUTH_JWKS_URL: v.optional(v.string()),

    /**
     * Bootstrap-only issuer for auth JWT validation metadata seeding.
     */
    AUTH_JWT_ISSUER: v.optional(v.string()),

    /**
     * Bootstrap-only audience for auth JWT validation metadata seeding.
     */
    AUTH_JWT_AUDIENCE: v.optional(v.string()),

    /**
     * Optional explicit auth-service base URL for session-state checks.
     * When omitted, the server uses the persisted trusted auth issuer metadata.
     */
    AUTH_API_URL: v.optional(v.string()),

    /**
     * Allowed JWT clock skew in seconds, provided as a string.
     * Defaults to `5` when omitted.
     */
    AUTH_JWT_CLOCK_TOLERANCE_SECONDS: v.optional(v.string()),

    /**
     * Bootstrap-only PEM private key used to seed the local server signing key.
     * Steady-state signing uses the persisted server JWKS key store.
     */
    MAIN_SESSION_JWT_PRIVATE_KEY: v.optional(v.string()),

    /**
     * Bootstrap-only PEM public key paired with `MAIN_SESSION_JWT_PRIVATE_KEY`.
     */
    MAIN_SESSION_JWT_PUBLIC_KEY: v.optional(v.string()),

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
     * Configures the server HTTP listen port as a string value.
     * Defaults to `3000` when omitted.
     */
    PORT: v.optional(v.string()),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
