import { useTranslation } from "@rezics/i18n/react";
import { DomainCarousel } from "@rezics/ui/composite/carousel/DomainCarousel.tsx";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@rezics/ui/shadcn";
import { ChevronDown, ChevronUp } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { PinboardEntryCard } from "../components/PinboardEntryCard";
import { PinboardErrorState } from "../components/PinboardErrorState";
import { PinboardSkeleton } from "../components/PinboardSkeleton";
import { usePinboardList } from "../hooks/usePinboard";

export interface PinnedFeedSectionProps {
  realmUnitId: string;
  /**
   * When provided, used as the link target for each card (e.g. "/post/{unitId}").
   * 提供时，用作每张卡片的链接目标（例如 "/post/{unitId}"）。
   */
  linkFor?: (unitId: string) => string;
}

const PINNED_ITEM_CLASS =
  "pl-4 basis-[82%] @sm:basis-[58%] @md:basis-[42%] @lg:basis-[34%] @xl:basis-[30%]";

/**
 * Renders the pinned region above a realm feed. No-ops when the list is
 * empty, silent on errors in the feed-adjacent position to avoid crowding
 * the viewport — errors still surface via the skeleton fallback state.
 * 在 realm feed 上方渲染置顶区域。列表为空时不渲染任何内容；在紧邻 feed 的位置
 * 对错误保持静默，以免拥挤视口——错误仍会通过骨架屏回退状态显现。
 */
export const PinnedFeedSection: React.FC<PinnedFeedSectionProps> = ({
  realmUnitId,
  linkFor,
}) => {
  const { t } = useTranslation(["entity"]);
  const [open, setOpen] = useState(true);
  const { entries, isLoading, isError, refetch } = usePinboardList({
    realmUnitId,
    pinboardKey: "pinboard",
  });

  if (isLoading) {
    return (
      <div className="mb-4">
        <PinboardSkeleton rows={2} rowHeight={112} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mb-4">
        <PinboardErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  if (entries.length === 0) return null;

  return (
    <section className="mb-4" aria-label={t("entity:pinboard_pinned_region")}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium leading-ui text-text-primary transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus">
          <span>{t("entity:pinboard_pinned_heading")}</span>
          {open ? (
            <ChevronUp className="h-4 w-4 text-text-secondary" />
          ) : (
            <ChevronDown className="h-4 w-4 text-text-secondary" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <DomainCarousel
            items={entries}
            itemKey={(entry) => entry.unitId}
            itemClassName={PINNED_ITEM_CLASS}
            ariaLabel={t("entity:pinboard_pinned_region")}
            renderItem={(entry) => (
              <PinboardEntryCard
                entry={entry}
                variant="pinned"
                href={linkFor?.(entry.unitId) ?? `/unit/${entry.unitId}`}
              />
            )}
          />
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
};
