import { describe, expect, test } from "bun:test";
import {
  appendAfter,
  betweenNeighbors,
  prependBefore,
  visualReorderBounds,
} from "./positionMath";

describe("positionMath", () => {
  test("appendAfter undefined produces a valid string", () => {
    const k = appendAfter(undefined);
    expect(k.length).toBeGreaterThan(0);
  });

  test("appendAfter strictly greater than input", () => {
    const a = appendAfter(undefined);
    const b = appendAfter(a);
    expect(b > a).toBe(true);
  });

  test("prependBefore strictly less than input", () => {
    const a = appendAfter(undefined);
    const b = prependBefore(a);
    expect(b < a).toBe(true);
  });

  test("betweenNeighbors falls strictly between two keys", () => {
    const a = appendAfter(undefined);
    const c = appendAfter(a);
    const b = betweenNeighbors(a, c);
    expect(b > a).toBe(true);
    expect(b < c).toBe(true);
  });

  test("betweenNeighbors handles empty list (both undefined)", () => {
    const k = betweenNeighbors(undefined, undefined);
    expect(k.length).toBeGreaterThan(0);
  });

  test("betweenNeighbors handles single-item insert (after only)", () => {
    const a = appendAfter(undefined);
    const k = betweenNeighbors(a, undefined);
    expect(k > a).toBe(true);
  });

  test("betweenNeighbors handles single-item insert (before only)", () => {
    const a = appendAfter(undefined);
    const k = betweenNeighbors(undefined, a);
    expect(k < a).toBe(true);
  });

  test("ten sequential appends remain strictly ordered", () => {
    const keys: string[] = [];
    let last: string | undefined;
    for (let i = 0; i < 10; i++) {
      const k = appendAfter(last);
      keys.push(k);
      last = k;
    }
    for (let i = 1; i < keys.length; i++) {
      expect(keys[i]! > keys[i - 1]!).toBe(true);
    }
  });

  test("visualReorderBounds maps ascending visual neighbors directly", () => {
    const rows = [{ position: "a" }, { position: "m" }, { position: "z" }];

    expect(visualReorderBounds(rows, 1, "asc")).toEqual({
      before: "a",
      after: "z",
    });
  });

  test("visualReorderBounds reverses neighbors for descending manual order", () => {
    const rows = [{ position: "z" }, { position: "m" }, { position: "a" }];

    expect(visualReorderBounds(rows, 1, "desc")).toEqual({
      before: "a",
      after: "z",
    });
  });

  test("visualReorderBounds handles descending top insertion", () => {
    const rows = [{ position: "m" }, { position: "a" }];

    expect(visualReorderBounds(rows, 0, "desc")).toEqual({
      before: "a",
      after: undefined,
    });
  });
});
