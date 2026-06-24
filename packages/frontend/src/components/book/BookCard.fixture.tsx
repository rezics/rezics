"use client";
import { mockBook, mockBookDraft, mockBookNoSlug } from "@/__cosmos__/mock-data";
import { BookCard } from "./BookCard";

export default {
  Default: (
    <div className="p-4 max-w-md">
      <BookCard {...mockBook()} />
    </div>
  ),

  Draft: (
    <div className="p-4 max-w-md">
      <BookCard {...mockBookDraft()} />
    </div>
  ),

  NoSlug: (
    <div className="p-4 max-w-md">
      <BookCard {...mockBookNoSlug()} />
    </div>
  ),

  LongTitle: (
    <div className="p-4 max-w-md">
      <BookCard
        {...mockBook({
          unitId: "book-long-title",
          title:
            "The Art of Computer Programming, Volume 4B: Combinatorial Algorithms — Part 2：组合算法与枚举理论的完整指南",
          slug: "taocp-4b",
          status: "published",
          chapterCount: 7,
        })}
      />
    </div>
  ),

  ManyChapters: (
    <div className="p-4 max-w-md">
      <BookCard
        {...mockBook({
          unitId: "book-many-chapters",
          title: "Operating Systems: Three Easy Pieces",
          slug: "ostep",
          status: "published",
          chapterCount: 114,
        })}
      />
    </div>
  ),
};
