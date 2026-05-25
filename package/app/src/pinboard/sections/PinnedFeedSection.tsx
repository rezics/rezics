import type React from "react";
import { PinboardEntryCard } from "../components/PinboardEntryCard";
import { PinboardErrorState } from "../components/PinboardErrorState";
import { PinboardSkeleton } from "../components/PinboardSkeleton";
import { usePinboardList } from "../hooks/usePinboard";
import { useMessage } from "@rezics/i18n/react";
import {
  pinboard_pinned_heading,
  pinboard_pinned_region,
} from "@rezics/i18n/messages";
const i18nMessages = {
  pinboard_pinned_heading,
  pinboard_pinned_region,
};

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
      <p className="px-1 text-xs font-medium uppercase tracking-wider text-text-secondary">
        {m.pinboard_pinned_heading()}
      </p>
      <div className="flex flex-col gap-2 mt-1">
        {entries.map((entry) => (
          <PinboardEntryCard
            key={entry.unitId}
            entry={entry}
            variant="card"
            href={linkFor?.(entry.unitId)}
          />
        ))}
      </div>
    </section>
  );
};
