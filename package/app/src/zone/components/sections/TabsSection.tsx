import type { ZoneTabsSection } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@rezics/ui/shadcn";
import {
  useZoneSectionTitle,
  type ZonePortalContext,
  ZoneSectionShell,
} from "./shared";
import { ZoneContentSectionList } from "./ZoneContentSections";

/**
 * Base UI tab panels stay unmounted until activated, so each pane's
 * sections (and their per-section data queries) hydrate lazily on first
 * activation.
 * Base UI 的标签面板在激活前不挂载，因此每个面板的分区（及其按分区的
 * 数据查询）在首次激活时才惰性水合。
 */
export function TabsSection({
  section,
  ctx,
}: {
  section: ZoneTabsSection;
  ctx: ZonePortalContext;
}) {
  const { t } = useTranslation(["zone"]);
  const title = useZoneSectionTitle(section, ctx.refUnits);
  if (section.tabs.length === 0) return null;
  const defaultTab = section.defaultTabId ?? section.tabs[0]?.id;

  const tabLabel = (tab: { titleLabelUnitId?: string }) =>
    (tab.titleLabelUnitId ? ctx.refUnits[tab.titleLabelUnitId]?.title : null) ??
    t("zone:tab_all");

  return (
    <ZoneSectionShell title={title}>
      <Tabs defaultValue={defaultTab}>
        <TabsList className="mb-4">
          {section.tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tabLabel(tab)}
            </TabsTrigger>
          ))}
        </TabsList>
        {section.tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id}>
            <ZoneContentSectionList sections={tab.sections} ctx={ctx} />
          </TabsContent>
        ))}
      </Tabs>
    </ZoneSectionShell>
  );
}
