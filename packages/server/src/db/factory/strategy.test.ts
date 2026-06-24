import { describe, expect, test } from "bun:test";
import * as v from "valibot";
import { CountSpecSchema, makeCountProvider } from "./strategy";

describe("makeCountProvider", () => {
  describe("fixed mode", () => {
    test("returns target verbatim when within bounds", () => {
      const provider = makeCountProvider("fixed");
      const spec = { min: 0, max: 100, target: 5 };
      for (let i = 0; i < 1000; i++) {
        expect(provider.draw(spec)).toBe(5);
      }
    });

    test("falls back to midpoint when target is missing", () => {
      const provider = makeCountProvider("fixed");
      expect(provider.draw({ min: 2, max: 10 })).toBe(6);
      expect(provider.draw({ max: 10 })).toBe(5);
    });

    test("clamps target to [min, max]", () => {
      const provider = makeCountProvider("fixed");
      expect(provider.draw({ min: 5, max: 10, target: 1 })).toBe(5);
      expect(provider.draw({ min: 5, max: 10, target: 100 })).toBe(10);
    });
  });

  describe("uniform mode", () => {
    test("covers the full range and stays bounded", () => {
      const provider = makeCountProvider("uniform");
      const spec = { min: 0, max: 20 };
      const counts = new Map<number, number>();
      for (let i = 0; i < 10000; i++) {
        const v = provider.draw(spec);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(20);
        expect(Number.isInteger(v)).toBe(true);
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      // Every integer in [0, 20] should appear at least 100 times.
      // [0, 20] 范围内的每个整数都应至少出现 100 次。
      for (let i = 0; i <= 20; i++) {
        expect(counts.get(i) ?? 0).toBeGreaterThanOrEqual(100);
      }
    });
  });

  describe("realistic mode", () => {
    test("stays within [min, max]", () => {
      const provider = makeCountProvider("realistic");
      const spec = { min: 0, max: 50, alpha: 1.8 };
      for (let i = 0; i < 10000; i++) {
        const v = provider.draw(spec);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(50);
      }
    });

    test("skews toward the minimum", () => {
      const provider = makeCountProvider("realistic");
      const spec = { min: 0, max: 50, alpha: 1.8 };
      let nearMin = 0;
      for (let i = 0; i < 10000; i++) {
        if (provider.draw(spec) <= 5) nearMin++;
      }
      // Uniform would give ~5/51 ≈ 980. Power-law at alpha=1.8 lands near 30%.
      // 均匀分布约为 5/51 ≈ 980。alpha=1.8 的幂律分布落在约 30%。
      expect(nearMin).toBeGreaterThan(2500);
    });
  });
});

describe("CountSpecSchema", () => {
  test("accepts a minimal spec with only max", () => {
    expect(() => v.parse(CountSpecSchema, { max: 10 })).not.toThrow();
  });

  test("rejects a spec missing max", () => {
    expect(() => v.parse(CountSpecSchema, { min: 0 })).toThrow();
  });

  test("rejects unknown fields", () => {
    expect(() =>
      v.parse(CountSpecSchema, { max: 10, unknown: 1 } as never),
    ).toThrow();
  });
});
