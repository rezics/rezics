"use client";

import { mockBook, mockBookDraft, mockBookNoSlug } from "@/__cosmos__/mock-data";
import { BooksContentView, type BooksContentViewBook } from "./content";

const manyBooks: BooksContentViewBook[] = Array.from({ length: 25 }, (_, index) => ({
  unitId: `book-page-full-${index}`,
  slug: index % 5 === 0 ? null : `book-page-full-${index}`,
  status: index % 4 === 0 ? "draft" : "published",
  chapterCount: index * 3,
}));

const longBooks: BooksContentViewBook[] = [
  mockBook({
    unitId: "book-long-slug",
    slug: "the-annotated-multilingual-catalog-of-variant-editions-adaptations-and-disputed-attributions",
    status: "published",
    chapterCount: 999,
  }),
  mockBookDraft({
    unitId: "book-draft-without-readable-title",
    slug: null,
    status: "private draft awaiting permissions",
    chapterCount: 0,
  }),
  mockBookNoSlug({
    unitId: "book-no-slug-edge-case-with-long-fallback-identifier",
    status: "archived",
    chapterCount: -1,
  }),
];

export default {
  Empty: (
    <div className="p-4">
      <BooksContentView books={[]} hasMore={false} onLoadMore={() => {}} />
    </div>
  ),
  LongAndAnomalous: (
    <div className="w-[320px] p-4">
      <BooksContentView books={longBooks} hasMore={false} onLoadMore={() => {}} />
    </div>
  ),
  FullPageHasMore: (
    <div className="p-4">
      <BooksContentView books={manyBooks} hasMore onLoadMore={() => {}} />
    </div>
  ),
  UltraWidePressure: (
    <div className="w-[1536px] p-4">
      <BooksContentView books={manyBooks.slice(0, 8)} hasMore={false} onLoadMore={() => {}} />
    </div>
  ),
};
