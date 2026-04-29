import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function findRepoRoot(start: string): string {
  let dir = start;
  while (true) {
    if (
      existsSync(join(dir, "package.json")) &&
      existsSync(join(dir, "tool")) &&
      statSync(join(dir, "tool")).isDirectory()
    ) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        "Could not locate rezics repo root from " + start,
      );
    }
    dir = parent;
  }
}

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = findRepoRoot(resolve(here));

export const SEED_CACHE_DIR = join(
  REPO_ROOT,
  "node_modules",
  ".cache",
  "rezics-seed",
);

export function getRepoRoot(): string {
  return REPO_ROOT;
}
