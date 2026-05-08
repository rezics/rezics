import { createEnv } from "@t3-oss/env-core";
import * as v from "valibot";

export const env = createEnv({
  server: {
    NODE_ENV: v.optional(
      v.union([
        v.literal("development"),
        v.literal("test"),
        v.literal("production"),
      ]),
    ),

    /** PostgreSQL connection string for the Notify database. */
    NOTIFY_DATABASE_URL: v.string(),

    /** Shared secret for authenticating internal service-to-service calls. */
    NOTIFY_INTERNAL_SECRET: v.string(),

    /** Server JWKS URL for verifying rezics-session-token JWTs. */
    SERVER_JWKS_URL: v.string(),

    /** Expected JWT issuer for rezics-session-token. */
    SERVER_ISSUER: v.fallback(v.string(), "rezics-server"),

    /** Server HTTP listen port. */
    PORT: v.optional(v.string()),

    /**
     * SMTP host. When unset, the email transport is a no-op stub that logs
     * the rendered message instead of delivering — useful in dev/CI.
     */
    SMTP_HOST: v.optional(v.string()),
    SMTP_PORT: v.optional(v.string()),
    SMTP_USER: v.optional(v.string()),
    SMTP_PASSWORD: v.optional(v.string()),
    SMTP_FROM: v.optional(v.string()),
    SMTP_SECURE: v.optional(v.string()),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
