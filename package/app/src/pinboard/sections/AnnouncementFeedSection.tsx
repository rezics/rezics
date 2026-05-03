import { Skeleton } from "@rezics/ui/shadcn";
import { getDefaultRealmId } from "@rezics/api/infra/bootstrap";
import type React from "react";
import { usePinboardList } from "../hooks/usePinboard";
import type { PinboardEntryView } from "../models/types";

export interface PinboardAnnouncementItem {
  id: string;
  unitId: string;
  title: string;
  content: string;
  date: string;
  pin?: boolean;
  link?: string;
}

export interface AnnouncementFeedSectionProps {
  /**
   * Render the announcement list. Invoked with `null` while loading
   * unless a custom `loadingFallback` is provided.
   */
  children: (items: PinboardAnnouncementItem[]) => React.ReactNode;
  loadingFallback?: React.ReactNode;
  /** When provided, used as the link target for each announcement. */
  linkFor?: (unitId: string) => string;
  /** Realm override — defaults to the bootstrapped default realm id. */
  realmUnitId?: string;
}

function toItem(
  entry: PinboardEntryView,
  linkFor?: (unitId: string) => string,
): PinboardAnnouncementItem {
  return {
    id: entry.unitId,
    unitId: entry.unitId,
    title: entry.title ?? "",
    content: entry.summary ?? "",
    date: entry.updatedAt ?? entry.createdAt ?? new Date().toISOString(),
    pin: true,
    link: linkFor?.(entry.unitId),
  };
}

/**
 * Homepage announcement source. Returns the resolved announcements for
 * the default realm via render prop so existing consumers (the bar, the
 * notice board) can keep owning their own presentation.
 *
 * Falls back to rendering nothing when the default realm id has not
 * bootstrapped yet — the infra hook populates it on first load.
 */
export const AnnouncementFeedSection: React.FC<AnnouncementFeedSectionProps> =
  ({ children, loadingFallback, linkFor, realmUnitId }) => {
    const resolvedRealmUnitId = realmUnitId ?? getDefaultRealmId() ?? "";
    const { entries, isLoading } = usePinboardList({
      realmUnitId: resolvedRealmUnitId,
      pinboardKey: "announcement",
      enabled: resolvedRealmUnitId.length > 0,
    });

    if (!resolvedRealmUnitId) return null;

    if (isLoading) {
      return (
        <>
          {loadingFallback ?? (
            <Skeleton className="w-full h-10 rounded-md" />
          )}
        </>
      );
    }

    const items = entries.map((e) => toItem(e, linkFor));
    return <>{children(items)}</>;
  };
