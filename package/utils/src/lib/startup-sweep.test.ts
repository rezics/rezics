import { afterEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { SEED_CACHE_DIR } from "./cache-dir";
import { sweepStaleEditDirs } from "./startup-sweep";

const TEST_DIR_PREFIX = "edit-test-";

function makeFakeEditDir(name: string, ageMs: number): string {
  mkdirSync(SEED_CACHE_DIR, { recursive: true });
  const path = join(SEED_CACHE_DIR, name);
  mkdirSync(path, { recursive: true });
  writeFileSync(join(path, "plan.json"), "{}", "utf8");
  const past = (Date.now() - ageMs) / 1000;
  utimesSync(path, past, past);
  return path;
}

function listTestDirs(): string[] {
  try {
    const { readdirSync } = require("node:fs") as typeof import("node:fs");
    return readdirSync(SEED_CACHE_DIR).filter((entry) =>
      entry.startsWith(TEST_DIR_PREFIX),
    );
  } catch {
    return [];
  }
}

afterEach(() => {
  for (const entry of listTestDirs()) {
    rmSync(join(SEED_CACHE_DIR, entry), { recursive: true, force: true });
  }
});

describe("sweepStaleEditDirs", () => {
  test("removes edit-* dirs older than 1 hour", () => {
    const stale = makeFakeEditDir(
      `${TEST_DIR_PREFIX}stale-${Date.now()}`,
      2 * 60 * 60 * 1000,
    );
    sweepStaleEditDirs();
    expect(existsSync(stale)).toBe(false);
  });

  test("preserves recent edit-* dirs", () => {
    const fresh = makeFakeEditDir(
      `${TEST_DIR_PREFIX}fresh-${Date.now()}`,
      5 * 60 * 1000,
    );
    sweepStaleEditDirs();
    expect(existsSync(fresh)).toBe(true);
  });

  test("ignores non edit-* entries", () => {
    mkdirSync(SEED_CACHE_DIR, { recursive: true });
    const path = join(SEED_CACHE_DIR, `keep-test-${Date.now()}`);
    mkdirSync(path, { recursive: true });
    const past = (Date.now() - 10 * 60 * 60 * 1000) / 1000;
    utimesSync(path, past, past);
    sweepStaleEditDirs();
    expect(existsSync(path)).toBe(true);
    rmSync(path, { recursive: true, force: true });
  });

  test("does not throw when cache dir is missing", () => {
    expect(() => sweepStaleEditDirs()).not.toThrow();
  });
});
