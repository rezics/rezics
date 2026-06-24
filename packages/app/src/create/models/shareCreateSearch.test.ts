import { describe, expect, test } from "bun:test";
import { normalizeCreatePageSearch } from "./shareCreateSearch";

describe("create page share search", () => {
  test("keeps only non-empty share search strings", () => {
    expect(
      normalizeCreatePageSearch({
        shareTargetId: " unit-1 ",
        shareTitle: " Shared title ",
      }),
    ).toEqual({
      shareTargetId: "unit-1",
      shareTitle: "Shared title",
    });

    expect(
      normalizeCreatePageSearch({
        shareTargetId: "",
        shareTitle: 42,
      }),
    ).toEqual({});
  });
});
