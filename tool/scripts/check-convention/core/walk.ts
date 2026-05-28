import { execSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT, isExemptPath } from "./paths";

export function* walkDirectories(root: string): Generator<string> {
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return;
  }
  for (const entryName of entries) {
    const entryPath = join(root, entryName);
    try {
      if (!statSync(entryPath).isDirectory()) continue;
    } catch {
      continue;
    }
    if (isExemptPath(entryPath)) continue;
    yield entryPath;
    yield* walkDirectories(entryPath);
  }
}

export function* walkFilesByExtension(
  root: string,
  pattern: RegExp,
): Generator<string> {
  let entries: string[];
  try {
    entries = readdirSync(root);
  } catch {
    return;
  }
  for (const entryName of entries) {
    const entryPath = join(root, entryName);
    let entryStat: ReturnType<typeof statSync>;
    try {
      entryStat = statSync(entryPath);
    } catch {
      continue;
    }
    if (entryStat.isDirectory()) {
      if (isExemptPath(entryPath)) continue;
      yield* walkFilesByExtension(entryPath, pattern);
    } else if (pattern.test(entryName)) {
      yield entryPath;
    }
  }
}

export function getStagedFilePaths(): string[] {
  try {
    const output = execSync(
      "git diff --cached --name-only --diff-filter=ACMR",
      { cwd: REPO_ROOT, encoding: "utf8" },
    );
    return output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((relPath) => join(REPO_ROOT, relPath));
  } catch {
    return [];
  }
}
