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
     * Optional explicit JWKS endpoint used to validate tokens issued by the auth service.
     * When omitted, the server derives it from `AUTH_JWT_ISSUER` plus `/.well-known/jwks.json`.
     */
    AUTH_JWKS_URL: v.optional(v.string()),

    /**
     * Expected issuer for auth JWT validation.
     * Defaults to `http://localhost:35003` when omitted.
     */
    AUTH_JWT_ISSUER: v.optional(v.string()),

    /**
     * Expected audience for auth JWT validation.
     * Defaults to `rezics-api` when omitted.
     */
    AUTH_JWT_AUDIENCE: v.optional(v.string()),

    /**
     * Optional explicit auth-service base URL for server-to-server session-state checks.
     * Defaults to `AUTH_JWT_ISSUER` when omitted.
     */
    AUTH_API_URL: v.optional(v.string()),

    /**
     * Allowed JWT clock skew in seconds, provided as a string.
     * Defaults to `5` when omitted.
     */
    AUTH_JWT_CLOCK_TOLERANCE_SECONDS: v.optional(v.string()),

    /**
     * Optional explicit PEM private key used to sign main-server session JWTs.
     * In production this should be configured explicitly and must be independent from auth-service keys.
     */
    MAIN_SESSION_JWT_PRIVATE_KEY: v.optional(v.string()),

    /**
     * Optional PEM public key used to verify main-server session JWTs.
     * When omitted the server derives it from the configured private key.
     */
    MAIN_SESSION_JWT_PUBLIC_KEY: v.optional(v.string()),

    /**
     * Expected issuer for main-server session JWTs.
     * Defaults to `http://localhost:<PORT>` when omitted.
     */
    MAIN_SESSION_JWT_ISSUER: v.optional(v.string()),

    /**
     * Expected audience for main-server session JWT validation.
     * Defaults to `rezics-main-server` when omitted.
     */
    MAIN_SESSION_JWT_AUDIENCE: v.optional(v.string()),

    /**
     * Main-server session JWT lifetime in seconds.
     * Defaults to `900` when omitted.
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
