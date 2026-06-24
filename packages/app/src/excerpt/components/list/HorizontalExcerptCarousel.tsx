import { useTranslation } from "@rezics/i18n/react";
import { useReactionHydration } from "@rezics/contract/api/reaction/reaction";
import type { UnitDTO } from "@rezics/contract";
import { DomainCarousel } from "@rezics/ui/composite/carousel/DomainCarousel.tsx";
import type * as React from "react";
import { useMemo } from "react";
import { ExcerptCard } from "../item/ExcerptCard";

export interface HorizontalExcerptCarouselProps {
  excerptList: UnitDTO[];
  className?: string;
}

export const HorizontalExcerptCarousel: React.FC<
  HorizontalExcerptCarouselProps
> = ({ excerptList, className }) => {
  const { t } = useTranslation("book");
  const targetIds = useMemo(
    () => excerptList.map((u) => u.id).filter(Boolean) as string[],
    [excerptList],
  );
  useReactionHydration(targetIds);

  if (!excerptList.length) {
    return null;
  }

  return (
    <DomainCarousel
      items={excerptList}
      itemKey={(item) => item.id}
      itemClassName="pl-4 basis-[100%] lg:basis-[50%] xl:basis-[40%]"
      className={className}
      ariaLabel={t("excerpts")}
      wheelScroll
      renderItem={(item) => <ExcerptCard excerpt={item} />}
    />
  );
};
