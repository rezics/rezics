import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

describe("realm mutation meta.invalidates convention", () => {
  const source = readFileSync(
    join(import.meta.dir, "realm.mutations.ts"),
    "utf-8",
  );

  // ponytail: fails on old code (30+ manual invalidateQueries calls), passes on new
  // ponytail: 旧代码有 30+ 处手动 invalidateQueries 调用会失败，新代码通过
  test("no manual invalidateQueries calls — all invalidation goes through meta.invalidates", () => {
    expect(source).not.toContain("invalidateQueries");
  });

  test("syncRealmMembershipMutationCache helper is removed", () => {
    expect(source).not.toContain("syncRealmMembershipMutationCache");
  });
});
