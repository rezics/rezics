import { describe, expect, test } from "bun:test";
import { escapeXml, robotsTxt, sitemapIndex, sitemapUrlSet } from "./xml";

describe("preview XML helpers", () => {
  test("escapes XML-sensitive characters", () => {
    expect(escapeXml(`A <B> & "C" 'D'`)).toBe(
      "A &lt;B&gt; &amp; &quot;C&quot; &apos;D&apos;",
    );
  });

  test("renders sitemap URL sets with escaped loc and ISO lastmod", () => {
    const xml = sitemapUrlSet([
      {
        loc: "https://rezics.example/book/a&b",
        lastmod: new Date("2026-06-05T12:00:00.000Z"),
      },
    ]);

    expect(xml).toContain("<?xml version");
    expect(xml).toContain("<loc>https://rezics.example/book/a&amp;b</loc>");
    expect(xml).toContain("<lastmod>2026-06-05T12:00:00.000Z</lastmod>");
  });

  test("renders sitemap indexes and robots sitemap pointers", () => {
    expect(
      sitemapIndex([{ loc: "https://rezics.example/sitemap/books.xml" }]),
    ).toContain("<sitemapindex");
    expect(robotsTxt("https://rezics.example/")).toContain(
      "Sitemap: https://rezics.example/sitemap.xml",
    );
  });
});
