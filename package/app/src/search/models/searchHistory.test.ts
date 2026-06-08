import { beforeEach, describe, expect, test } from "bun:test";
import {
  clearSearchHistory,
  pushSearchHistory,
  readSearchHistory,
  removeSearchHistory,
} from "./searchHistory";

function installStorage(): void {
  const store = new Map<string, string>();
  globalThis.window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    } as Storage,
  } as unknown as Window & typeof globalThis;
}

describe("search history model", () => {
  beforeEach(() => {
    installStorage();
  });

  test("starts empty", () => {
    expect(readSearchHistory()).toEqual([]);
  });

  test("records most-recent first", () => {
    pushSearchHistory("alpha");
    pushSearchHistory("beta");
    expect(readSearchHistory()).toEqual(["beta", "alpha"]);
  });

  test("dedupes case-insensitively and moves match to front", () => {
    pushSearchHistory("alpha");
    pushSearchHistory("beta");
    pushSearchHistory("ALPHA");
    expect(readSearchHistory()).toEqual(["ALPHA", "beta"]);
  });

  test("ignores empty/whitespace terms", () => {
    pushSearchHistory("   ");
    expect(readSearchHistory()).toEqual([]);
  });

  test("caps at eight entries", () => {
    for (let i = 0; i < 12; i++) pushSearchHistory(`term-${i}`);
    expect(readSearchHistory()).toHaveLength(8);
    // newest retained, oldest dropped
    // 保留最新的，丢弃最旧的
    expect(readSearchHistory()[0]).toBe("term-11");
    expect(readSearchHistory()).not.toContain("term-0");
  });

  test("removes a single entry", () => {
    pushSearchHistory("alpha");
    pushSearchHistory("beta");
    removeSearchHistory("ALPHA");
    expect(readSearchHistory()).toEqual(["beta"]);
  });

  test("clears all entries", () => {
    pushSearchHistory("alpha");
    clearSearchHistory();
    expect(readSearchHistory()).toEqual([]);
  });
});
