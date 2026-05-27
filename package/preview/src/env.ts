import { createEnv } from "@t3-oss/env-core";
import * as v from "valibot";

export const env = createEnv({
  server: {
    SERVER_PORT: v.string(),
    DATABASE_URL: v.string(),
    NODE_ENV: v.optional(
      v.union([
        v.literal("development"),
        v.literal("test"),
        v.literal("production"),
      ]),
    ),
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
  },
  clientPrefix: "VITE_",
  client: {
    VITE_API_URL: v.optional(v.string()),
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
});
