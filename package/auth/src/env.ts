import {createEnv} from '@t3-oss/env-core';
import * as v from 'valibot';

export const env = createEnv({
  server: {
    /**
     * Selects the auth service runtime mode.
     * Non-production modes log notification payloads instead of sending real email.
     */
    NODE_ENV: v.optional(
      v.union([
        v.literal('development'),
        v.literal('test'),
        v.literal('production'),
      ]),
    ),

    /**
     * Configures the auth HTTP listen port as a string value.
     * Defaults to `3001` when omitted.
     */
    PORT: v.optional(v.string()),

    /**
     * PostgreSQL connection string used by Prisma for auth data persistence.
     * This value is required at startup.
     */
    DATABASE_URL: v.string(),

    /**
     * Public base URL for the auth service.
     * Used for Better Auth baseURL, issuer fallback, trusted-origin baseline, and invitation links.
     */
    BETTER_AUTH_URL: v.string(),

    /**
     * Primary Better Auth secret for session and internal framework crypto.
     * Keep this secret high-entropy, private, and unique per environment. It does not sign JWKS ES256 tokens.
     */
    BETTER_AUTH_SECRET: v.string(),

    /**
     * Optional supplemental Better Auth secrets for secret rotation or backward compatibility.
     * This repo does not reference it directly, so keep formatting aligned with the Better Auth runtime you use.
     */
    BETTER_AUTH_SECRETS: v.optional(v.string()),

    /**
     * Shared secret for service-to-service calls across the internal token gateway boundary.
     * Keep this secret private and different from `BETTER_AUTH_SECRET`.
     */
    AUTH_INTERNAL_TOKEN_GATEWAY_SECRET: v.string(),

    /**
     * Optional extra trusted origins accepted by auth flows.
     * Combined with `BETTER_AUTH_URL` to build the final trusted origin list.
     */
    AUTH_TRUSTED_ORIGINS: v.optional(v.string()),

    /**
     * JWT audience claim emitted by the auth service.
     * Defaults to `rezics-api` when omitted.
     */
    AUTH_JWT_AUDIENCE: v.optional(v.string()),

    /**
     * JWT issuer claim emitted by the auth service.
     * Defaults to `BETTER_AUTH_URL` when omitted.
     */
    AUTH_JWT_ISSUER: v.optional(v.string()),

    /**
     * Access token and ID token lifetime in seconds, provided as a string.
     * Defaults to `3600` when omitted.
     */
    AUTH_JWT_TTL_SECONDS: v.optional(v.string()),

    /**
     * JWKS signing-key rotation interval in seconds, provided as a string.
     * Defaults to `86400` when omitted.
     */
    AUTH_JWKS_ROTATION_INTERVAL_SECONDS: v.optional(v.string()),

    /**
     * Grace period for previously rotated JWKS keys in seconds, provided as a string.
     * Defaults to `3900` when omitted.
     */
    AUTH_JWKS_GRACE_PERIOD_SECONDS: v.optional(v.string()),

    /**
     * SMTP host for production email delivery.
     * Real sending requires this together with `SMTP_USER` and `SMTP_PASSWORD`.
     */
    SMTP_HOST: v.optional(v.string()),

    /**
     * SMTP port for the auth mail transport, provided as a string.
     * Defaults to `465` when omitted.
     */
    SMTP_PORT: v.optional(v.string()),

    /**
     * Controls whether the SMTP transport uses a secure connection.
     * Defaults to `true`; only the literal string `false` disables secure mode.
     */
    SMTP_SECURE: v.optional(v.string()),

    /**
     * SMTP username for production email delivery.
     * Real sending requires this together with `SMTP_HOST` and `SMTP_PASSWORD`.
     */
    SMTP_USER: v.optional(v.string()),

    /**
     * SMTP password for production email delivery.
     * Real sending requires this together with `SMTP_HOST` and `SMTP_USER`.
     */
    SMTP_PASSWORD: v.optional(v.string()),

    /**
     * Optional display name used when formatting sender addresses as `Name <email>`.
     * Non-production environments still log notifications instead of sending them.
     */
    SMTP_USER_NAME: v.optional(v.string()),

    /**
     * Sender address for organization invitation emails.
     * Production email delivery also requires a working SMTP transport.
     */
    AUTH_INVITATION_FROM_EMAIL: v.optional(v.string()),

    /**
     * Sender address for password reset emails.
     * Falls back to `AUTH_INVITATION_FROM_EMAIL` when omitted.
     */
    AUTH_PASSWORD_RESET_FROM_EMAIL: v.optional(v.string()),

    /**
     * Sender address for verification and change-email emails.
     * Falls back to `AUTH_INVITATION_FROM_EMAIL` when omitted.
     */
    AUTH_VERIFICATION_FROM_EMAIL: v.optional(v.string()),

    /**
     * OAuth client ID for the Google provider.
     * Only needed when Google sign-in is enabled.
     */
    GOOGLE_CLIENT_ID: v.optional(v.string()),

    /**
     * OAuth client secret for the Google provider.
     * Only needed when Google sign-in is enabled.
     */
    GOOGLE_CLIENT_SECRET: v.optional(v.string()),

    /**
     * OAuth client ID for the Microsoft provider.
     * Only needed when Microsoft sign-in is enabled.
     */
    MICROSOFT_CLIENT_ID: v.optional(v.string()),

    /**
     * OAuth client secret for the Microsoft provider.
     * Only needed when Microsoft sign-in is enabled.
     */
    MICROSOFT_CLIENT_SECRET: v.optional(v.string()),

    /**
     * OAuth client ID for the GitHub provider.
     * Only needed when GitHub sign-in is enabled.
     */
    GITHUB_CLIENT_ID: v.optional(v.string()),

    /**
     * OAuth client secret for the GitHub provider.
     * Only needed when GitHub sign-in is enabled.
     */
    GITHUB_CLIENT_SECRET: v.optional(v.string()),

    /**
     * OAuth client ID for the Twitter provider.
     * Only needed when Twitter sign-in is enabled.
     */
    TWITTER_CLIENT_ID: v.optional(v.string()),

    /**
     * OAuth client secret for the Twitter provider.
     * Only needed when Twitter sign-in is enabled.
     */
    TWITTER_CLIENT_SECRET: v.optional(v.string()),

    /**
     * OAuth client ID for the Telegram provider.
     * Only needed when Telegram sign-in is enabled.
     */
    TELEGRAM_CLIENT_ID: v.optional(v.string()),

    /**
     * OAuth client secret for the Telegram provider.
     * Only needed when Telegram sign-in is enabled.
     */
    TELEGRAM_CLIENT_SECRET: v.optional(v.string()),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
