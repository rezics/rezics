import { describe, expect, test } from "bun:test";
import type { ScoreEntry } from "#/prisma/client";
import {
  applyDistributionDelta,
  applyFieldsDelta,
  computeAggregateFromEntries,
  validateFields,
  validateScore,
} from "./score.mapper";

describe("validateScore", () => {
  test("accepts integers 1-10", () => {
    for (let i = 1; i <= 10; i++) {
      expect(validateScore(i)).toBe(true);
    }
  });

  test("rejects 0 and 11", () => {
    expect(validateScore(0)).toBe(false);
    expect(validateScore(11)).toBe(false);
  });

  test("rejects non-integers", () => {
    expect(validateScore(5.5)).toBe(false);
    expect(validateScore(NaN)).toBe(false);
  });
});

describe("validateFields", () => {
  const allowed = new Set(["pacing", "plot", "characters"]);

  test("valid fields accepted", () => {
    const result = validateFields({ pacing: 7, plot: 9 }, allowed);
    expect(result.valid).toBe(true);
    expect(result.invalidKeys).toEqual([]);
  });

  test("unregistered key rejected", () => {
    const result = validateFields({ pacing: 7, unknown: 5 }, allowed);
    expect(result.valid).toBe(false);
    expect(result.invalidKeys).toContain("unknown");
  });

  test("out-of-range value rejected", () => {
    const result = validateFields({ pacing: 15 }, allowed);
    expect(result.valid).toBe(false);
    expect(result.invalidKeys).toContain("pacing");
  });
});

describe("applyDistributionDelta", () => {
  test("adds new value", () => {
    const dist = applyDistributionDelta({}, null, 8);
    expect(dist).toEqual({ "8": 1 });
  });

  test("removes old value", () => {
    const dist = applyDistributionDelta({ "8": 2 }, 8, null);
    expect(dist).toEqual({ "8": 1 });
  });

  test("removes bucket when count reaches zero", () => {
    const dist = applyDistributionDelta({ "8": 1 }, 8, null);
    expect(dist).toEqual({});
  });

  test("handles update (old → new)", () => {
    const dist = applyDistributionDelta({ "7": 2, "8": 1 }, 7, 9);
    expect(dist).toEqual({ "7": 1, "8": 1, "9": 1 });
  });
});

describe("applyFieldsDelta", () => {
  test("creates field aggregate on first score", () => {
    const result = applyFieldsDelta(null, null, { pacing: 7 });
    expect(result).toEqual({
      pacing: { total: 7, count: 1, dist: { "7": 1 } },
    });
  });

  test("updates existing field aggregate", () => {
    const current = {
      pacing: { total: 14, count: 2, dist: { "7": 2 } },
    };
    const result = applyFieldsDelta(current, null, { pacing: 9 });
    expect(result).toEqual({
      pacing: { total: 23, count: 3, dist: { "7": 2, "9": 1 } },
    });
  });

  test("handles score update delta for fields", () => {
    const current = {
      pacing: { total: 14, count: 2, dist: { "7": 2 } },
    };
    const result = applyFieldsDelta(current, { pacing: 7 }, { pacing: 9 });
    expect(result).toEqual({
      pacing: { total: 16, count: 2, dist: { "7": 1, "9": 1 } },
    });
  });

  test("partial field update removes omitted fields", () => {
    const current = {
      pacing: { total: 7, count: 1, dist: { "7": 1 } },
      plot: { total: 8, count: 1, dist: { "8": 1 } },
    };
    const result = applyFieldsDelta(
      current,
      { pacing: 7, plot: 8 },
      { pacing: 9 },
    );
    expect(result).toEqual({
      pacing: { total: 9, count: 1, dist: { "9": 1 } },
    });
  });

  test("returns null when all fields removed", () => {
    const current = {
      pacing: { total: 7, count: 1, dist: { "7": 1 } },
    };
    const result = applyFieldsDelta(current, { pacing: 7 }, null);
    expect(result).toBeNull();
  });
});

describe("computeAggregateFromEntries", () => {
  function makeEntry(
    overrides: Partial<ScoreEntry> & { value: number },
  ): ScoreEntry {
    return {
      id: "test-id",
      userId: "user-1",
      unitId: "unit-1",
      realm: "realm-1",
      fields: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as ScoreEntry;
  }

  test("computes from multiple entries", () => {
    const entries = [
      makeEntry({ value: 7 }),
      makeEntry({ value: 8 }),
      makeEntry({ value: 7 }),
    ];
    const result = computeAggregateFromEntries(entries);
    expect(result.totalScore).toBe(22);
    expect(result.totalCount).toBe(3);
    expect(result.distribution).toEqual({ "7": 2, "8": 1 });
    expect(result.fields).toBeNull();
  });

  test("computes field aggregates", () => {
    const entries = [
      makeEntry({ value: 7, fields: { pacing: 8, plot: 9 } }),
      makeEntry({ value: 8, fields: { pacing: 6 } }),
    ];
    const result = computeAggregateFromEntries(entries);
    expect(result.fields).toEqual({
      pacing: { total: 14, count: 2, dist: { "8": 1, "6": 1 } },
      plot: { total: 9, count: 1, dist: { "9": 1 } },
    });
  });

  test("empty entries", () => {
    const result = computeAggregateFromEntries([]);
    expect(result.totalScore).toBe(0);
    expect(result.totalCount).toBe(0);
    expect(result.distribution).toEqual({});
    expect(result.fields).toBeNull();
  });
});
