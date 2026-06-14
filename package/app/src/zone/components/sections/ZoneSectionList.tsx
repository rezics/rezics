import type { ZonePageSection } from "@rezics/contract";
import { ColumnsSection } from "./ColumnsSection";
import type { ZonePortalContext } from "./shared";
import { StageSection } from "./StageSection";
import { TabsSection } from "./TabsSection";
import { ZoneContentSectionView } from "./ZoneContentSections";

function ZoneSectionView({
  section,
  ctx,
}: {
  section: ZonePageSection;
  ctx: ZonePortalContext;
}) {
  if (section.kind === "stage") {
    return <StageSection section={section} ctx={ctx} />;
  }
  if (section.kind === "columns") {
    return <ColumnsSection section={section} ctx={ctx} />;
  }
  if (section.kind === "tabs") {
    return <TabsSection section={section} ctx={ctx} />;
  }
  return <ZoneContentSectionView section={section} ctx={ctx} />;
}

/**
 * Top-level page section list: the only place `columns` may appear, per
 * the contract nesting rules.
 * 页面顶层分区列表：按契约嵌套规则，`columns` 只允许出现在这里。
 */
export function ZoneSectionList({
  sections,
  ctx,
}: {
  sections: ZonePageSection[];
  ctx: ZonePortalContext;
}) {
  return (
    <div className="flex flex-col gap-12">
      {sections.map((section) => (
        <ZoneSectionView key={section.id} section={section} ctx={ctx} />
      ))}
    </div>
  );
}
