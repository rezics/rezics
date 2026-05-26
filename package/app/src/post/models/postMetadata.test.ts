import { describe, expect, test } from "bun:test";
import { isEditedTimestamp } from "./postMetadata";

describe("isEditedTimestamp", () => {
  test("returns true for different string instants", () => {
    expect(
      isEditedTimestamp("2026-05-01T00:00:00.000Z", "2026-05-01T00:00:01.000Z"),
    ).toBe(true);
  });

  test("returns false for equal string and Date instants", () => {
    expect(
      isEditedTimestamp(
        "2026-05-01T00:00:00.000Z",
        new Date("2026-05-01T00:00:00.000Z"),
      ),
    ).toBe(false);
  });

  test("returns false for missing or invalid timestamps", () => {
    expect(isEditedTimestamp(undefined, "2026-05-01T00:00:00.000Z")).toBe(
      false,
    );
    expect(isEditedTimestamp("not-a-date", "2026-05-01T00:00:00.000Z")).toBe(
      false,
    );
  });
});
