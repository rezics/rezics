import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { detectComposeRuntime, runCompose } from "./compose-runtime";

const SCRIPT_DIR = path.dirname(Bun.main);
const TOOL_DIR = path.resolve(SCRIPT_DIR, "..");
const ROOT_DIR = path.resolve(TOOL_DIR, "..");
const SERVICE_DIR = path.join(TOOL_DIR, "external-services", "sequin");
const JOB_RUNNER_ENV = path.join(ROOT_DIR, "package", "job-runner", ".env");
const HEALTH_URL_DEFAULT = "http://127.0.0.1:7376/health";
const SECRET_KEY_BASE_EXAMPLE = "DO-NOT-USE-IN-PRODUCTION-secret-key-base";
const VAULT_KEY_EXAMPLE = "DO-NOT-USE-IN-PRODUCTION-vault-key";

type Mode = "dev" | "prod";

if (existsSync(JOB_RUNNER_ENV)) {
  loadDotenv({ path: JOB_RUNNER_ENV });
}

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
    process.env.SECRET_KEY_BASE === SECRET_KEY_BASE_EXAMPLE ||
    process.env.VAULT_KEY === VAULT_KEY_EXAMPLE;

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
    ENV: process.env.ENV ?? "development",
    SOURCE_DB_HOST: process.env.SOURCE_DB_HOST ?? runtimeHostAlias,
    JOB_RUNNER_BASE_URL:
      process.env.JOB_RUNNER_BASE_URL ?? `http://${runtimeHostAlias}:3005`,
  };
}

async function checkHealth() {
  const url = process.env.SEQUIN_HEALTH_URL ?? HEALTH_URL_DEFAULT;
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

const { mode, args } = parseMode(process.argv.slice(2));
const [command, subcommand] = args;

if (!command) {
  usage();
}

if (command === "health") {
  await checkHealth();
  process.exit(0);
}

const runtime = detectComposeRuntime();
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

try {
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
    "Check CONTAINER_RUNTIME, Docker/Podman compose installation, required Sequin env vars, and package/job-runner/.env.",
  );
  process.exit(1);
}
