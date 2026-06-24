import { describe, expect, test } from "bun:test";
import { join, resolve } from "node:path";
import { getRepoRoot, SEED_CACHE_DIR } from "./cache-dir";

describe("cache-dir", () => {
  test("finds the repo root through the package workspace directory", () => {
    const repoRoot = resolve(import.meta.dir, "../../../..");

    expect(getRepoRoot()).toBe(repoRoot);
    expect(SEED_CACHE_DIR).toBe(
      join(repoRoot, "node_modules", ".cache", "rezics-seed"),
    );
  });
});
