import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createToolConfig, type ToolConfig } from "../../env";
import { runCommand } from "./runtime";

const TOOL_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const REPO_ROOT = path.resolve(TOOL_DIR, "..");

export type ServiceCommand =
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

function processEnv(
  input: Record<string, string | undefined>,
): NodeJS.ProcessEnv {
  return Object.fromEntries(
    Object.entries(input).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    ),
  );
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

function findSequinAllocId(): string | undefined {
  const result = spawnSync("nomad", ["job", "allocs", "-json", "rezics-dev"], {
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.status !== 0) return undefined;
  try {
    const allocs = JSON.parse(result.stdout.toString());
    const alloc = allocs.find(
      (a: { TaskGroup: string; ClientStatus: string }) =>
        a.TaskGroup === "sequin" && a.ClientStatus === "running",
    );
    return alloc?.ID;
  } catch {
    return undefined;
  }
}

function restartSequinTask(allocId: string) {
  spawnSync("nomad", ["alloc", "restart", "-task", "sequin", allocId], {
    stdio: "inherit",
  });
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
  const sources = command.source ? command.source : "all sources";
  console.log(
    `Recovering Sequin CDC for ${sources}: restart Sequin via Nomad, repair source objects, verify.`,
  );

  const allocId = findSequinAllocId();
  if (!allocId) {
    throw new Error(
      "No running Sequin allocation found. Ensure `task dev` is running.",
    );
  }

  try {
    runCdcScript({ ...command, kind: "cdc-repair" }, config);
    console.log("Restarting Sequin via Nomad...");
    restartSequinTask(allocId);
    await waitForHealth("Sequin", config.services.sequinHealthUrl);
    runCdcScript({ ...command, kind: "cdc-verify" }, config);
  } catch (error) {
    console.error("");
    console.error("CDC recovery failed.");
    throw error;
  }
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
}
