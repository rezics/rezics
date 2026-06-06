import path from "node:path";
import { fileURLToPath } from "node:url";
import { createEnv } from "@t3-oss/env-core";
import { config as loadDotenv } from "dotenv";
import * as v from "valibot";

const TOOL_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

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

export type ToolEnv = typeof env;

const DEFAULT_TOOL_ENV = {
  ENV: "development",
  SEQUIN_HEALTH_URL: "http://127.0.0.1:7376/health",
  PG_PASSWORD: "DO-NOT-USE-IN-PRODUCTION-sequin-state-postgres",
  SECRET_KEY_BASE: SECRET_KEY_BASE_EXAMPLE,
  VAULT_KEY: VAULT_KEY_EXAMPLE,
  SOURCE_DB_PORT_PUBLISHED: "5432",
  SOURCE_DB_PORT: "5432",
  SOURCE_DB_NAME: "rezics_server",
  SOURCE_DB_USER: "postgres",
  SOURCE_DB_PASSWORD: "postgres",
  SOURCE_DB_POOL_SIZE: "10",
  REACTION_DB_HOST: "source-postgres",
  REACTION_DB_PORT: "5432",
  REACTION_DB_NAME: "rezics_reaction",
  REACTION_DB_USER: "postgres",
  REACTION_DB_PASSWORD: "postgres",
  REACTION_DB_POOL_SIZE: "10",
  MEILI_MASTER_KEY: "masterKey",
  SEQUIN_WEBHOOK_SECRET: "change-me-sequin-webhook-secret",
  SEQUIN_JOB_RUNNER_BASE_URL: "http://host.docker.internal:3005",
} as const;

const DEFAULT_MANAGED_DATABASE_NAMES = {
  auth: "rezics_auth",
  job: "rezics_jobs",
  history: "rezics_history",
  notify: "rezics_notify",
  ranking: "rezics_ranking",
} as const;

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

export function missingSequinEnv(
  mode: "dev" | "prod",
  input: ToolEnv = env,
): SequinEnvKey[] {
  const keys: readonly SequinEnvKey[] =
    mode === "prod"
      ? [...REQUIRED_SEQUIN_KEYS, ...REQUIRED_PROD_SEQUIN_KEYS]
      : REQUIRED_SEQUIN_KEYS;

  return keys.filter((key) => !input[key]);
}

export function unsafeSequinExampleKeys(input: ToolEnv = env) {
  const keys: Array<"SECRET_KEY_BASE" | "VAULT_KEY"> = [];
  if (input.SECRET_KEY_BASE === SECRET_KEY_BASE_EXAMPLE) {
    keys.push("SECRET_KEY_BASE");
  }
  if (input.VAULT_KEY === VAULT_KEY_EXAMPLE) {
    keys.push("VAULT_KEY");
  }
  return keys;
}

export function assertSequinRuntimeEnv(input: ToolEnv = env) {
  const missing = missingSequinEnv("dev", input);
  if (missing.length > 0) {
    throw new Error(
      [
        `Missing tool environment variables for managed services: ${missing.join(", ")}`,
        "Copy tool/.env.example to tool/.env and set the missing values.",
        "SEQUIN_WEBHOOK_SECRET must match package/job-runner/.env.",
      ].join("\n"),
    );
  }

  const unsafe = unsafeSequinExampleKeys(input);
  if (unsafe.length === 0) {
    return;
  }

  throw new Error(
    [
      `Refusing to start Sequin with documented example secret(s): ${unsafe.join(", ")}.`,
      "Generate real local values with:",
      "  openssl rand -base64 48  # SECRET_KEY_BASE",
      "  openssl rand -base64 32  # VAULT_KEY",
    ].join("\n"),
  );
}

