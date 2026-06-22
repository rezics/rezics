/**
 * Convention: shelf mutation hooks must use meta.invalidates for cache
 * invalidation. No manual invalidateQueries calls should exist.
 * 约定：shelf mutation hooks 必须使用 meta.invalidates 进行缓存失效。
 * 不得存在手动的 invalidateQueries 调用。
 */

import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import { join } from "node:path";

const source = readFileSync(
  join(import.meta.dir, "shelf.mutations.ts"),
  "utf-8",
);

describe("shelf mutation meta.invalidates convention", () => {
  test("no manual invalidateQueries calls", () => {
    expect(source).not.toContain("invalidateQueries");
  });

  test("invalidateShelfSurfaces helper is removed", () => {
    expect(source).not.toContain("invalidateShelfSurfaces");
  });

  test("invalidateShelfDetail helper is removed", () => {
    expect(source).not.toContain("invalidateShelfDetail");
  });

  test("shelfItemStatusKeys not imported (covered by cacheDomainKeys)", () => {
    expect(source).not.toContain("shelfItemStatusKeys");
  });
});
