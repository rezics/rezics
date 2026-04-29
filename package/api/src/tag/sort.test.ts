import { describe, expect, test } from "bun:test";
import type { UnitTagDTO } from "@rezics/contract";
import { sortTagsByPinThenScore } from "./sort";

const tag = (
  overrides: Partial<UnitTagDTO> & Pick<UnitTagDTO, "tagUnitId">,
): UnitTagDTO => ({
  unitId: "u",
  score: 0,
  voteCount: 0,
  pinned: false,
  position: null,
  ...overrides,
});

describe("sortTagsByPinThenScore", () => {
  test("pinned rows come before unpinned", () => {
    const result = sortTagsByPinThenScore([
      tag({ tagUnitId: "a", score: 100 }),
      tag({ tagUnitId: "b", pinned: true, position: "M", score: 1 }),
    ]);
    expect(result.map((r) => r.tagUnitId)).toEqual(["b", "a"]);
  });

  test("pinned rows are ordered by position ascending", () => {
    const result = sortTagsByPinThenScore([
      tag({ tagUnitId: "a", pinned: true, position: "Z" }),
      tag({ tagUnitId: "b", pinned: true, position: "A" }),
      tag({ tagUnitId: "c", pinned: true, position: "M" }),
    ]);
    expect(result.map((r) => r.tagUnitId)).toEqual(["b", "c", "a"]);
  });

  test("unpinned rows are ordered by score descending", () => {
    const result = sortTagsByPinThenScore([
      tag({ tagUnitId: "a", score: 1 }),
      tag({ tagUnitId: "b", score: 100 }),
      tag({ tagUnitId: "c", score: 50 }),
    ]);
    expect(result.map((r) => r.tagUnitId)).toEqual(["b", "c", "a"]);
  });

  test("ties broken deterministically by tagUnitId", () => {
    const result = sortTagsByPinThenScore([
      tag({ tagUnitId: "z", score: 5 }),
      tag({ tagUnitId: "a", score: 5 }),
      tag({ tagUnitId: "m", score: 5 }),
    ]);
    expect(result.map((r) => r.tagUnitId)).toEqual(["a", "m", "z"]);
  });

  test("does not mutate input", () => {
    const input = [
      tag({ tagUnitId: "a", score: 1 }),
      tag({ tagUnitId: "b", score: 100 }),
    ];
    const before = input.map((r) => r.tagUnitId).join(",");
    sortTagsByPinThenScore(input);
    const after = input.map((r) => r.tagUnitId).join(",");
    expect(after).toBe(before);
  });

  test("returns empty array for empty input", () => {
    expect(sortTagsByPinThenScore([])).toEqual([]);
  });
});
