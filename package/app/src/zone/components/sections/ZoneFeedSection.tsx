import type { ZoneFeedSection as ZoneFeedSectionConfig } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { FeedSection } from "@/feed";
import {
  useZoneSectionTitle,
  type ZonePortalContext,
  ZoneSectionShell,
} from "./shared";

/**
 * Reuses the app feed surface with the zone scope; the server intersects
 * the zone boundary into the feed query.
 * 复用应用 feed 界面并使用专区 scope；服务端将专区边界并入 feed 查询。
 */
export function ZoneFeedSection({
  section,
  ctx,
}: {
  section: ZoneFeedSectionConfig;
  ctx: ZonePortalContext;
}) {
  const { t } = useTranslation(["zone"]);
  const title = useZoneSectionTitle(section, ctx.refUnits);

  return (
    <ZoneSectionShell title={title}>
      <FeedSection
        query={{
          scope: "zone",
          zoneUnitId: ctx.zone.unitId,
          ...(section.limit ? { limit: section.limit } : {}),
          // "updates" is a chronological preset; other feed kinds keep the
          // feed service's default ranking.
          // "updates" 是按时间排序的预设；其他 feed 类型沿用 feed 服务的
          // 默认排序。
          ...(section.feedKind === "updates" ? { sort: "new" as const } : {}),
        }}
        emptyTitle={t("zone:section_empty")}
      />
    </ZoneSectionShell>
  );
}
