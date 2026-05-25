import path from "node:path";
import {
  missingSequinEnv,
  SECRET_KEY_BASE_EXAMPLE,
  env as toolEnv,
  VAULT_KEY_EXAMPLE,
} from "../env";
import { runCommand, runCompose } from "./compose-runtime";

const SCRIPT_DIR = path.dirname(Bun.main);
const TOOL_DIR = path.resolve(SCRIPT_DIR, "..");
const REPO_ROOT = path.resolve(TOOL_DIR, "..");
const SERVICE_DIR = path.join(TOOL_DIR, "external-services");
const COMPOSE_PROJECT_NAME = "rezics-external-services";
const DEFAULT_SEQUIN_HEALTH_URL = "http://127.0.0.1:7376/health";
const DEFAULT_MEILI_HEALTH_URL = "http://127.0.0.1:7700/health";

type ManagedCommand =
  | "up"
  | "down"
  | "logs"
  | "ps"
  | "health"
  | "config"
  | "source:verify"
  | "source:repair";

function composeBaseArgs() {
  return ["-p", COMPOSE_PROJECT_NAME, "-f", "compose.yml"];
}

function usage(): never {
  console.error(
    [
      "Usage: bun run tool/external-services/services.ts <command>",
      "",
      "Commands:",
      "  up                      Start Postgres, Meilisearch, Sequin state services, and Sequin",
      "  down                    Stop the managed stack",
      "  logs [service...]       Follow managed stack logs",
      "  ps                      Show managed stack services",
      "  health                  Check source Postgres, Meilisearch, Sequin state Postgres, and Sequin",
      "  config [plan]           Render the Docker Compose plan",
      "  config apply            Recreate Sequin so package/job-runner/sequin/sequin.yml is applied",
      "  source:verify           Verify source Postgres CDC readiness",
      "  source:repair [args...] Explicitly repair local source Postgres with --apply --dev-reset",
    ].join("\n"),
  );
  process.exit(1);
}

function assertRuntimeSecrets() {
  const badSecret =
    toolEnv.SECRET_KEY_BASE === SECRET_KEY_BASE_EXAMPLE ||
    toolEnv.VAULT_KEY === VAULT_KEY_EXAMPLE;

  if (!badSecret) {
    return;
  }

  throw new Error(
    [
      "Refusing to start Sequin with documented example secrets.",
      "Generate real local values with:",
      "  openssl rand -base64 48  # SECRET_KEY_BASE",
      "  openssl rand -base64 32  # VAULT_KEY",
    ].join("\n"),
  );
}

function assertSequinEnv() {
  const missing = missingSequinEnv("dev");
  if (missing.length === 0) {
    return;
  }

  throw new Error(
    [
      `Missing tool environment variables for managed services: ${missing.join(", ")}`,
      "Copy tool/.env.example to tool/.env and set the missing values.",
      "SEQUIN_WEBHOOK_SECRET must match package/job-runner/.env.",
    ].join("\n"),
  );
}

function composeEnv(): NodeJS.ProcessEnv {
  return {
    ENV: toolEnv.ENV ?? "development",
    PG_PASSWORD:
      toolEnv.PG_PASSWORD ?? "DO-NOT-USE-IN-PRODUCTION-sequin-state-postgres",
    SECRET_KEY_BASE: toolEnv.SECRET_KEY_BASE ?? SECRET_KEY_BASE_EXAMPLE,
    VAULT_KEY: toolEnv.VAULT_KEY ?? VAULT_KEY_EXAMPLE,
    SOURCE_DB_PASSWORD: toolEnv.SOURCE_DB_PASSWORD ?? "postgres",
    MEILI_MASTER_KEY: toolEnv.MEILI_MASTER_KEY ?? "masterKey",
    SEQUIN_WEBHOOK_SECRET:
      toolEnv.SEQUIN_WEBHOOK_SECRET ?? "change-me-sequin-webhook-secret",
    SEQUIN_JOB_RUNNER_BASE_URL:
      toolEnv.SEQUIN_JOB_RUNNER_BASE_URL ?? "http://host.docker.internal:3005",
  };
}

