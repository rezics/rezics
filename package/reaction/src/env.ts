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

    /** PostgreSQL connection string for the Reaction database. */
    REACTION_DATABASE_URL: v.string(),

    /** Shared secret for authenticating internal service-to-service calls. */
    REACTION_INTERNAL_SECRET: v.string(),

    /** Server JWKS URL for verifying rezics-session-token JWTs. */
    SERVER_JWKS_URL: v.string(),

    /** Expected JWT issuer for rezics-session-token. */
    SERVER_ISSUER: v.fallback(v.string(), "rezics-server"),

    /** Comma-separated list of allowed reaction types. */
    REACTION_TYPES: v.fallback(v.string(), "like,dislike"),

    /** Server HTTP listen port. */
    PORT: v.optional(v.string()),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

/** Parsed set of allowed reaction types for validation. */
export const allowedReactionTypes = new Set(
  env.REACTION_TYPES.split(",")
    .map((t) => t.trim())
    .filter(Boolean),
);
