import type * as React from "react";
import { DomainCarousel } from "@rezics/ui/composite/carousel/DomainCarousel.tsx";
import { BookCard, type BookProps } from "../item/VerticalBookCard";

export interface HorizontalBookCarouselProps {
  bookList: (BookProps & { id: string })[];
  className?: string;
}

export const HorizontalBookCarousel: React.FC<HorizontalBookCarouselProps> = ({
  bookList,
  className,
}) => {
  if (!bookList || bookList.length === 0) {
    return null;
  }

  return (
    <DomainCarousel
      items={bookList}
      itemKey={(book) => book.id}
      itemClassName="horizontal-book-carousel"
      className={className}
      ariaLabel="Books"
      renderItem={(book) => (
        <BookCard
          title={book.title}
          author={book.author}
          coverUrl={book.coverUrl}
          href={book.href}
          className="max-w-20 md:max-w-28"
        />
      )}
    />
  );
};
