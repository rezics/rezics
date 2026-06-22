/**
 * Convention: CRUD mutation hooks must use meta.invalidates for cache
 * invalidation. No manual invalidateQueries calls should exist.
 * 约定：CRUD mutation hooks 必须使用 meta.invalidates 进行缓存失效。
 * 不得存在手动的 invalidateQueries 调用。
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

const files = [
  "book/book.mutations.ts",
  "chapter/chapter.mutations.ts",
  "link/link.mutations.ts",
  "jwt-service/jwt-service.mutations.ts",
  "auth-jwt-service/auth-jwt-service.mutations.ts",
  "token/token.mutations.ts",
  "entity/entity.mutations.ts",
  "feedback/feedback.mutations.ts",
] as const;

function read(rel: string) {
  return readFileSync(join(import.meta.dir, "..", rel), "utf-8");
}

describe("CRUD mutation meta.invalidates convention", () => {
  for (const file of files) {
    const domain = file.split("/")[0];
    const src = read(file);

    test(`${domain}: no manual invalidateQueries calls`, () => {
      expect(src).not.toContain("invalidateQueries");
    });

    test(`${domain}: uses meta.invalidates`, () => {
      expect(src).toContain("meta:");
      expect(src).toContain("invalidates:");
    });
  }

  test("entity: invalidateEntityQueryGroups helper is removed", () => {
    const src = read("entity/entity.mutations.ts");
    expect(src).not.toContain("invalidateEntityQueryGroups");
  });
});
