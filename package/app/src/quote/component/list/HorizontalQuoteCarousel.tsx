import * as React from 'react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/component/shadcn/carousel';
import type {QuoteDTO} from '@package/contract';
import QuoteCard from '../item/QuoteCard';

export interface HorizontalQuoteCarouselProps {
  quoteList: QuoteDTO[];
  className?: string;
}

export const HorizontalQuoteCarousel: React.FC<HorizontalQuoteCarouselProps> = ({
  quoteList,
  className,
}) => {
  if (!quoteList.length) {
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
        {quoteList.map(item => (
          <CarouselItem
            key={item.id}
            className="pl-4 basis-[100%] lg:basis-[50%] xl:basis-[40%]"
          >
            <QuoteCard quote={item} />
          </CarouselItem>
        ))}
      </CarouselContent>

      <CarouselPrevious variant="ghost" />
      <CarouselNext variant="ghost" />
    </Carousel>
  );
};

export default HorizontalQuoteCarousel;
