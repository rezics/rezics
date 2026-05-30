import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertSequinRuntimeEnv,
  createToolConfig,
  type ToolConfig,
} from "../env";
import { runCommand, runCompose } from "./compose-runtime";

const TOOL_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const REPO_ROOT = path.resolve(TOOL_DIR, "..");
const SERVICE_DIR = path.join(TOOL_DIR, "dev-external-services");

export type ServiceCommand =
  | { kind: "up" }
  | { kind: "down" }
  | { kind: "logs"; services: string[] }
  | { kind: "ps" }
  | { kind: "health" }
  | { kind: "config-plan" }
  | { kind: "config-apply" }
  | { kind: "source-verify"; args: string[] }
  | { kind: "source-repair"; args: string[] };

function composeBaseArgs(config: ToolConfig) {
  return ["-p", config.services.composeProjectName, "-f", "compose.yml"];
}

function processEnv(
  input: Record<string, string | undefined>,
): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(input).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    ),
  );
}

function printLikelyPortConflict(command: ServiceCommand["kind"]) {
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

function runManagedCompose(
  command: ServiceCommand["kind"],
  args: string[],
  config: ToolConfig,
) {
  try {
    runCompose([...composeBaseArgs(config), ...args], {
      cwd: SERVICE_DIR,
      env: processEnv(config.composeEnv),
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

function execHealth(
  label: string,
  service: string,
  args: string[],
  config: ToolConfig,
) {
  console.log(`check ${label}`);
  runManagedCompose("health", ["exec", "-T", service, ...args], config);
}

async function checkHealth(config: ToolConfig) {
  execHealth(
    "source PostgreSQL",
    "source-postgres",
    ["pg_isready", "-U", "postgres", "-d", "rezics_server"],
    config,
  );
  await fetchHealth("Meilisearch", config.services.meiliHealthUrl);
  execHealth(
    "Sequin state PostgreSQL",
    "sequin-postgres",
    ["pg_isready", "-U", "sequin", "-d", "sequin"],
    config,
  );
  execHealth("Sequin Redis", "sequin-redis", ["redis-cli", "ping"], config);
  await fetchHealth("Sequin", config.services.sequinHealthUrl);
}

function runSourceScript(args: string[], config: ToolConfig) {
  runCommand(
    ["bun", "run", "tool/db-script/prepare-sequin-source.ts", ...args],
    {
      cwd: REPO_ROOT,
      env: processEnv(config.sourceVerifyEnv),
    },
  );
}

export async function runServiceCommand(
  command: ServiceCommand,
  config = createToolConfig(),
) {
  if (command.kind === "health") {
    await checkHealth(config);
    return;
  }

  if (command.kind === "source-verify") {
    runSourceScript(command.args, config);
    return;
  }

  if (command.kind === "source-repair") {
    runSourceScript(["--apply", "--dev-reset", ...command.args], config);
    return;
  }

  if (command.kind === "up") {
    assertSequinRuntimeEnv();
    runManagedCompose("up", ["up", "-d"], config);
    return;
  }

  if (command.kind === "down") {
    runManagedCompose("down", ["down"], config);
    return;
  }

  if (command.kind === "logs") {
    runManagedCompose("logs", ["logs", "-f", ...command.services], config);
    return;
  }

  if (command.kind === "ps") {
    runManagedCompose("ps", ["ps"], config);
    return;
  }

  if (command.kind === "config-plan") {
    runManagedCompose("config-plan", ["config"], config);
    return;
  }

  assertSequinRuntimeEnv();
  runManagedCompose("config-apply", ["up", "-d", "sequin"], config);
}
