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
    BACKEND_PORT: v.optional(v.string()),
    PORT: v.optional(v.string()),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

export function resolveBackendPort(): number {
  return Number(env.BACKEND_PORT ?? env.PORT ?? "3000");
}