function sourceVerifyEnv(): NodeJS.ProcessEnv {
  return {
    ENV: toolEnv.ENV ?? "development",
    SOURCE_DB_HOST: "127.0.0.1",
    SOURCE_DB_PORT:
      toolEnv.SOURCE_DB_PORT_PUBLISHED ?? toolEnv.SOURCE_DB_PORT ?? "5432",
    SOURCE_DB_NAME: toolEnv.SOURCE_DB_NAME ?? "rezics_booklib",
    SOURCE_DB_USER: toolEnv.SOURCE_DB_USER ?? "postgres",
    SOURCE_DB_PASSWORD: toolEnv.SOURCE_DB_PASSWORD ?? "postgres",
  };
}

function printLikelyPortConflict(command: ManagedCommand) {
  if (command !== "up") {
    return;
  }

  console.error(
    [
      "",
      "If Docker reported that a port is already allocated, another process or container is likely using one of the managed defaults:",
      "  - source PostgreSQL: 127.0.0.1:5432",
      "  - Meilisearch:       127.0.0.1:7700",
      "  - Sequin:            127.0.0.1:7376",
      "Stop the conflicting service manually or override the published port in tool/.env.",
      "This workflow does not stop or reconfigure user-managed services.",
    ].join("\n"),
  );
}

function runManagedCompose(command: ManagedCommand, args: string[]) {
  try {
    runCompose([...composeBaseArgs(), ...args], {
      cwd: SERVICE_DIR,
      env: composeEnv(),
    });
  } catch (error) {
    printLikelyPortConflict(command);
    throw error;
  }
}

async function fetchHealth(label: string, url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${label} health check failed: HTTP ${response.status}`);
  }
  console.log(`ok    ${label}: ${url}`);
}

function execHealth(label: string, service: string, args: string[]) {
  console.log(`check ${label}`);
  runManagedCompose("health", ["exec", "-T", service, ...args]);
}

async function checkHealth() {
  execHealth("source PostgreSQL", "source-postgres", [
    "pg_isready",
    "-U",
    "postgres",
    "-d",
    "rezics_booklib",
  ]);
  await fetchHealth("Meilisearch", DEFAULT_MEILI_HEALTH_URL);
  execHealth("Sequin state PostgreSQL", "sequin-postgres", [
    "pg_isready",
    "-U",
    "sequin",
    "-d",
    "sequin",
  ]);
  await fetchHealth(
    "Sequin",
    toolEnv.SEQUIN_HEALTH_URL ?? DEFAULT_SEQUIN_HEALTH_URL,
  );
}

function runSourceScript(args: string[]) {
  runCommand(
    ["bun", "run", "tool/db-script/prepare-sequin-source.ts", ...args],
    {
      cwd: REPO_ROOT,
      env: sourceVerifyEnv(),
    },
  );
}

function parseCommand(args: string[]) {
  const [command, subcommand, ...rest] = args;
  if (!command) {
    usage();
  }

  if (command === "source" && subcommand === "verify") {
    return { command: "source:verify" as const, args: rest };
  }

  if (command === "source" && subcommand === "repair") {
    return { command: "source:repair" as const, args: rest };
  }

  return { command: command as ManagedCommand, subcommand, args: rest };
}

async function main() {
  const parsed = parseCommand(Bun.argv.slice(2));

  if (parsed.command === "health") {
    await checkHealth();
    return;
  }

  if (parsed.command === "source:verify") {
    runSourceScript(parsed.args);
    return;
  }

  if (parsed.command === "source:repair") {
    runSourceScript(["--apply", "--dev-reset", ...parsed.args]);
    return;
  }

  if (parsed.command === "up") {
    assertSequinEnv();
    assertRuntimeSecrets();
    runManagedCompose("up", ["up", "-d"]);
  } else if (parsed.command === "down") {
    runManagedCompose("down", ["down"]);
  } else if (parsed.command === "logs") {
    runManagedCompose(
      "logs",
      ["logs", "-f", parsed.subcommand, ...parsed.args].filter(Boolean),
    );
  } else if (parsed.command === "ps") {
    runManagedCompose("ps", ["ps"]);
  } else if (parsed.command === "config") {
    if (!parsed.subcommand || parsed.subcommand === "plan") {
      runManagedCompose("config", ["config"]);
    } else if (parsed.subcommand === "apply") {
      assertSequinEnv();
      assertRuntimeSecrets();
      runManagedCompose("config", ["up", "-d", "sequin"]);
    } else {
      usage();
    }
  } else {
    usage();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
