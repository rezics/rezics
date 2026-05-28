import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./paths";
import type { Violation } from "./types";

export const SNAPSHOT_PATH = join(
  REPO_ROOT,
  "tool/scripts/expected-violations.json",
);

export interface ViolationSnapshot {
  total: number;
  byRule: Record<string, number>;
  keys: string[];
}

export function loadSnapshot(): ViolationSnapshot | null {
  if (!existsSync(SNAPSHOT_PATH)) return null;
  try {
    return JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8")) as ViolationSnapshot;
  } catch {
    return null;
  }
}

export function buildSnapshot(violations: Violation[]): ViolationSnapshot {
  const byRule: Record<string, number> = {};
  const keys: string[] = [];
  for (const v of violations) {
    byRule[v.rule] = (byRule[v.rule] ?? 0) + 1;
    keys.push(`${v.rule}  ${v.path}`);
  }
  keys.sort();
  return { total: violations.length, byRule, keys };
}

export function saveSnapshot(snapshot: ViolationSnapshot): void {
  const withNote = {
    _note:
      "TEMPORARY BASELINE. This snapshot exists only to block NEW violations from accumulating while a migration is in progress. Delete this file once the migration lands.",
    ...snapshot,
  };
  writeFileSync(
    SNAPSHOT_PATH,
    `${JSON.stringify(withNote, null, 2)}\n`,
    "utf8",
  );
}
