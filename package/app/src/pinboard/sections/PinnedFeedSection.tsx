import {
  pinboard_pinned_heading,
  pinboard_pinned_region,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { DomainCarousel } from "@rezics/ui/composite/carousel/DomainCarousel.tsx";
import type React from "react";
import { PinboardEntryCard } from "../components/PinboardEntryCard";
import { PinboardErrorState } from "../components/PinboardErrorState";
import { PinboardSkeleton } from "../components/PinboardSkeleton";
import { usePinboardList } from "../hooks/usePinboard";

const i18nMessages = {
  pinboard_pinned_heading,
  pinboard_pinned_region,
};

const PINNED_ITEM_CLASS =
  "pl-4 basis-[90%] @sm:basis-[70%] @md:basis-[52%] @lg:basis-[44%] @xl:basis-[36%]";

export interface PinnedFeedSectionProps {
  realmUnitId: string;
  /** When provided, used as the link target for each card (e.g. "/post/{unitId}"). */
  linkFor?: (unitId: string) => string;
}

/**
 * Renders the pinned region above a realm feed. No-ops when the list is
 * empty, silent on errors in the feed-adjacent position to avoid crowding
 * the viewport — errors still surface via the skeleton fallback state.
 */
export const PinnedFeedSection: React.FC<PinnedFeedSectionProps> = ({
  realmUnitId,
  linkFor,
}) => {
  const m = useMessage(i18nMessages);
  const { entries, isLoading, isError, refetch } = usePinboardList({
    realmUnitId,
    pinboardKey: "pinboard",
  });

  if (isLoading) {
    return (
      <div className="mb-4">
        <PinboardSkeleton rows={2} rowHeight={64} />
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
    <section className="mb-4" aria-label={m.pinboard_pinned_region()}>
      <p className="px-1 text-xs font-medium uppercase leading-ui text-text-secondary">
        {m.pinboard_pinned_heading()}
      </p>
      <DomainCarousel
        items={entries}
        itemKey={(entry) => entry.unitId}
        itemClassName={PINNED_ITEM_CLASS}
        className="mt-2"
        ariaLabel={m.pinboard_pinned_region()}
        renderItem={(entry) => (
          <PinboardEntryCard
            entry={entry}
            variant="card"
            href={linkFor?.(entry.unitId)}
          />
        )}
      />
    </section>
  );
};
