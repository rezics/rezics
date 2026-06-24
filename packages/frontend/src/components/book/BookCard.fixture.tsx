"use client";
import { mockBook, mockBookDraft, mockBookNoSlug } from "@/__cosmos__/mock-data";
import { BookCard } from "./BookCard";

export default {
  Default: (
    <div className="mx-auto w-full max-w-md p-4">
      <BookCard {...mockBook()} />
    </div>
  ),

  Draft: (
    <div className="mx-auto w-full max-w-md p-4">
      <BookCard {...mockBookDraft()} />
    </div>
  ),

  NoSlug: (
    <div className="mx-auto w-full max-w-md p-4">
      <BookCard {...mockBookNoSlug()} />
    </div>
  ),

  LongTitle: (
    <div className="mx-auto w-full max-w-md p-4">
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
    <div className="mx-auto w-full max-w-md p-4">
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

  MobileDense: (
    <div className="mx-auto w-full max-w-[320px] p-2">
      <div className="flex flex-col gap-2">
        <BookCard {...mockBook()} />
        <BookCard {...mockBookDraft()} />
        <BookCard {...mockBookNoSlug()} />
      </div>
    </div>
  ),

  OverflowTitle: (
    <div className="mx-auto w-full max-w-[320px] p-2">
      <BookCard
        {...mockBook({
          unitId: "book-overflow",
          title:
            "Lopadotemachoselachogaleokranioleipsanodrimhypotrimmatosilphioparaomelitokatakechymenokichlepikossyphophattoperisteralektryonoptekephalliokigklopeleiolagoiosiraiobaphetraganopterygon",
          slug: "overflow-title",
          status: "experimental-preview-release-candidate",
          chapterCount: 9999,
        })}
      />
    </div>
  ),
};
