import { describe, expect, test } from "bun:test";
import {
  listBookSitemapEntries,
  listBookSitemapShards,
  normalizeSitemapPageInput,
} from "./sitemap.service";

function repository(total = 2) {
  return {
    calls: [] as unknown[],
    async list(options: unknown) {
      this.calls.push(options);
      return {
        total,
        books: [
          {
            unitId: "book-1",
            updatedAt: new Date("2026-06-05T10:00:00.000Z"),
            unit: { updatedAt: new Date("2026-06-05T09:00:00.000Z") },
          },
        ],
      };
    },
  };
}

describe("sitemap service", () => {
  test("normalizes bounded page inputs", () => {
    expect(normalizeSitemapPageInput({ start: "-1", limit: "5000" })).toEqual({
      start: 0,
      limit: 1000,
    });
  });

  test("lists public approved book sitemap entries", async () => {
    const repo = repository(3);
    const page = await listBookSitemapEntries({
      origin: "https://rezics.example",
      start: 1,
      limit: 2,
      bookRepository: repo,
    });

    expect(repo.calls[0]).toMatchObject({
      start: 1,
      limit: 2,
      visibility: "PUBLIC",
      status: "PUBLISHED",
      moderationStatus: "APPROVED",
    });
    expect(page.entries).toEqual([
      {
        loc: "https://rezics.example/book/book-1",
        lastmod: new Date("2026-06-05T10:00:00.000Z"),
      },
    ]);
    expect(page.nextStart).toBe(3);
  });

  test("builds sitemap index shards from bounded total query", async () => {
    const repo = repository(1201);
    const shards = await listBookSitemapShards({
      origin: "https://rezics.example",
      limit: 500,
      bookRepository: repo,
    });

    expect(repo.calls[0]).toMatchObject({ start: 0, limit: 1 });
    expect(shards).toHaveLength(3);
    expect(shards[2]?.loc).toBe(
      "https://rezics.example/sitemap/books.xml?start=1000&limit=500",
    );
  });
});
