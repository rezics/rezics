import { useReactionHydration } from "@rezics/api/reaction/reaction";
import type { ShelfDTO } from "@rezics/contract";
import * as m from "@rezics/i18n/messages";
import { DomainCarousel } from "@rezics/ui/composite/carousel/DomainCarousel.tsx";
import type * as React from "react";
import { useMemo } from "react";
import { ShelfCard } from "./ShelfCard";

export interface HorizontalShelfCarouselProps {
  shelves: ShelfDTO[];
  className?: string;
}

const SHELF_ITEM_CLASS =
  "pl-4 basis-[90%] @xs:basis-[60%] @sm:basis-[50%] @md:basis-[45%] @lg:basis-[30%] @xl:basis-[25%] @2xl:basis-[20%]";

export const HorizontalShelfCarousel: React.FC<
  HorizontalShelfCarouselProps
> = ({ shelves, className }) => {
  const targetIds = useMemo(
    () => shelves.map((s) => s.unitId).filter(Boolean) as string[],
    [shelves],
  );
  useReactionHydration(targetIds);
  return (
    <DomainCarousel
      items={shelves}
      itemKey={(_shelf, index) => index}
      itemClassName={SHELF_ITEM_CLASS}
      className={className}
      ariaLabel={m.shelf_list_title()}
      renderItem={(item) => <ShelfCard shelf={item} />}
    />
  );
};
