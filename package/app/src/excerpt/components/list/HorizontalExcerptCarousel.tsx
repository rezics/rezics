import type { UnitDTO } from "@rezics/contract";
import type * as React from "react";
import { DomainCarousel } from "@rezics/ui/composite/carousel/DomainCarousel.tsx";
import ExcerptCard from "../item/ExcerptCard";

export interface HorizontalExcerptCarouselProps {
  excerptList: UnitDTO[];
  className?: string;
}

export const HorizontalExcerptCarousel: React.FC<
  HorizontalExcerptCarouselProps
> = ({ excerptList, className }) => {
  if (!excerptList.length) {
    return null;
  }

  return (
    <DomainCarousel
      items={excerptList}
      itemKey={(item) => item.id}
      itemClassName="pl-4 basis-[100%] lg:basis-[50%] xl:basis-[40%]"
      className={className}
      ariaLabel="Excerpts"
      renderItem={(item) => <ExcerptCard excerpt={item} />}
    />
  );
};

export default HorizontalExcerptCarousel;
