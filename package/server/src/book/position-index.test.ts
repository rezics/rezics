import { describe, expect, test } from "bun:test";
import { between, firstKey, keyAfter, keyBefore } from "./position-index";

describe("position index", () => {
  test("firstKey returns a mid-alphabet key", () => {
    const key = firstKey();
    expect(key.length).toBeGreaterThan(0);
    expect(key > "").toBe(true);
  });

  test("keyAfter returns something strictly greater than the prev key", () => {
    const prev = "g";
    const next = keyAfter(prev);
    expect(next > prev).toBe(true);
  });

  test("keyAfter appends after the maximum-rank key without renumbering", () => {
    const last = "z";
    const next = keyAfter(last);
    expect(next > last).toBe(true);
  });

  test("keyBefore returns something strictly less than the next key", () => {
    const next = "g";
    const prev = keyBefore(next);
    expect(prev < next).toBe(true);
    expect(prev > "").toBe(true);
  });

  test("between produces a key strictly between two adjacent siblings", () => {
    const a = "a";
    const b = "b";
    const mid = between(a, b);
    expect(mid > a).toBe(true);
    expect(mid < b).toBe(true);
  });

  test("between handles widely separated bounds", () => {
    const mid = between("a", "z");
    expect(mid > "a").toBe(true);
    expect(mid < "z").toBe(true);
  });

  test("between rejects prev >= next", () => {
    expect(() => between("g", "g")).toThrow();
    expect(() => between("n", "g")).toThrow();
  });

  test("between with null bounds returns valid keys", () => {
    const mid = between(null, null);
    expect(mid.length).toBeGreaterThan(0);
  });

  test("between with a null left bound returns less than the right bound", () => {
    const k = between(null, "g");
    expect(k < "g").toBe(true);
  });

  test("between with a null right bound returns greater than the left bound", () => {
    const k = between("g", null);
    expect(k > "g").toBe(true);
  });

  test("repeated insert-between-same-pair grows the key length (documented pathology)", () => {
    const a = "a";
    let b = "b";
    let prevLen = 1;
    let lastMid = a;
    for (let i = 0; i < 5; i++) {
      const mid = between(a, b);
      expect(mid > a).toBe(true);
      expect(mid < b).toBe(true);
      // Each iteration the right bound shrinks toward `a`, so the key must
      // grow to stay strictly between.
      expect(mid.length).toBeGreaterThanOrEqual(prevLen);
      prevLen = mid.length;
      lastMid = mid;
      b = mid;
    }
    expect(lastMid.length).toBeGreaterThan(1);
  });

  test("lexicographic order is preserved after many inserts", () => {
    const keys: string[] = [firstKey()];
    keys.push(keyAfter(keys.at(-1)!));
    keys.push(keyAfter(keys.at(-1)!));
    // Insert in the middle a few times.
    keys.splice(1, 0, between(keys[0]!, keys[1]!));
    keys.splice(3, 0, between(keys[2]!, keys[3]!));

    const sorted = [...keys].sort();
    expect(keys).toEqual(sorted);
  });

  test("insertion sequence: append, prepend, middle all stable", () => {
    const k1 = firstKey();
    const k2 = keyAfter(k1);
    const k0 = keyBefore(k1);
    const k15 = between(k1, k2);
    const ordered = [k0, k1, k15, k2];
    const sorted = [...ordered].sort();
    expect(ordered).toEqual(sorted);
  });
});
