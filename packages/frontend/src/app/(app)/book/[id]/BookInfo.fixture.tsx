"use client";

import type { BookDTO } from "@rezics/backend/api";
import { BookInfoView } from "./info/page";

const fullBook: BookDTO = {
  unitId: "book-001",
  type: "book",
  slug: "sicp",
  status: "published",
  visibility: "PUBLIC",
  isbn13: "978-7-111-13510-8",
  pageCount: 473,
  textLength: 285000,
  chapterCount: 5,
  createdAt: "2025-01-15T00:00:00.000Z",
  updatedAt: "2025-06-01T00:00:00.000Z",
};

const anomalousBook: BookDTO = {
  unitId: "book-anomalous",
  type: "book",
  slug: null,
  status: "private draft awaiting editorial permission and cross-realm classification review",
  visibility: "PRIVATE_WITH_PENDING_REALM_OVERRIDES",
  isbn13: null,
  pageCount: null,
  textLength: 0,
  chapterCount: 0,
  createdAt: "not-a-date",
  updatedAt: "2025-06-20T12:00:00.000Z",
};

export default {
  FullMetadata: (
    <div className="mx-auto w-full max-w-3xl p-4">
      <BookInfoView book={fullBook} />
    </div>
  ),
  MissingAndLongValues: (
    <div className="w-[320px] p-4">
      <BookInfoView book={anomalousBook} />
    </div>
  ),
};
