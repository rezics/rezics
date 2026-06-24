import { describe, expect, test } from "bun:test";
import { normalizeShelfViewMode } from "./shelfViewMode";

describe("normalizeShelfViewMode", () => {
  test("keeps current shelf view modes including bookshelf", () => {
    expect(normalizeShelfViewMode("nested")).toBe("nested");
    expect(normalizeShelfViewMode("flat")).toBe("flat");
    expect(normalizeShelfViewMode("bookshelf")).toBe("bookshelf");
  });

  test("cuts legacy and unknown persisted values over to nested", () => {
    expect(normalizeShelfViewMode("review")).toBe("nested");
    expect(normalizeShelfViewMode("list")).toBe("nested");
    expect(normalizeShelfViewMode("grid")).toBe("nested");
    expect(normalizeShelfViewMode(null)).toBe("nested");
    expect(normalizeShelfViewMode(undefined)).toBe("nested");
  });
});
