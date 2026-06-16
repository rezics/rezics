import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WORKBENCH_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(WORKBENCH_DIR, "../..");
const WORK_DIR = path.join(WORKBENCH_DIR, "work");

function resolveWorkScript(input: string | undefined) {
  if (!input) {
    throw new Error(
      "Pass a scratch script, for example: task browser:inspect -- current.ts",
    );
  }

  const candidate = path.isAbsolute(input)
    ? input
    : input.startsWith("tool/browser-inspect/work/")
      ? path.resolve(REPO_ROOT, input)
      : path.resolve(WORK_DIR, input);
  const relative = path.relative(WORK_DIR, candidate);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(
      `Browser inspect scripts must live under ${path.relative(REPO_ROOT, WORK_DIR)}`,
    );
  }

  return candidate;
}

try {
  const script = resolveWorkScript(Bun.argv[2]);
  const result = spawnSync("bun", ["run", script, ...Bun.argv.slice(3)], {
    cwd: REPO_ROOT,
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  process.exit(result.status ?? 1);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
