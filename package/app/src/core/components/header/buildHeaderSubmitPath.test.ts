import { describe, expect, test } from "bun:test";
import { buildHeaderSubmitPath } from "./buildHeaderSubmitPath";

describe("buildHeaderSubmitPath", () => {
  test("global pathname submits to /search", () => {
    expect(buildHeaderSubmitPath("/feedback/admin", "test")).toBe(
      "/search?q=test",
    );
  });

  test("realm pathname submits to /realm/:id/search", () => {
    expect(buildHeaderSubmitPath("/realm/r-1/forum", "magic")).toBe(
      "/realm/r-1/search?q=magic",
    );
  });

  test("user-by-id pathname submits to /user/:id/search", () => {
    expect(buildHeaderSubmitPath("/user/u-3/content", "epic")).toBe(
      "/user/u-3/search?q=epic",
    );
  });

  test("user-by-slug pathname submits to /u/:slug/search (no slug resolution at header layer)", () => {
    expect(buildHeaderSubmitPath("/u/alice/realms", "epic")).toBe(
      "/u/alice/search?q=epic",
    );
  });

  test("book pathname submits to /book/:id/search", () => {
    expect(buildHeaderSubmitPath("/book/b-9/info", "deep")).toBe(
      "/book/b-9/search?q=deep",
    );
  });

  test("empty value omits q from URL", () => {
    expect(buildHeaderSubmitPath("/realm/r-1/forum", "")).toBe(
      "/realm/r-1/search",
    );
  });

  test("/realm/search directory submits to global", () => {
    expect(buildHeaderSubmitPath("/realm/search", "x")).toBe("/search?q=x");
  });
});
