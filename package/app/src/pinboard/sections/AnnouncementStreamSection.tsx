import { getDefaultRealmId } from "@rezics/api/infra/bootstrap";
import { Skeleton } from "@rezics/ui/shadcn";
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

export interface AnnouncementStreamSectionProps {
  /**
   * Render the announcement list. Invoked with `null` while loading
   * unless a custom `loadingFallback` is provided.
   * 渲染公告列表。加载期间会以 `null` 调用，除非提供了自定义的
   * `loadingFallback`。
   */
  children: (items: PinboardAnnouncementItem[]) => React.ReactNode;
  loadingFallback?: React.ReactNode;
  /**
   * When provided, used as the link target for each announcement.
   * 提供时，作为每条公告的链接目标。
   */
  linkFor?: (unitId: string) => string;
  /**
   * Realm override — defaults to the bootstrapped default realm id.
   * realm 覆盖项——默认使用引导得到的默认 realm id。
   */
  realmUnitId?: string;
}

/**
 * Homepage announcement source. Returns the resolved announcements for
 * the default realm via render prop so existing consumers (the bar, the
 * notice board) can keep owning their own presentation.
 *
 * Falls back to rendering nothing when the default realm id has not
 * bootstrapped yet — the infra hook populates it on first load.
 * 首页公告数据源。通过 render prop 返回默认 realm 已解析的公告，
 * 让现有的消费方（顶栏、公告板）继续掌控各自的展示。
 *
 * 当默认 realm id 尚未引导完成时回退为不渲染任何内容——infra hook
 * 会在首次加载时填充它。
 */
export const AnnouncementStreamSection: React.FC<
  AnnouncementStreamSectionProps
> = ({ children, loadingFallback, linkFor, realmUnitId }) => {
  const resolvedRealmUnitId = realmUnitId ?? getDefaultRealmId() ?? "";
  const { entries, isLoading } = usePinboardList({
    realmUnitId: resolvedRealmUnitId,
    pinboardKey: "announcement",
    enabled: resolvedRealmUnitId.length > 0,
  });

  if (!resolvedRealmUnitId) return null;

  if (isLoading) {
    return (
      <>{loadingFallback ?? <Skeleton className="w-full h-10 rounded-md" />}</>
    );
  }

  const items = entries.map((e) => toItem(e, linkFor));
  return <>{children(items)}</>;
};

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
