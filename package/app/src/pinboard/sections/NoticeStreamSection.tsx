import { getDefaultRealmId } from "@rezics/api/infra/bootstrap";
import { Skeleton } from "@rezics/ui/shadcn";
import type React from "react";
import { usePinboardList } from "../hooks/usePinboard";
import type { PinboardEntryView } from "../models/types";

export interface PinboardNoticeItem {
  id: string;
  unitId: string;
  title: string;
  content: string;
  date: string;
  pin?: boolean;
  link?: string;
}

export interface NoticeStreamSectionProps {
  /**
   * Render the notice list. Invoked after loading with entries resolved from
   * the default realm home Pinboard.
   */
  children: (items: PinboardNoticeItem[]) => React.ReactNode;
  loadingFallback?: React.ReactNode;
  /**
   * When provided, used as the link target for each notice item.
   */
  linkFor?: (unitId: string) => string;
  /**
   * Realm override; defaults to the bootstrapped default realm id.
   */
  realmUnitId?: string;
}

/**
 * Homepage notice source. It reads the bootstrapped default realm's home
 * Pinboard and leaves presentation to the caller.
 */
export const NoticeStreamSection: React.FC<NoticeStreamSectionProps> = ({
  children,
  loadingFallback,
  linkFor,
  realmUnitId,
}) => {
  const resolvedRealmUnitId = realmUnitId ?? getDefaultRealmId() ?? "";
  const { entries, isLoading } = usePinboardList({
    realmUnitId: resolvedRealmUnitId,
    pinboardPlacement: "home",
    enabled: resolvedRealmUnitId.length > 0,
  });

  if (!resolvedRealmUnitId) return null;

  if (isLoading) {
    return (
      <>{loadingFallback ?? <Skeleton className="h-10 w-full rounded-md" />}</>
    );
  }

  const items = entries.map((entry) => toItem(entry, linkFor));
  return <>{children(items)}</>;
};

function toItem(
  entry: PinboardEntryView,
  linkFor?: (unitId: string) => string,
): PinboardNoticeItem {
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
