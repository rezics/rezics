import { describe, expect, test } from "bun:test";
import { isAssetPath, isPreviewEligiblePath } from "./routes";

describe("edge preview routes", () => {
  test("allows SEO page and sitemap paths", () => {
    expect(isPreviewEligiblePath("/book/book-1")).toBe(true);
    expect(isPreviewEligiblePath("/r/realm/post/post-1")).toBe(true);
    expect(isPreviewEligiblePath("/sitemap.xml")).toBe(true);
    expect(isPreviewEligiblePath("/robots.txt")).toBe(true);
  });

  test("keeps static assets out of preview routing", () => {
    expect(isAssetPath("/assets/app.js")).toBe(true);
    expect(isPreviewEligiblePath("/book/cover.webp")).toBe(false);
    expect(isPreviewEligiblePath("/assets/app.js")).toBe(false);
  });
});
