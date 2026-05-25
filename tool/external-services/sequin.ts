import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  env as toolEnv,
  missingSequinEnv,
  SECRET_KEY_BASE_EXAMPLE,
  VAULT_KEY_EXAMPLE,
} from "../env";
import { detectComposeRuntime, runCompose } from "./compose-runtime";

const SCRIPT_DIR = path.dirname(Bun.main);
const TOOL_DIR = path.resolve(SCRIPT_DIR, "..");
const SERVICE_DIR = path.join(TOOL_DIR, "external-services", "sequin");
const HEALTH_URL_DEFAULT = "http://127.0.0.1:7376/health";

type Mode = "dev" | "prod";

function parseMode(args: string[]): { mode: Mode; args: string[] } {
  if (args.includes("--prod") || args.includes("--production")) {
    return {
      mode: "prod",
      args: args.filter((arg) => arg !== "--prod" && arg !== "--production"),
    };
  }

  return { mode: "dev", args };
}

function composeFiles(mode: Mode): string[] {
  const files = ["compose.yml"];
  if (mode === "dev") {
    files.push("compose.dev.yml");
  }
  return files.flatMap((file) => ["-f", file]);
}

function isSelinuxEnabled(): boolean {
  if (process.platform !== "linux") {
    return false;
  }

  const enforcePath = "/sys/fs/selinux/enforce";
  if (!existsSync(enforcePath)) {
    return false;
  }

  return readFileSync(enforcePath, "utf8").trim() === "1";
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
      "Generate real values with:",
      "  openssl rand -base64 48  # SECRET_KEY_BASE",
      "  openssl rand -base64 32  # VAULT_KEY",
    ].join("\n"),
  );
}

function localDefaults(runtimeHostAlias: string): NodeJS.ProcessEnv {
  return {
    ENV: toolEnv.ENV ?? "development",
    SOURCE_DB_HOST: toolEnv.SOURCE_DB_HOST ?? runtimeHostAlias,
    JOB_RUNNER_BASE_URL:
      toolEnv.JOB_RUNNER_BASE_URL ?? `http://${runtimeHostAlias}:3005`,
  };
}

async function checkHealth() {
  const url = toolEnv.SEQUIN_HEALTH_URL ?? HEALTH_URL_DEFAULT;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Sequin health check failed for ${url}: HTTP ${response.status}`,
    );
  }
  console.log(`Sequin is healthy: ${url}`);
}

function usage(): never {
  console.error(
    [
      "Usage: bun run tool/external-services/sequin.ts <command> [--prod]",
      "",
      "Commands:",
      "  up             Start Sequin, state Postgres, and Redis",
      "  down           Stop the stack",
      "  logs           Follow stack logs",
      "  health         Check the exposed Sequin /health endpoint",
      "  config plan    Render the compose plan",
      "  config apply   Recreate the Sequin service so CONFIG_FILE_PATH is applied",
    ].join("\n"),
  );
  process.exit(1);
}

function assertSequinEnv(mode: Mode) {
  const missing = missingSequinEnv(mode);
  if (missing.length === 0) {
    return;
  }

  throw new Error(
    [
      `Missing tool environment variables for Sequin ${mode}: ${missing.join(", ")}`,
      "Copy tool/.env.example to tool/.env and set the missing values.",
      "SEQUIN_WEBHOOK_SECRET must match package/job-runner/.env.",
    ].join("\n"),
  );
}

const { mode, args } = parseMode(process.argv.slice(2));
const [command, subcommand] = args;

if (!command) {
  usage();
}

if (command === "health") {
  await checkHealth();
  process.exit(0);
}

try {
  assertSequinEnv(mode);

  const runtime = detectComposeRuntime(toolEnv.CONTAINER_RUNTIME);
  const env: NodeJS.ProcessEnv = {
    ...(mode === "dev" ? localDefaults(runtime.hostAlias) : {}),
  };

  if (runtime.kind === "podman" && isSelinuxEnabled()) {
    env.SEQUIN_CONFIG_VOLUME_SUFFIX = "ro,Z";
  }

  const baseCommand = [...runtime.command, ...composeFiles(mode)] as [
    string,
    ...string[],
  ];

  if (command === "up") {
    assertRuntimeSecrets();
    runCompose([...baseCommand, "up", "-d"], { cwd: SERVICE_DIR, env });
  } else if (command === "down") {
    runCompose([...baseCommand, "down"], { cwd: SERVICE_DIR, env });
  } else if (command === "logs") {
    runCompose([...baseCommand, "logs", "-f"], { cwd: SERVICE_DIR, env });
  } else if (command === "config" && subcommand === "plan") {
    runCompose([...baseCommand, "config"], { cwd: SERVICE_DIR, env });
  } else if (command === "config" && subcommand === "apply") {
    assertRuntimeSecrets();
    runCompose([...baseCommand, "up", "-d", "sequin"], {
      cwd: SERVICE_DIR,
      env,
    });
  } else {
    usage();
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  console.error(
    "Check CONTAINER_RUNTIME, Docker/Podman compose installation, tool/.env, and package/job-runner/.env shared secrets.",
  );
  process.exit(1);
}
