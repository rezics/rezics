"use client";

import { PAGE_SIZE, bookListQuery } from "@/atoms/books";
import { SectionBoundary } from "@/components/SectionBoundary";
import { BookCard } from "@/components/book/BookCard";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/locale";
import { useAtomSuspense } from "@effect/atom-react";
import { BookOpenIcon } from "lucide-react";
import { useState } from "react";

export interface BooksContentViewBook {
  readonly unitId: string;
  readonly slug: string | null;
  readonly status: string;
  readonly chapterCount: number;
}

export function BooksContentView({
  books,
  hasMore,
  onLoadMore,
}: {
  readonly books: readonly BooksContentViewBook[];
  readonly hasMore: boolean;
  readonly onLoadMore: () => void;
}) {
  const [t] = useT();

  if (books.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="mb-4 text-xl font-semibold">{t.library.title}</h1>
        <div className="flex flex-col items-center gap-2 py-12">
          <BookOpenIcon className="text-muted-foreground size-8" />
          <p className="text-muted-foreground text-sm">{t.common.empty}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="mb-4 text-xl font-semibold">{t.library.title}</h1>
      <div className="flex flex-col gap-3">
        {books.map((book) => (
          <BookCard
            chapterCount={book.chapterCount}
            key={book.unitId}
            slug={book.slug}
            status={book.status}
            title={book.slug ?? book.unitId}
            unitId={book.unitId}
          />
        ))}
        {hasMore && (
          <Button className="self-center" onClick={onLoadMore} variant="outline">
            {t.common.loadMore}
          </Button>
        )}
      </div>
    </div>
  );
}

function BookListPage({
  offset,
  isLast,
  onLoadMore,
}: {
  readonly offset: number;
  readonly isLast: boolean;
  readonly onLoadMore: () => void;
}) {
  const [t] = useT();
  const result = useAtomSuspense(bookListQuery({ offset, limit: PAGE_SIZE }));
  const books = result.value.books;

  return (
    <>
      {offset === 0 && books.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-12">
          <BookOpenIcon className="text-muted-foreground size-8" />
          <p className="text-muted-foreground text-sm">{t.common.empty}</p>
        </div>
      )}
      {books.map((book) => (
        <BookCard
          chapterCount={book.chapterCount}
          key={book.unitId}
          slug={book.slug}
          status={book.status}
          title={book.slug ?? book.unitId}
          unitId={book.unitId}
        />
      ))}
      {isLast && books.length === PAGE_SIZE && (
        <Button className="self-center" onClick={onLoadMore} variant="outline">
          {t.common.loadMore}
        </Button>
      )}
    </>
  );
}

export function BooksContent() {
  const [t] = useT();
  const [pageCount, setPageCount] = useState(1);
  const offsets = Array.from({ length: pageCount }, (_, i) => i * PAGE_SIZE);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="mb-4 text-xl font-semibold">{t.library.title}</h1>
      <div className="flex flex-col gap-3">
        {offsets.map((offset) => (
          <SectionBoundary key={offset}>
            <BookListPage
              isLast={offset === (pageCount - 1) * PAGE_SIZE}
              offset={offset}
              onLoadMore={() => setPageCount((c) => c + 1)}
            />
          </SectionBoundary>
        ))}
      </div>
    </div>
  );
}
