import { describe, expect, test } from "bun:test";
import { officialZoneHref, officialZoneSearchHref } from "./officialZoneRoutes";

describe("officialZoneRoutes", () => {
  test("keeps official portal routes on ordinary zone URLs", () => {
    expect(officialZoneHref("book")).toBe("/z/book");
    expect(officialZoneHref("realms")).toBe("/z/realms");
    expect(officialZoneHref("zones")).toBe("/z/zones");
    expect(officialZoneHref("popular")).toBe("/z/popular");
  });

  test("builds zone search URLs with the shared search string parameter", () => {
    expect(officialZoneSearchHref("book", { q: "[light novel]" })).toBe(
      "/z/book/search?q=%5Blight+novel%5D",
    );
  });
});
