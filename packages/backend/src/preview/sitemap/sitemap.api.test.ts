import { describe, expect, mock, test } from "bun:test";

mock.module("../../server/book/book.service", () => ({
  bookService: {
    list: mock(async () => ({
      total: 1,
      books: [
        {
          unitId: "book-1",
          updatedAt: new Date("2026-06-05T10:00:00.000Z"),
        },
      ],
    })),
  },
}));

const { sitemapApi } = await import("./sitemap.api");

describe("sitemapApi", () => {
  test("serves robots with sitemap pointer and cache headers", async () => {
    const res = await sitemapApi.handle(
      new Request("https://rezics.example/robots.txt"),
    );
    const body = await res.text();

    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(res.headers.get("cache-control")).toContain("max-age=3600");
    expect(body).toContain("Sitemap: https://rezics.example/sitemap.xml");
  });

  test("serves sitemap index XML", async () => {
    const res = await sitemapApi.handle(
      new Request("https://rezics.example/sitemap.xml"),
    );
    const body = await res.text();

    expect(res.headers.get("content-type")).toContain("application/xml");
    expect(body).toContain("<sitemapindex");
    expect(body).toContain(
      "https://rezics.example/sitemap/books.xml?start=0&amp;limit=500",
    );
  });

  test("serves book sitemap XML", async () => {
    const res = await sitemapApi.handle(
      new Request("https://rezics.example/sitemap/books.xml?start=0&limit=1"),
    );
    const body = await res.text();

    expect(res.headers.get("cache-control")).toContain(
      "stale-while-revalidate=86400",
    );
    expect(body).toContain("<urlset");
    expect(body).toContain("https://rezics.example/book/book-1");
  });
});
