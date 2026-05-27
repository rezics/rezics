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

    /** PostgreSQL connection string for the Ranking database. */
    RANKING_DATABASE_URL: v.string(),

    /** PostgreSQL connection string for current-state main database reads. */
    SERVER_DATABASE_URL: v.string(),

    /** Reaction service base URL for current summary reads. */
    REACTION_BASE_URL: v.string(),

    /** Shared secret for reaction internal summary reads. */
    REACTION_INTERNAL_SECRET: v.string(),

    /** Meilisearch endpoint used for serving projection patches. */
    MEILI_HOST: v.string(),

    /** Meilisearch API key used for serving projection patches. */
    MEILI_MASTER_KEY: v.string(),

    /** Server HTTP listen port. */
    PORT: v.optional(v.string()),

    /** Default bounded full-sync page size. */
    RANKING_FULL_SYNC_LIMIT: v.optional(v.string()),

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
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
