import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertSequinRuntimeEnv,
  createToolConfig,
  type ToolConfig,
} from "../../env";
import { runCommand, runCompose } from "./runtime";

const TOOL_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const REPO_ROOT = path.resolve(TOOL_DIR, "..");
const SERVICE_DIR = path.join(TOOL_DIR, "service");

export type ServiceCommand =
  | { kind: "up" }
  | { kind: "down" }
  | { kind: "logs"; services: string[]; tail?: number }
  | { kind: "ps" }
  | { kind: "health" }
  | { kind: "config-plan" }
  | { kind: "config-apply" }
  | {
      kind: "cdc-verify";
      source?: "source" | "reaction";
      sourceUrl?: string;
      reactionUrl?: string;
    }
  | {
      kind: "cdc-repair";
      source?: "source" | "reaction";
      sourceUrl?: string;
      reactionUrl?: string;
      forceActiveSlot?: boolean;
    }
  | {
      kind: "cdc-recover";
      source?: "source" | "reaction";
      sourceUrl?: string;
      reactionUrl?: string;
      forceActiveSlot?: boolean;
      logTail?: number;
    }
  | { kind: "source-verify"; url?: string }
  | { kind: "source-repair"; url?: string; forceActiveSlot?: boolean };

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

async function waitForHealth(label: string, url: string) {
  const deadline = Date.now() + 30_000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      await fetchHealth(label, url);
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`${label} health check timed out`);
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

function sourceScriptArgs(
  command: Extract<ServiceCommand, { kind: "source-verify" | "source-repair" }>,
) {
  const args: string[] = [];
  if (command.kind === "source-repair") {
    args.push("--apply", "--dev-reset");
  }
  if (command.url) {
    args.push(`--url=${command.url}`);
  }
  if (command.kind === "source-repair" && command.forceActiveSlot) {
    args.push("--force-active-slot");
  }
  return args;
}

function cdcScriptArgs(
  command: Extract<ServiceCommand, { kind: "cdc-verify" | "cdc-repair" }>,
) {
  const args: string[] = [];
  if (command.kind === "cdc-repair") {
    args.push("--apply", "--dev-reset");
  }
  if (command.source) {
    args.push(`--source=${command.source}`);
  }
  if (command.sourceUrl) {
    args.push(`--source-url=${command.sourceUrl}`);
  }
  if (command.reactionUrl) {
    args.push(`--reaction-url=${command.reactionUrl}`);
  }
  if (command.kind === "cdc-repair" && command.forceActiveSlot) {
    args.push("--force-active-slot");
  }
  return args;
}

function runCdcScript(
  command: Extract<ServiceCommand, { kind: "cdc-verify" | "cdc-repair" }>,
  config: ToolConfig,
) {
  runCommand(
    [
      "bun",
      "run",
      "tool/src/commands/service/cdc.ts",
      ...cdcScriptArgs(command),
    ],
    {
      cwd: REPO_ROOT,
      env: processEnv(config.sourceVerifyEnv),
    },
  );
}

async function runCdcRecover(
  command: Extract<ServiceCommand, { kind: "cdc-recover" }>,
  config: ToolConfig,
) {
  assertSequinRuntimeEnv();
  const sources = command.source ? command.source : "all sources";
  console.log(
    `Recovering Sequin CDC for ${sources}: stop Sequin, repair source objects, restart Sequin, verify.`,
  );
  try {
    runManagedCompose("down", ["stop", "sequin"], config);
    runCdcScript({ ...command, kind: "cdc-repair" }, config);
    runManagedCompose("config-apply", ["up", "-d", "sequin"], config);
    await waitForHealth("Sequin", config.services.sequinHealthUrl);
    runCdcScript({ ...command, kind: "cdc-verify" }, config);
  } catch (error) {
    const tail = command.logTail ?? 200;
    console.error("");
    console.error(
      `CDC recovery failed. Recent Sequin logs (tail ${tail}) follow:`,
    );
    try {
      runManagedCompose(
        "logs",
        ["logs", "--tail", String(tail), "sequin"],
        config,
      );
    } catch {
      // Preserve the original recovery failure.
    }
    throw error;
  }
}

function runSourceScript(
  command: Extract<ServiceCommand, { kind: "source-verify" | "source-repair" }>,
  config: ToolConfig,
) {
  runCommand(
    [
      "bun",
      "run",
      "tool/src/commands/service/source.ts",
      ...sourceScriptArgs(command),
    ],
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

  if (command.kind === "cdc-verify") {
    runCdcScript(command, config);
    return;
  }

  if (command.kind === "cdc-repair") {
    runCdcScript(command, config);
    return;
  }

  if (command.kind === "cdc-recover") {
    await runCdcRecover(command, config);
    return;
  }

  if (command.kind === "source-verify") {
    runSourceScript(command, config);
    return;
  }

  if (command.kind === "source-repair") {
    runSourceScript(command, config);
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
    runManagedCompose(
      "logs",
      [
        "logs",
        ...(command.tail ? ["--tail", String(command.tail)] : ["-f"]),
        ...command.services,
      ],
      config,
    );
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
