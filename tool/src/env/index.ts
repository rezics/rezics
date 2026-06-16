import path from "node:path";
import { fileURLToPath } from "node:url";
import { createEnv } from "@t3-oss/env-core";
import * as v from "valibot";

const TOOL_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
export const TOOL_ROOT = TOOL_DIR;

export const env = createEnv({
  server: {
    // Postgres connection defaults match deploy/dev/variables.hcl
    // Postgres 连接默认值与 deploy/dev/variables.hcl 一致
    SOURCE_DB_HOST: v.optional(v.string()),
    SOURCE_DB_PORT: v.optional(v.string()),
    SOURCE_DB_NAME: v.optional(v.string()),
    SOURCE_DB_USER: v.optional(v.string()),
    SOURCE_DB_PASSWORD: v.optional(v.string()),
    REACTION_DB_HOST: v.optional(v.string()),
    REACTION_DB_PORT: v.optional(v.string()),
    REACTION_DB_NAME: v.optional(v.string()),
    REACTION_DB_USER: v.optional(v.string()),
    REACTION_DB_PASSWORD: v.optional(v.string()),
    SEQUIN_HEALTH_URL: v.optional(v.string()),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

export type ToolEnv = typeof env;

const DEFAULT_TOOL_ENV = {
  SOURCE_DB_HOST: "127.0.0.1",
  SOURCE_DB_PORT: "5432",
  SOURCE_DB_NAME: "rezics_server",
  SOURCE_DB_USER: "postgres",
  SOURCE_DB_PASSWORD: "postgres",
  REACTION_DB_HOST: "127.0.0.1",
  REACTION_DB_PORT: "5432",
  REACTION_DB_NAME: "rezics_reaction",
  REACTION_DB_USER: "postgres",
  REACTION_DB_PASSWORD: "postgres",
  SEQUIN_HEALTH_URL: "http://127.0.0.1:7376/health",
} as const;

const DEFAULT_MANAGED_DATABASE_NAMES = {
  auth: "rezics_auth",
  job: "rezics_jobs",
  history: "rezics_history",
  notify: "rezics_notify",
  ranking: "rezics_ranking",
} as const;

export function createToolConfig(input: ToolEnv = env) {
  const sourceDbHost = input.SOURCE_DB_HOST ?? DEFAULT_TOOL_ENV.SOURCE_DB_HOST;
  const sourceDbPort = input.SOURCE_DB_PORT ?? DEFAULT_TOOL_ENV.SOURCE_DB_PORT;
  const sourceDbUser = input.SOURCE_DB_USER ?? DEFAULT_TOOL_ENV.SOURCE_DB_USER;
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
    postgres: {
      host: sourceDbHost,
      port: sourceDbPort,
      user: sourceDbUser,
      password: sourceDbPassword,
    },
    services: {
      sequinHealthUrl:
        input.SEQUIN_HEALTH_URL ?? DEFAULT_TOOL_ENV.SEQUIN_HEALTH_URL,
      meiliHealthUrl: "http://127.0.0.1:7700/health",
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
      SOURCE_DB_HOST: sourceDbHost,
      SOURCE_DB_PORT: sourceDbPort,
      SOURCE_DB_NAME: sourceDbName,
      SOURCE_DB_USER: sourceDbUser,
      SOURCE_DB_PASSWORD: sourceDbPassword,
      REACTION_DB_HOST:
        input.REACTION_DB_HOST ?? DEFAULT_TOOL_ENV.REACTION_DB_HOST,
      REACTION_DB_PORT:
        input.REACTION_DB_PORT ?? DEFAULT_TOOL_ENV.REACTION_DB_PORT,
      REACTION_DB_NAME: reactionDbName,
      REACTION_DB_USER:
        input.REACTION_DB_USER ??
        input.SOURCE_DB_USER ??
        DEFAULT_TOOL_ENV.REACTION_DB_USER,
      REACTION_DB_PASSWORD:
        input.REACTION_DB_PASSWORD ??
        input.SOURCE_DB_PASSWORD ??
        DEFAULT_TOOL_ENV.REACTION_DB_PASSWORD,
    },
  } as const;
}

export type ToolConfig = ReturnType<typeof createToolConfig>;
