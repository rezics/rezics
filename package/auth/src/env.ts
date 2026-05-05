import { createEnv } from "@t3-oss/env-core";
import * as v from "valibot";

export const env = createEnv({
  server: {
    /*
     * Server Runtime & Infrastructure
     */

    /**
     * Auth service runtime mode. Non-production modes log notifications instead of sending emails.
     */
    NODE_ENV: v.optional(
      v.union([
        v.literal("development"),
        v.literal("test"),
        v.literal("production"),
      ]),
    ),

    /**
     * HTTP listen port. Defaults to '3001'.
     */
    PORT: v.fallback(v.string(), "3001"),

    /**
     * PostgreSQL connection string for Prisma data persistence. Required at startup.
     */
    DATABASE_URL: v.string(),

    /*
     * Better Auth Core Configuration
     */

    /**
     * Internal/native base URL for the auth service. Public product flows use
     * AUTH_PUBLIC_BASE_URL through the main server boundary.
     */
    BETTER_AUTH_URL: v.string(),

    /**
     * Browser-facing auth base URL exposed by main, e.g. https://rezics.com/auth.
     */
    AUTH_PUBLIC_BASE_URL: v.fallback(v.string(), "http://localhost:3000/auth"),

    /**
     * Public OAuth/OIDC issuer URL, e.g. https://rezics.com.
     */
    AUTH_PUBLIC_ISSUER_URL: v.fallback(v.string(), "http://localhost:3000"),

    /**
     * Primary secret for session and internal crypto. Must be high-entropy and unique.
     */
    BETTER_AUTH_SECRET: v.string(),

    /**
     * Supplemental secrets for rotation or backward compatibility.
     */
    BETTER_AUTH_SECRETS: v.optional(v.string()),

    /*
     * Internal Security & Routing
     */

    /**
     * API route prefix for auth endpoints. Defaults to '/api/auth'.
     */
    AUTH_OPENAPI_ROUTER_PREFIX: v.fallback(v.string(), "/api/auth"),

    /**
     * Shared secret for service-to-service calls across internal boundaries.
     */
    AUTH_INTERNAL_TOKEN_GATEWAY_SECRET: v.string(),

    /**
     * Base URL of the main server for internal calls (e.g., user provisioning).
     * Defaults to 'http://localhost:3000'.
     */
    SERVER_BASE_URL: v.fallback(v.string(), "http://localhost:3000"),

    /**
     * Shared secret for authenticating calls to the main server's internal endpoints.
     */
    SERVER_INTERNAL_SECRET: v.optional(v.string()),

    /**
     * Supplemental list of trusted origins for auth flows.
     */
    AUTH_TRUSTED_ORIGINS: v.optional(v.string()),

    /*
     * JWT & JWKS Management
     * Settings for token issuance and signing key rotation.
     */

    /**
     * Bootstrap-only override for the auth-local JWT audience.
     * Steady-state runtime metadata is persisted in the auth JWT service registry.
     */
    AUTH_JWT_AUDIENCE: v.optional(v.string()),
    /**
     * Bootstrap-only override for the auth-local JWT issuer.
     * Steady-state runtime metadata is persisted in the auth JWT service registry.
     */
    AUTH_JWT_ISSUER: v.optional(v.string()),
    /**
     * Bootstrap-only override for auth-issued JWT lifetime.
     * Use only for migration or emergency rotation tuning.
     */
    AUTH_JWT_TTL_SECONDS: v.optional(v.string()),
    /**
     * Bootstrap-only override for auth signing-key rotation cadence.
     */
    AUTH_JWKS_ROTATION_INTERVAL_SECONDS: v.optional(v.string()),
    /**
     * Bootstrap-only override for auth JWKS grace-period publication.
     */
    AUTH_JWKS_GRACE_PERIOD_SECONDS: v.optional(v.string()),

    /*
     * Mail Transport (SMTP)
     * Configures the delivery mechanism for outbound emails.
     */

    SMTP_HOST: v.string(),
    SMTP_PORT: v.fallback(v.string(), "465"),
    SMTP_SECURE: v.fallback(v.string(), "true"),
    SMTP_USER: v.string(),
    SMTP_PASSWORD: v.string(),
    SMTP_USER_NAME: v.optional(v.string()),

    /*
     * Email Templates & Senders
     * Defines the 'From' address for different notification types.
     */

    AUTH_INVITATION_FROM_EMAIL: v.fallback(v.string(), "noreply@rezics.com"),
    AUTH_PASSWORD_RESET_FROM_EMAIL: v.fallback(
      v.string(),
      "noreply@rezics.com",
    ),
    AUTH_VERIFICATION_FROM_EMAIL: v.fallback(v.string(), "noreply@rezics.com"),

    /*
     * OAuth Provider Credentials
     * Client IDs and Secrets for external identity providers.
     * Only required if the respective provider is enabled.
     */

    // Google
    GOOGLE_CLIENT_ID: v.optional(v.string()),
    GOOGLE_CLIENT_SECRET: v.optional(v.string()),

    // Microsoft
    MICROSOFT_CLIENT_ID: v.optional(v.string()),
    MICROSOFT_CLIENT_SECRET: v.optional(v.string()),

    // GitHub
    GITHUB_CLIENT_ID: v.optional(v.string()),
    GITHUB_CLIENT_SECRET: v.optional(v.string()),

    // Twitter
    TWITTER_CLIENT_ID: v.optional(v.string()),
    TWITTER_CLIENT_SECRET: v.optional(v.string()),

    // Telegram
    TELEGRAM_CLIENT_ID: v.optional(v.string()),
    TELEGRAM_CLIENT_SECRET: v.optional(v.string()),

    /*
     * Turnstile (Cloudflare CAPTCHA)
     */

    TURNSTILE_SECRET: v.optional(v.string()),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
