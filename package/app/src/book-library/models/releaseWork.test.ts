import { describe, expect, test } from "bun:test";
import type { BookDTO } from "@rezics/contract";
import {
  ALL_RELEASE_LANGUAGES,
  filterReleasesByLanguage,
  filterReleasesByLanguages,
  hasMissingReleaseLanguages,
  releaseLanguages,
  releaseWorkUnitId,
  sortWorkReleases,
} from "./releaseWork";

function release(
  unitId: string,
  input: {
    workUnitId?: string;
    language?: string;
    position?: string | null;
    displayPolicy?: "PRIMARY" | "SECONDARY" | "HIDDEN_BY_DEFAULT";
  } = {},
): BookDTO {
  return {
    unitId,
    defaultLanguage: input.language as never,
    translations: input.language
      ? [{ unitId, language: input.language as never, title: unitId }]
      : [],
    workMembership: input.workUnitId
      ? {
          unitId,
          workUnitId: input.workUnitId,
          role: "RELEASE",
          language: input.language ?? null,
          position: input.position ?? null,
          displayPolicy: input.displayPolicy ?? "PRIMARY",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        }
      : null,
  } as BookDTO;
}

describe("release work helpers", () => {
  test("prefers canonical UnitWork work id over legacy workUnitId", () => {
    expect(
      releaseWorkUnitId({
        workUnitId: "legacy-work",
        workMembership: {
          unitId: "release-1",
          workUnitId: "canonical-work",
          role: "RELEASE",
          language: null,
          position: null,
          displayPolicy: "PRIMARY",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      } as BookDTO),
    ).toBe("canonical-work");
  });

  test("sorts by display policy, position, then unit id", () => {
    const sorted = sortWorkReleases([
      release("release-c", {
        workUnitId: "work-1",
        position: "b",
        displayPolicy: "PRIMARY",
      }),
      release("release-b", {
        workUnitId: "work-1",
        position: "a",
        displayPolicy: "SECONDARY",
      }),
      release("release-a", {
        workUnitId: "work-1",
        position: "a",
        displayPolicy: "PRIMARY",
      }),
    ]);

    expect(sorted.map((item) => item.unitId)).toEqual([
      "release-a",
      "release-c",
      "release-b",
    ]);
  });

  test("filters language-specific release lists while preserving all option", () => {
    const releases = [
      release("en-1", { workUnitId: "work-1", language: "en" }),
      release("ja-1", { workUnitId: "work-1", language: "ja" }),
    ];

    expect(releaseLanguages(releases)).toEqual(["en", "ja"]);
    expect(
      filterReleasesByLanguage(releases, ALL_RELEASE_LANGUAGES).map(
        (item) => item.unitId,
      ),
    ).toEqual(["en-1", "ja-1"]);
    expect(
      filterReleasesByLanguage(releases, "ja").map((item) => item.unitId),
    ).toEqual(["ja-1"]);
    expect(
      filterReleasesByLanguages(releases, ["en", "ja"]).map(
        (item) => item.unitId,
      ),
    ).toEqual(["en-1", "ja-1"]);
    expect(hasMissingReleaseLanguages(["en"], releases)).toBe(true);
    expect(hasMissingReleaseLanguages(["en", "ja"], releases)).toBe(false);
  });
});
