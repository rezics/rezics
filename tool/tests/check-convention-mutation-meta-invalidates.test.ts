import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

// Files fully migrated: no useQueryClient at all.
// 完全迁移的文件：不使用 useQueryClient。
const FULLY_MIGRATED = [
  "subscription/subscription.mutations.ts",
  "label/label.mutations.ts",
  "block/block.mutations.ts",
  "score/score.mutations.ts",
  "content-structure/content-structure.mutations.ts",
  "series-unit/series.mutations.ts",
  "entity-attribution/entity-attribution.mutations.ts",
  "credit-attribution/credit-attribution.mutations.ts",
  "subject-attribution/subject-attribution.mutations.ts",
  "realm-tag-tree/realm-tag-tree.mutations.ts",
  "pinboard/pinboard.mutations.ts",
  "account-operation/account-operation.mutations.ts",
  "notification/notification.mutations.ts",
  "policy-tag/policy-tag.mutations.ts",
  "unit-external-link/unit-external-link.mutations.ts",
  "unit/authority.mutations.ts",
  "realm/realm-extra.mutations.ts",
  "auth/auth.mutations.ts",
  "governance/governance.mutations.ts",
];

// Files using meta.invalidates but retaining useQueryClient for
// removeQueries/setQueryData (hybrid).
// 使用 meta.invalidates 但保留 useQueryClient 做 removeQueries/setQueryData 的文件。
const HYBRID_MIGRATED = ["zone/zone.mutations.ts"];

const ALL_MIGRATED = [...FULLY_MIGRATED, ...HYBRID_MIGRATED];

const apiSrc = join(import.meta.dir, "../../package/api/src");

describe("meta.invalidates migration", () => {
  test("fully migrated files do not import useQueryClient", () => {
    const violations: string[] = [];
    for (const rel of FULLY_MIGRATED) {
      const content = readFileSync(join(apiSrc, rel), "utf-8");
      const codeLines = content
        .split("\n")
        .filter((l) => !l.trimStart().startsWith("//"));
      if (codeLines.some((l) => l.includes("useQueryClient"))) {
        violations.push(rel);
      }
    }
    expect(violations).toEqual([]);
  });

  test("all migrated files declare meta.invalidates", () => {
    const missing: string[] = [];
    for (const rel of ALL_MIGRATED) {
      const content = readFileSync(join(apiSrc, rel), "utf-8");
      if (!content.includes("invalidates")) {
        missing.push(rel);
      }
    }
    expect(missing).toEqual([]);
  });
});
