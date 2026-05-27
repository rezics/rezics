import path from "node:path";
import { fileURLToPath } from "node:url";
import { createEnv } from "@t3-oss/env-core";
import { config as loadDotenv } from "dotenv";
import * as v from "valibot";

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));

export const SECRET_KEY_BASE_EXAMPLE =
  "DO-NOT-USE-IN-PRODUCTION-secret-key-base";
export const VAULT_KEY_EXAMPLE = "DO-NOT-USE-IN-PRODUCTION-vault-key";

loadDotenv({ path: path.join(TOOL_DIR, ".env"), override: false, quiet: true });

export const env = createEnv({
  server: {
    SEQUIN_HEALTH_URL: v.optional(v.string()),

    PG_PASSWORD: v.optional(v.string()),
    PG_POOL_SIZE: v.optional(v.string()),
    SECRET_KEY_BASE: v.optional(v.string()),
    VAULT_KEY: v.optional(v.string()),

    ENV: v.optional(v.string()),
    SOURCE_DB_PORT_PUBLISHED: v.optional(v.string()),
    SOURCE_DB_PORT: v.optional(v.string()),
    SOURCE_DB_NAME: v.optional(v.string()),
    SOURCE_DB_USER: v.optional(v.string()),
    SOURCE_DB_PASSWORD: v.optional(v.string()),
    SOURCE_DB_POOL_SIZE: v.optional(v.string()),
    REACTION_DB_HOST: v.optional(v.string()),
    REACTION_DB_PORT: v.optional(v.string()),
    REACTION_DB_NAME: v.optional(v.string()),
    REACTION_DB_USER: v.optional(v.string()),
    REACTION_DB_PASSWORD: v.optional(v.string()),
    REACTION_DB_POOL_SIZE: v.optional(v.string()),
    MEILI_PORT_PUBLISHED: v.optional(v.string()),
    MEILI_MASTER_KEY: v.optional(v.string()),
    SEQUIN_PORT_PUBLISHED: v.optional(v.string()),

    SEQUIN_JOB_RUNNER_BASE_URL: v.optional(v.string()),
    SEQUIN_WEBHOOK_SECRET: v.optional(v.string()),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

const REQUIRED_SEQUIN_KEYS = [
  "PG_PASSWORD",
  "SECRET_KEY_BASE",
  "VAULT_KEY",
  "SOURCE_DB_PASSWORD",
  "SEQUIN_WEBHOOK_SECRET",
] as const;

const REQUIRED_PROD_SEQUIN_KEYS = [
  "ENV",
  "SEQUIN_JOB_RUNNER_BASE_URL",
] as const;

export type SequinEnvKey =
  | (typeof REQUIRED_SEQUIN_KEYS)[number]
  | (typeof REQUIRED_PROD_SEQUIN_KEYS)[number];

export function missingSequinEnv(mode: "dev" | "prod"): SequinEnvKey[] {
  const keys: readonly SequinEnvKey[] =
    mode === "prod"
      ? [...REQUIRED_SEQUIN_KEYS, ...REQUIRED_PROD_SEQUIN_KEYS]
      : REQUIRED_SEQUIN_KEYS;

  return keys.filter((key) => !env[key]);
}
