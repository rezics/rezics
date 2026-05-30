import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCommand } from "../commands/service/runtime";

const TOOL_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
export const REPO_ROOT = path.resolve(TOOL_DIR, "..");

export function runRepoScript(args: string[]): void {
  runCommand(["bun", "run", ...args], { cwd: REPO_ROOT });
}
