"use client";

import { AdminBooksContent, type AdminBookRow } from "./page";

const longBook: AdminBookRow = {
  id: "book-long",
  name: "The Annotated Catalog of Multilingual Works with Variant Titles, Lost Chapters, and Disputed Attributions",
  author: "A. Very Long Collective Author Name with Multiple Transliteration Systems",
  isbn: "978-1-23456-789-7 / missing in regional edition",
  created: "2025-03-18",
};

const manyBooks: AdminBookRow[] = Array.from({ length: 50 }, (_, index) => ({
  id: `book-${index}`,
  name: `Work awaiting catalog review ${String(index + 1).padStart(2, "0")}`,
  author: index % 4 === 0 ? "Unknown / anonymous attribution" : `Author ${index + 1}`,
  isbn: index % 6 === 0 ? "No ISBN" : `978-0-${String(index).padStart(5, "0")}-00-0`,
  created: `2025-02-${String((index % 28) + 1).padStart(2, "0")}`,
}));

export default {
  Empty: (
    <div className="w-full max-w-5xl p-4">
      <AdminBooksContent />
    </div>
  ),
  LongTextRows: (
    <div className="w-[320px] p-4">
      <AdminBooksContent rows={[longBook]} initialQuery="variant titles" />
    </div>
  ),
  ExplodingList: (
    <div className="w-full max-w-5xl p-4">
      <AdminBooksContent rows={manyBooks} initialQuery="review" />
    </div>
  ),
  DisabledSearch: (
    <div className="w-full max-w-5xl p-4">
      <AdminBooksContent disabled rows={manyBooks.slice(0, 6)} initialQuery="restricted" />
    </div>
  ),
};
