import { createEnv } from "@t3-oss/env-core";
import * as v from "valibot";

type SeedEnv = {
  readonly AUTH_DATABASE_URL: string;
  readonly SERVER_DATABASE_URL: string;
};

let cached: SeedEnv | null = null;

export function getEnv(): SeedEnv {
  if (cached) return cached;
  cached = createEnv({
    server: {
      AUTH_DATABASE_URL: v.string(),
      SERVER_DATABASE_URL: v.string(),
    },
    runtimeEnv: process.env,
    emptyStringAsUndefined: true,
  }) as unknown as SeedEnv;
  return cached;
}
