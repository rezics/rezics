import { describe, expect, test } from "bun:test";
import { ApiError } from "../react-query/errors";
import { getSystemShelfMissingKindKey } from "./useSystemShelfRecovery";

describe("getSystemShelfMissingKindKey", () => {
  test("extracts system shelf kind from recoverable API error", () => {
    const error = new ApiError(404, "system_shelf_missing", "missing", {
      kindKey: "active",
    });

    expect(getSystemShelfMissingKindKey(error)).toBe("active");
  });

  test("ignores non-system shelf errors", () => {
    expect(
      getSystemShelfMissingKindKey(
        new ApiError(404, "system_shelf_missing", "missing", {
          kindKey: "custom",
        }),
      ),
    ).toBeNull();
    expect(
      getSystemShelfMissingKindKey(new ApiError(404, "NOT_FOUND", "missing")),
    ).toBeNull();
    expect(getSystemShelfMissingKindKey(new Error("nope"))).toBeNull();
  });
});
