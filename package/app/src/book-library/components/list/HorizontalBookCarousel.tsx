import { DomainCarousel } from "@rezics/ui/composite/carousel/DomainCarousel.tsx";
import type * as React from "react";
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
      itemClassName="pl-4 !basis-1/3 xsm:!basis-1/4 sm:!basis-1/5 md:!basis-1/6 lg:!basis-1/7 xl:!basis-1/12"
      className={className}
      ariaLabel="Books"
      renderItem={(book) => (
        <BookCard
          title={book.title}
          author={book.author}
          coverUrl={book.coverUrl}
          href={book.href}
          className="max-w-28 md:max-w-32"
        />
      )}
    />
  );
};