export function createToolConfig(input: ToolEnv = env) {
  const sourceDbPassword =
    input.SOURCE_DB_PASSWORD ?? DEFAULT_TOOL_ENV.SOURCE_DB_PASSWORD;
  const sourceDbName = input.SOURCE_DB_NAME ?? DEFAULT_TOOL_ENV.SOURCE_DB_NAME;
  const reactionDbName =
    input.REACTION_DB_NAME ?? DEFAULT_TOOL_ENV.REACTION_DB_NAME;
  const schemaDatabaseNames = {
    auth: DEFAULT_MANAGED_DATABASE_NAMES.auth,
    server: sourceDbName,
    notify: DEFAULT_MANAGED_DATABASE_NAMES.notify,
    reaction: reactionDbName,
    history: DEFAULT_MANAGED_DATABASE_NAMES.history,
    ranking: DEFAULT_MANAGED_DATABASE_NAMES.ranking,
  } as const;

  return {
    mode: input.ENV ?? DEFAULT_TOOL_ENV.ENV,
    services: {
      composeProjectName: "rezics-dev-external-services",
      sequinHealthUrl:
        input.SEQUIN_HEALTH_URL ?? DEFAULT_TOOL_ENV.SEQUIN_HEALTH_URL,
      meiliHealthUrl: "http://127.0.0.1:7700/health",
    },
    composeEnv: {
      ENV: input.ENV ?? DEFAULT_TOOL_ENV.ENV,
      PG_PASSWORD: input.PG_PASSWORD ?? DEFAULT_TOOL_ENV.PG_PASSWORD,
      PG_POOL_SIZE: input.PG_POOL_SIZE,
      SECRET_KEY_BASE:
        input.SECRET_KEY_BASE ?? DEFAULT_TOOL_ENV.SECRET_KEY_BASE,
      VAULT_KEY: input.VAULT_KEY ?? DEFAULT_TOOL_ENV.VAULT_KEY,
      SOURCE_DB_NAME: sourceDbName,
      SOURCE_DB_USER: input.SOURCE_DB_USER ?? DEFAULT_TOOL_ENV.SOURCE_DB_USER,
      SOURCE_DB_PASSWORD: sourceDbPassword,
      SOURCE_DB_POOL_SIZE:
        input.SOURCE_DB_POOL_SIZE ?? DEFAULT_TOOL_ENV.SOURCE_DB_POOL_SIZE,
      SOURCE_DB_PORT_PUBLISHED:
        input.SOURCE_DB_PORT_PUBLISHED ??
        DEFAULT_TOOL_ENV.SOURCE_DB_PORT_PUBLISHED,
      REACTION_DB_HOST:
        input.REACTION_DB_HOST ?? DEFAULT_TOOL_ENV.REACTION_DB_HOST,
      REACTION_DB_PORT:
        input.REACTION_DB_PORT ?? DEFAULT_TOOL_ENV.REACTION_DB_PORT,
      REACTION_DB_NAME: reactionDbName,
      REACTION_DB_USER:
        input.REACTION_DB_USER ?? DEFAULT_TOOL_ENV.REACTION_DB_USER,
      REACTION_DB_PASSWORD:
        input.REACTION_DB_PASSWORD ??
        input.SOURCE_DB_PASSWORD ??
        DEFAULT_TOOL_ENV.REACTION_DB_PASSWORD,
      REACTION_DB_POOL_SIZE:
        input.REACTION_DB_POOL_SIZE ?? DEFAULT_TOOL_ENV.REACTION_DB_POOL_SIZE,
      MEILI_MASTER_KEY:
        input.MEILI_MASTER_KEY ?? DEFAULT_TOOL_ENV.MEILI_MASTER_KEY,
      SEQUIN_WEBHOOK_SECRET:
        input.SEQUIN_WEBHOOK_SECRET ?? DEFAULT_TOOL_ENV.SEQUIN_WEBHOOK_SECRET,
      SEQUIN_JOB_RUNNER_BASE_URL:
        input.SEQUIN_JOB_RUNNER_BASE_URL ??
        DEFAULT_TOOL_ENV.SEQUIN_JOB_RUNNER_BASE_URL,
    },
    schemaDatabaseNames,
    jobDatabaseName: DEFAULT_MANAGED_DATABASE_NAMES.job,
    managedDatabaseNames: [
      schemaDatabaseNames.server,
      schemaDatabaseNames.auth,
      DEFAULT_MANAGED_DATABASE_NAMES.job,
      schemaDatabaseNames.history,
      schemaDatabaseNames.notify,
      schemaDatabaseNames.reaction,
      schemaDatabaseNames.ranking,
    ],
    sourceVerifyEnv: {
      ENV: input.ENV ?? DEFAULT_TOOL_ENV.ENV,
      SOURCE_DB_HOST: "127.0.0.1",
      SOURCE_DB_PORT:
        input.SOURCE_DB_PORT_PUBLISHED ??
        input.SOURCE_DB_PORT ??
        DEFAULT_TOOL_ENV.SOURCE_DB_PORT,
      SOURCE_DB_NAME: sourceDbName,
      SOURCE_DB_USER: input.SOURCE_DB_USER ?? DEFAULT_TOOL_ENV.SOURCE_DB_USER,
      SOURCE_DB_PASSWORD: sourceDbPassword,
    },
  } as const;
}

export type ToolConfig = ReturnType<typeof createToolConfig>;
