import * as React from 'react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@package/ui/shadcn/carousel.tsx';
import {BookCard, type BookProps} from '../item/VerticalBookCard';
export interface HorizontalBookCarouselProps {
  bookList: (BookProps & {id: string})[];
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
    <Carousel
      className={['w-full', className ?? ''].join(' ')}
      opts={{
        align: 'start',
        dragFree: true,
      }}
    >
      <CarouselContent className="-ml-4">
        {bookList.map(book => (
          <CarouselItem key={book.id} className="horizontal-book-carousel">
            <BookCard
              title={book.title}
              author={book.author}
              description={book.description}
              coverUrl={book.coverUrl}
              href={book.href}
              className="max-w-20 md:max-w-28"
            />
          </CarouselItem>
        ))}
      </CarouselContent>

      <CarouselPrevious variant="ghost" />
      <CarouselNext variant="ghost" />
    </Carousel>
  );
};
