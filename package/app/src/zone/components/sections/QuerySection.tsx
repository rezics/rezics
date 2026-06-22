import { zoneSectionInfiniteQuery } from "@rezics/api";
import type { ZoneQuerySection } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Skeleton } from "@rezics/ui/shadcn";
import { useInfiniteQuery } from "@tanstack/react-query";
import { QueryErrorDisplay } from "@/core";
import { LoadMoreFooter } from "@/shared/ui/LoadMoreFooter";
import { StreamRenderer } from "@/stream";
import {
  zoneRouteLocationFromZone,
  zoneSectionItemHref,
} from "../../models/zoneMenu";
import {
  useZoneSectionTitle,
  type ZonePortalContext,
  ZoneSectionEmpty,
  ZoneSectionShell,
} from "./shared";
import { ZoneItemList, type ZoneListEntry } from "./ZoneItemList";

/**
 * Query sections hydrate lazily per section id; the server compiles the
 * section query intersected with the zone boundary, so the client only
 * pages the cursor.
 * 查询分区按分区 id 惰性水合；服务端编译分区查询并与专区边界取交集，
 * 客户端只负责游标翻页。
 */
export function QuerySection({
  section,
  ctx,
}: {
  section: ZoneQuerySection;
  ctx: ZonePortalContext;
}) {
  const { t } = useTranslation(["zone"]);
  const { zone, refUnits } = ctx;
  const routeLocation = zoneRouteLocationFromZone(zone);
  const title = useZoneSectionTitle(section, refUnits);
  const dynamicTagUnitIds = ctx.dynamicTagSelections?.[section.id] ?? [];
  const query = useInfiniteQuery(
    zoneSectionInfiniteQuery(
      zone.unitId,
      ctx.pageId,
      section.id,
      {
        languages: ctx.languages,
        appLocale: ctx.appLocale,
      },
      { dynamicTagUnitIds },
    ),
  );

  if (query.isLoading) {
    return (
      <ZoneSectionShell title={title}>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </ZoneSectionShell>
    );
  }
  if (query.isError) {
    return (
      <ZoneSectionShell title={title}>
        <QueryErrorDisplay error={query.error} />
      </ZoneSectionShell>
    );
  }

  const rows = query.data?.pages.flatMap((page) => page.rows ?? []) ?? [];
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const isStream = section.display === "stream";
  const hasContent = isStream ? rows.length > 0 : items.length > 0;
  if (!hasContent) {
    return <ZoneSectionEmpty title={title} emptyState={section.emptyState} />;
  }

  const entries: ZoneListEntry[] = items.map((item) => ({
    key: item.unitId,
    unitId: item.unitId,
    href: zoneSectionItemHref(item, routeLocation),
    label: item.title ?? item.slug ?? item.unitId,
    summary: item.summary,
    imageUrl: item.imageUrl,
    type: item.type,
  }));

  const showLoadMore = Boolean(section.loadMore) && query.hasNextPage;

  return (
    <ZoneSectionShell title={title}>
      {isStream ? (
        <StreamRenderer rows={rows} emptyTitle={t("zone:section_empty")} />
      ) : (
        <ZoneItemList entries={entries} display={section.display} />
      )}
      {showLoadMore && (
        <LoadMoreFooter
          hasNextPage={query.hasNextPage}
          isFetchingNextPage={query.isFetchingNextPage}
          fetchNextPage={query.fetchNextPage}
        />
      )}
    </ZoneSectionShell>
  );
}
