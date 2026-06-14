import { describe, expect, test } from "bun:test";
import { ApiError } from "../react-query/errors";
import { getSystemShelfMissingSlug } from "./useSystemShelfRecovery";

describe("getSystemShelfMissingSlug", () => {
  test("extracts reserved shelf slug from recoverable API error", () => {
    const error = new ApiError(404, "system_shelf_missing", "missing", {
      slug: "favorites",
    });

    expect(getSystemShelfMissingSlug(error)).toBe("favorites");
  });

  test("ignores non-reserved shelf errors", () => {
    expect(
      getSystemShelfMissingSlug(
        new ApiError(404, "system_shelf_missing", "missing", {
          slug: "custom",
        }),
      ),
    ).toBeNull();
    expect(
      getSystemShelfMissingSlug(new ApiError(404, "NOT_FOUND", "missing")),
    ).toBeNull();
    expect(getSystemShelfMissingSlug(new Error("nope"))).toBeNull();
  });
});
