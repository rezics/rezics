import { readdirSync, readFileSync } from "node:fs";
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
const HYBRID_MIGRATED = [
  "zone/zone.mutations.ts",
  "progress/progress.mutations.ts",
  "shelf/shelf.mutations.ts",
  "realm/realm.mutations.ts",
  "reaction/reaction.mutations.ts",
  "post/post.mutations.ts",
  "book/book.mutations.ts",
  "chapter/chapter.mutations.ts",
  "link/link.mutations.ts",
  "jwt-service/jwt-service.mutations.ts",
  "auth-jwt-service/auth-jwt-service.mutations.ts",
  "token/token.mutations.ts",
  "entity/entity.mutations.ts",
  "feedback/feedback.mutations.ts",
  "tag/tag.mutations.ts",
  "dm/dm.mutations.ts",
  "poll/poll.mutations.ts",
  "unit-alias-record/unit-alias.mutations.ts",
  "user-tag-application/user-tag-application.mutations.ts",
  "comment/comment.mutations.ts",
  "user/user.mutations.ts",
  "realm/realm-dock.mutations.ts",
  "unit/translation-source.mutations.ts",
];

const ALL_MIGRATED = [...FULLY_MIGRATED, ...HYBRID_MIGRATED];

// Files that legitimately retain invalidateQueries in exported helpers
// for complex cross-domain or loop-based cache coherence that cannot be
// expressed as static meta.invalidates arrays.
// 保留 invalidateQueries 的文件——其导出辅助函数做复杂的跨域/循环缓存一致性，
// 无法用静态 meta.invalidates 数组表达。
const INVALIDATE_QUERIES_ALLOWLIST = new Set([
  "post/post.mutations.ts",
  "comment/comment.mutations.ts",
  "unit/unit.mutations.ts",
]);

const apiSrc = join(import.meta.dir, "../../package/api/src");

function allMutationFiles(): string[] {
  return (readdirSync(apiSrc, { recursive: true }) as string[])
    .filter(
      (f) =>
        f.endsWith(".mutations.ts") &&
        !f.endsWith(".test.ts") &&
        !f.endsWith(".spec.ts"),
    )
    .map((f) => f.replace(/\\/g, "/"));
}

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

  test("no mutation file calls invalidateQueries unless allowlisted", () => {
    const violations: string[] = [];
    for (const file of allMutationFiles()) {
      if (INVALIDATE_QUERIES_ALLOWLIST.has(file)) continue;
      const content = readFileSync(join(apiSrc, file), "utf-8");
      if (content.includes("invalidateQueries")) {
        violations.push(file);
      }
    }
    expect(violations).toEqual([]);
  });
});
