import { zoneSectionInfiniteQuery } from "@rezics/api";
import type { ZoneStatsSection } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Skeleton } from "@rezics/ui/shadcn";
import { useInfiniteQuery } from "@tanstack/react-query";
import { QueryErrorDisplay } from "@/core";
import {
  useZoneSectionTitle,
  type ZonePortalContext,
  ZoneSectionEmpty,
  ZoneSectionShell,
} from "./shared";

/**
 * 领域统计部分。显示领域指标的关键统计数据（文章数、成员数等）。
 *
 * 布局结构：
 *
 * Loading State:
 * ┌────────────────────────────┐
 * │ [Skeleton bar]             │
 * └────────────────────────────┘
 *
 * Success State (2 metrics):
 * ┌────────────────────────────┐
 * │ Articles    │ Members      │
 * │ 1,234       │ 567          │
 * └────────────────────────────┘
 *
 * Success State (full width):
 * ┌──────────────────────────────────────┐
 * │ Articles    │ Members      │ Views    │
 * │ 1,234       │ 567          │ 8,901    │
 * └──────────────────────────────────────┘
 *
 * Mobile:
 * ┌─────────────────┐
 * │ Metric    │ Val │
 * │ ──────────────── │
 * │ Metric    │ Val │
 * │ ──────────────── │
 * │ Metric    │ Val │
 * └─────────────────┘
 */
export function StatsSection({
  section,
  ctx,
}: {
  section: ZoneStatsSection;
  ctx: ZonePortalContext;
}) {
  const { t } = useTranslation(["zone"]);
  const title = useZoneSectionTitle(section, ctx.refUnits);
  const query = useInfiniteQuery(
    zoneSectionInfiniteQuery(
      ctx.zone.unitId,
      ctx.pageId,
      section.id,
      ctx.languages,
    ),
  );

  if (query.isLoading) {
    return (
      <ZoneSectionShell title={title}>
        <Skeleton className="h-16 w-full max-w-md" />
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

  const stats = query.data?.pages[0]?.stats;
  if (!stats || section.metrics.length === 0) {
    return <ZoneSectionEmpty title={title} emptyState={section.emptyState} />;
  }

  return (
    <ZoneSectionShell title={title}>
      <dl className="grid max-w-md grid-cols-2 gap-3">
        {section.metrics.map((metric) => (
          <div key={metric} className="rounded-md bg-surface-subtle px-4 py-3">
            <dt className="text-xs leading-dense text-text-secondary">
              {metric === "articles"
                ? t("zone:stats_articles")
                : t("zone:stats_members")}
            </dt>
            <dd className="mt-1 text-2xl font-semibold leading-ui text-text-primary">
              {(stats[metric] ?? 0).toLocaleString()}
            </dd>
          </div>
        ))}
      </dl>
    </ZoneSectionShell>
  );
}
