import type {
  PageColumnsSection,
  PageContentSection,
  PageTabsSection,
} from "@rezics/contract";
import type { CSSProperties } from "react";
import { zoneColumnsGridTemplate } from "../../models/zoneColumns";
import type { ZonePortalContext } from "./shared";
import { TabsSection } from "./TabsSection";
import { ZoneContentSectionView } from "./ZoneContentSections";

function PaneSectionList({
  sections,
  ctx,
}: {
  sections: (PageContentSection | PageTabsSection)[];
  ctx: ZonePortalContext;
}) {
  return (
    <div className="flex flex-col gap-10">
      {sections.map((section) =>
        section.kind === "tabs" ? (
          <TabsSection key={section.nodeId} section={section} ctx={ctx} />
        ) : (
          <ZoneContentSectionView
            key={section.nodeId}
            section={section}
            ctx={ctx}
          />
        ),
      )}
    </div>
  );
}

/**
 * Ordered column layout. Ratios are runtime data, so desktop tracks are passed
 * through a native CSS variable instead of dynamic UnoCSS classes; smaller
 * viewports stack in authored source order.
 * 有序列布局。比例是运行时数据，因此桌面端轨道通过原生 CSS 变量传递，
 * 而不是动态 UnoCSS class；较小视口按作者配置顺序堆叠。
 */
export function ColumnsSection({
  section,
  ctx,
}: {
  section: PageColumnsSection;
  ctx: ZonePortalContext;
}) {
  const columnsTemplate = zoneColumnsGridTemplate(section.columns);

  return (
    <div
      className="zone-columns-section grid gap-10"
      style={
        {
          "--zone-columns-template": columnsTemplate,
        } as CSSProperties
      }
    >
      {section.columns.map((column, columnIndex) => (
        <div key={columnIndex} className="min-w-0">
          <PaneSectionList sections={column.sections} ctx={ctx} />
        </div>
      ))}
    </div>
  );
}
