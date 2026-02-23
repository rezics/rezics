import * as React from 'react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@package/ui/shadcn/carousel.tsx';
import type {ReadlistDTO} from '@package/contract';
import ReadListCard from '../item/ReadListCard';

export interface HorizontalReadListCarouselProps {
  readlistList: ReadlistDTO[];
  className?: string;
}

export const HorizontalReadListCarousel: React.FC<
  HorizontalReadListCarouselProps
> = ({readlistList, className}) => {
  /**
  const readlistPairs = useMemo(() => {
    const pairs: {readlist1: ReadlistDTO; readlist2: ReadlistDTO}[] = [];
    for (let i = 0; i < readlistList.length - 1; i += 2) {
      pairs.push({
        readlist1: readlistList[i],
        readlist2: readlistList[i + 1],
      });
    }
    return pairs;
  }, [readlistList]); 
  if (!readlistPairs.length) {
    return null;
  }
  */

  return (
    <Carousel
      className={['w-full', className ?? ''].join(' ')}
      opts={{
        align: 'start',
        dragFree: true,
      }}
    >
      <CarouselContent className="-ml-4">
        {readlistList.map((item, index) => (
          <CarouselItem
            key={index}
            className="pl-4 basis-[100%] xsm:basis-[60%] md:basis-[50%] lg:basis-[30%] xl:basis-[25%] 2xl:basis-[20%]"
          >
            <ReadListCard readlist={item} />
          </CarouselItem>
        ))}
      </CarouselContent>

      <CarouselPrevious variant="ghost" />
      <CarouselNext variant="ghost" />
    </Carousel>
  );
};
