import { toAbsoluteUrl } from "../utils/url";
import type { SitemapIndexEntry, SitemapUrlEntry } from "../utils/xml";

export const DEFAULT_SITEMAP_LIMIT = 500;
export const MAX_SITEMAP_LIMIT = 1000;

export interface SitemapPageInput {
  start?: string | number | null;
  limit?: string | number | null;
}

export interface BookSitemapRow {
  unitId: string;
  updatedAt?: Date | string | null;
  createdAt?: Date | string | null;
  unit?: {
    updatedAt?: Date | string | null;
    createdAt?: Date | string | null;
  };
}

export interface BookSitemapRepository {
  list(options: {
    start: number;
    limit: number;
    visibility: "PUBLIC";
    status: "PUBLISHED";
    moderationStatus: "APPROVED";
    sort: { type: "updatedAt"; order: "asc" };
  }): Promise<{ books: BookSitemapRow[]; total: number }>;
}

export interface SitemapPageOptions extends SitemapPageInput {
  origin: string;
  bookRepository?: BookSitemapRepository;
}

export function normalizeSitemapPageInput(input: SitemapPageInput = {}) {
  const startNumber = Number(input.start ?? 0);
  const limitNumber = Number(input.limit ?? DEFAULT_SITEMAP_LIMIT);

  return {
    start:
      Number.isFinite(startNumber) && startNumber > 0
        ? Math.floor(startNumber)
        : 0,
    limit:
      Number.isFinite(limitNumber) && limitNumber > 0
        ? Math.min(Math.floor(limitNumber), MAX_SITEMAP_LIMIT)
        : DEFAULT_SITEMAP_LIMIT,
  };
}

function lastModified(book: {
  updatedAt?: Date | string | null;
  createdAt?: Date | string | null;
  unit?: { updatedAt?: Date | string | null; createdAt?: Date | string | null };
}) {
  return (
    book.updatedAt ??
    book.unit?.updatedAt ??
    book.createdAt ??
    book.unit?.createdAt ??
    null
  );
}

async function getBookRepository(
  repository: BookSitemapRepository | undefined,
): Promise<BookSitemapRepository> {
  if (repository) return repository;
  const { bookService } = await import("@rezics/server/book/book.service");
  return bookService;
}

export async function listBookSitemapEntries({
  origin,
  bookRepository,
  ...input
}: SitemapPageOptions): Promise<{
  entries: SitemapUrlEntry[];
  start: number;
  limit: number;
  nextStart: number | null;
}> {
  const { start, limit } = normalizeSitemapPageInput(input);
  const repository = await getBookRepository(bookRepository);
  const result = await repository.list({
    start,
    limit,
    visibility: "PUBLIC",
    status: "PUBLISHED",
    moderationStatus: "APPROVED",
    sort: { type: "updatedAt", order: "asc" },
  });

  return {
    entries: result.books.map((book) => ({
      loc: toAbsoluteUrl(`/book/${book.unitId}`, origin),
      lastmod: lastModified(book),
    })),
    start,
    limit,
    nextStart:
      start + result.books.length < result.total ? start + limit : null,
  };
}

export async function listBookSitemapShards({
  origin,
  bookRepository,
  ...input
}: SitemapPageOptions): Promise<SitemapIndexEntry[]> {
  const { limit } = normalizeSitemapPageInput(input);
  const repository = await getBookRepository(bookRepository);
  const result = await repository.list({
    start: 0,
    limit: 1,
    visibility: "PUBLIC",
    status: "PUBLISHED",
    moderationStatus: "APPROVED",
    sort: { type: "updatedAt", order: "asc" },
  });
  const total = Math.max(result.total, result.books.length);
  const shardCount = Math.max(1, Math.ceil(total / limit));

  return Array.from({ length: shardCount }, (_, index) => ({
    loc: toAbsoluteUrl(
      `/sitemap/books.xml?start=${index * limit}&limit=${limit}`,
      origin,
    ),
  }));
}
