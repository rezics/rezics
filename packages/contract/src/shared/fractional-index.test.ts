import { describe, expect, test } from "bun:test";
import {
  generateKeyBetween,
  positionForNewBottomPin,
  positionForNewTopPin,
} from "./fractional-index";

describe("generateKeyBetween", () => {
  test("returns mid key when both sides omitted", () => {
    const key = generateKeyBetween();
    expect(key.length).toBeGreaterThan(0);
  });

  test("a < result < b for adjacent characters", () => {
    const key = generateKeyBetween("A", "C");
    expect(key > "A").toBe(true);
    expect(key < "C").toBe(true);
  });

  test("result > a when only a is given", () => {
    const key = generateKeyBetween("M", undefined);
    expect(key > "M").toBe(true);
  });

  test("result < b when only b is given", () => {
    const key = generateKeyBetween(undefined, "M");
    expect(key < "M").toBe(true);
  });

  test("can squeeze between adjacent index keys", () => {
    const key = generateKeyBetween("A", "B");
    expect(key > "A").toBe(true);
    expect(key < "B").toBe(true);
  });

  test("repeated insertions keep order stable", () => {
    let mid = generateKeyBetween("A", "Z");
    for (let i = 0; i < 5; i += 1) {
      const next = generateKeyBetween("A", mid);
      expect(next < mid).toBe(true);
      expect(next > "A").toBe(true);
      mid = next;
    }
  });

  test("throws when a >= b", () => {
    expect(() => generateKeyBetween("B", "A")).toThrow();
    expect(() => generateKeyBetween("A", "A")).toThrow();
  });
});

describe("positionForNewTopPin", () => {
  test("returns a key smaller than an existing top key", () => {
    const top = "M";
    const key = positionForNewTopPin(top);
    expect(key < top).toBe(true);
  });

  test("returns mid key when no existing pins", () => {
    const key = positionForNewTopPin();
    expect(key.length).toBeGreaterThan(0);
  });

  test("treats null as no existing pin", () => {
    expect(positionForNewTopPin(null)).toBe(positionForNewTopPin());
  });
});

describe("positionForNewBottomPin", () => {
  test("returns a key larger than an existing bottom key", () => {
    const bottom = "M";
    const key = positionForNewBottomPin(bottom);
    expect(key > bottom).toBe(true);
  });

  test("returns mid key when no existing pins", () => {
    const key = positionForNewBottomPin();
    expect(key.length).toBeGreaterThan(0);
  });
});
