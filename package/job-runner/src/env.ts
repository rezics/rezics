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
    JOB_DATABASE_URL: v.string(),
    SERVER_DATABASE_URL: v.string(),
    HISTORY_DATABASE_URL: v.string(),
    MEILI_HOST: v.string(),
    MEILI_MASTER_KEY: v.string(),
    JOB_RUNNER_INTERNAL_SECRET: v.string(),
    SEQUIN_WEBHOOK_SECRET: v.string(),
    SEQUIN_HEALTH_URL: v.optional(v.string()),
    PORT: v.optional(v.string()),
    OBSERVABILITY_LOG_FORMAT: v.optional(
      v.union([v.literal("local"), v.literal("json")]),
    ),
    OBSERVABILITY_COLOR: v.optional(v.string()),
    OBSERVABILITY_SLOW_REQUEST_MS: v.optional(v.string()),
    OBSERVABILITY_TELEMETRY: v.optional(
      v.union([
        v.literal("auto"),
        v.literal("disabled"),
        v.literal("enabled"),
        v.literal("required"),
      ]),
    ),
    OTEL_EXPORTER_OTLP_ENDPOINT: v.optional(v.string()),
    JOB_RUNNER_ROLE: v.fallback(
      v.union([v.literal("all"), v.literal("http"), v.literal("worker")]),
      "all",
    ),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

export type JobRunnerRole = typeof env.JOB_RUNNER_ROLE;
