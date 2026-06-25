import { zoneSectionInfiniteQuery } from "@rezics/contract/api/zone/zone";
import type { ZoneStreamSection as ZoneStreamSectionConfig } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Button } from "@rezics/ui/shadcn";
import { useInfiniteQuery } from "@tanstack/react-query";
import { QueryErrorDisplay } from "@/core";
import { StreamRenderer } from "@/stream";
import {
  useZoneSectionTitle,
  type ZonePortalContext,
  ZoneSectionShell,
} from "./shared";

/**
 * Renders zone-owned stream rows through the shared stream renderer, so stream
 * sections and query-stream sections use the same type-dispatched card surface.
 * 渲染专区 section 返回的 stream rows；stream section 与 query stream section
 * 共用同一套按 type 分发的内容流卡片。
 */
export function ZoneStreamSection({
  section,
  ctx,
}: {
  section: ZoneStreamSectionConfig;
  ctx: ZonePortalContext;
}) {
  const { t } = useTranslation(["common", "zone"]);
  const title = useZoneSectionTitle(section, ctx.refUnits);
  const query = useInfiniteQuery(
    zoneSectionInfiniteQuery(ctx.zone.unitId, ctx.pageId, section.id, {
      languages: ctx.languages,
      appLocale: ctx.appLocale,
    }),
  );
  const rows = query.data?.pages.flatMap((page) => page.rows ?? []) ?? [];

  return (
    <ZoneSectionShell title={title}>
      {query.isError && rows.length === 0 ? (
        <QueryErrorDisplay error={query.error} />
      ) : (
        <StreamRenderer
          rows={rows}
          loading={query.isLoading}
          emptyTitle={t("zone:section_empty")}
        />
      )}
      {query.isError && rows.length > 0 ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => void query.refetch()}
          >
            {t("common:retry")}
          </Button>
        </div>
      ) : null}
      {!query.isLoading && !query.isError && query.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {query.isFetchingNextPage ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size="sm" />
                {t("common:loading")}
              </span>
            ) : (
              t("common:load_more")
            )}
          </Button>
        </div>
      ) : null}
      {!query.isLoading &&
      !query.isError &&
      rows.length > 0 &&
      !query.hasNextPage ? (
        <p className="text-center text-xs leading-dense text-text-tertiary">
          {t("common:end_of_list")}
        </p>
      ) : null}
    </ZoneSectionShell>
  );
}
