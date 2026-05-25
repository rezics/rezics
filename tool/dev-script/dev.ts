import path from "node:path";
import { compileLayout, LayoutCompileError } from "./layout-resolver";

const SCRIPT_DIR = path.dirname(Bun.main);
const TOOL_DIR = path.resolve(SCRIPT_DIR, "..");
const ROOT_DIR = path.resolve(TOOL_DIR, "..");

const platform = process.platform;

const DEV_SESSION_ENV_DENYLIST = [
  "CONTAINER_RUNTIME",
  "JOB_RUNNER_BASE_URL",
  "PG_PASSWORD",
  "PG_POOL_SIZE",
  "SECRET_KEY_BASE",
  "SEQUIN_CONFIG_VOLUME_SUFFIX",
  "SEQUIN_HEALTH_URL",
  "SEQUIN_WEBHOOK_SECRET",
  "SOURCE_DB_HOST",
  "SOURCE_DB_NAME",
  "SOURCE_DB_PASSWORD",
  "SOURCE_DB_POOL_SIZE",
  "SOURCE_DB_PORT",
  "SOURCE_DB_USER",
  "VAULT_KEY",
] as const;

function createDevSessionEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of DEV_SESSION_ENV_DENYLIST) {
    delete env[key];
  }
  return env;
}

function commandExists(cmd: string): boolean {
  const whichCmd = platform === "win32" ? "where" : "which";
  const result = Bun.spawnSync([whichCmd, cmd], {
    stdout: "pipe",
    stderr: "pipe",
  });
  return result.exitCode === 0;
}

function runZellijSessionCleanup(
  command: "kill-session" | "delete-session",
  sessionName: string,
): void {
  const result = Bun.spawnSync(["zellij", command, sessionName], {
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode === 0) {
    return;
  }

  const output =
    `${Buffer.from(result.stdout).toString()}\n${Buffer.from(result.stderr).toString()}`.trim();
  const isMissingSession =
    output.includes("No session named") ||
    output.includes("No session with the name") ||
    output.includes("No resurrectable session named");

  if (!isMissingSession && output) {
    console.warn(`Warning: failed to ${command} "${sessionName}": ${output}`);
  }
}

function clearExistingZellijSession(sessionName: string): void {
  runZellijSessionCleanup("kill-session", sessionName);
  runZellijSessionCleanup("delete-session", sessionName);
}

function printInstallInstructions(): void {
  console.error("Error: zellij is not installed.");
  if (platform === "win32") {
    console.error(
      "Download from: https://github.com/zellij-org/zellij/releases",
    );
  } else if (platform === "linux") {
    console.error(
      "Install it with: dnf install zellij  (or cargo install zellij)",
    );
  } else if (platform === "darwin") {
    console.error(
      "Install it with: brew install zellij  (or cargo install zellij)",
    );
  }
}

if (!commandExists("zellij")) {
  printInstallInstructions();
  process.exit(1);
}

const layout = path.join(TOOL_DIR, "dev-script", "layouts", "dev.kdl");
const sessionName = "rezics-dev";

let compiledLayoutPath: string | undefined;
let cleanup: (() => Promise<void>) | undefined;

try {
  clearExistingZellijSession(sessionName);

  const compiledLayout = await compileLayout(layout);
  compiledLayoutPath = compiledLayout.compiledLayoutPath;
  cleanup = compiledLayout.cleanup;

  const proc = Bun.spawn(
    [
      "zellij",
      "--new-session-with-layout",
      compiledLayoutPath,
      "--session",
      sessionName,
    ],
    {
      cwd: ROOT_DIR,
      env: createDevSessionEnv(),
      stdio: ["inherit", "inherit", "inherit"],
    },
  );
  await proc.exited;
} catch (error) {
  if (error instanceof LayoutCompileError) {
    console.error(error.message);
    process.exit(1);
  }

  throw error;
} finally {
  await cleanup?.();
}
