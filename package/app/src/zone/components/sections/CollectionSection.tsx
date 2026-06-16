import type { ZoneCollectionSection } from "@rezics/contract";
import {
  zoneLinkFallbackKey,
  zoneLinkHref,
  zoneLinkLabel,
} from "../../models/zoneMenu";
import {
  useZoneLabelResolver,
  useZoneSectionTitle,
  type ZonePortalContext,
  ZoneSectionEmpty,
  ZoneSectionShell,
} from "./shared";
import { ZoneItemList, type ZoneListEntry } from "./ZoneItemList";

/**
 * Collection items are config-side `{target, labelUnitId?}`; labels and
 * hrefs resolve through the portal ref-unit map. Items whose label cannot
 * resolve are dropped rather than rendered as raw ids.
 * 集合条目是配置侧的 `{target, labelUnitId?}`；标签与 href 通过门户
 * 引用 Unit 映射解析。无法解析标签的条目直接丢弃，而非渲染原始 id。
 */
export function CollectionSection({
  section,
  ctx,
}: {
  section: ZoneCollectionSection;
  ctx: ZonePortalContext;
}) {
  const { zone, refUnits } = ctx;
  const title = useZoneSectionTitle(section, refUnits);
  const resolveLabel = useZoneLabelResolver();
  const linkCtx = { zoneSlug: zone.slug, pages: zone.pages, refUnits };

  const entries: ZoneListEntry[] = section.items.flatMap((item, index) => {
    const href = zoneLinkHref(item.target, linkCtx);
    const label = resolveLabel(
      zoneLinkLabel(item, refUnits),
      zoneLinkFallbackKey(item.target),
    );
    if (!href || !label) return [];
    const ref = item.displayUnitId
      ? refUnits[item.displayUnitId]
      : item.target.kind === "unit"
        ? refUnits[item.target.unitId]
        : undefined;
    return [
      {
        key: `${section.id}:${index}`,
        unitId: ref?.unitId,
        href,
        label,
        summary: ref?.summary,
        imageUrl: ref?.imageUrl,
        type: ref?.type,
      },
    ];
  });

  if (entries.length === 0) {
    return <ZoneSectionEmpty title={title} emptyState={section.emptyState} />;
  }

  return (
    <ZoneSectionShell title={title}>
      <ZoneItemList entries={entries} display={section.display} />
    </ZoneSectionShell>
  );
}
