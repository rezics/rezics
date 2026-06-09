import type {
  ZoneColumnsSection,
  ZoneContentSection,
  ZoneTabsSection,
} from "@rezics/contract";
import { cn } from "@/shared/utils/css-util";
import type { ZonePortalContext } from "./shared";
import { TabsSection } from "./TabsSection";
import { ZoneContentSectionView } from "./ZoneContentSections";

function PaneSectionList({
  sections,
  ctx,
}: {
  sections: (ZoneContentSection | ZoneTabsSection)[];
  ctx: ZonePortalContext;
}) {
  return (
    <div className="flex flex-col gap-10">
      {sections.map((section) =>
        section.kind === "tabs" ? (
          <TabsSection key={section.id} section={section} ctx={ctx} />
        ) : (
          <ZoneContentSectionView
            key={section.id}
            section={section}
            ctx={ctx}
          />
        ),
      )}
    </div>
  );
}

/**
 * Side/main layout; the side column stacks under main on mobile regardless
 * of `sidePosition` (DOM order is main-first, desktop order flips via
 * grid order).
 * 边栏/主栏布局；移动端无论 `sidePosition` 为何，边栏都堆叠在主栏之下
 * （DOM 顺序主栏在前，桌面端通过 grid order 翻转）。
 */
export function ColumnsSection({
  section,
  ctx,
}: {
  section: ZoneColumnsSection;
  ctx: ZonePortalContext;
}) {
  const sideLeft = section.sidePosition === "left";
  return (
    <div
      className={cn(
        "grid gap-10",
        sideLeft
          ? "lg:grid-cols-[18rem_minmax(0,1fr)]"
          : "lg:grid-cols-[minmax(0,1fr)_18rem]",
      )}
    >
      <div className={cn("min-w-0", sideLeft && "lg:order-last")}>
        <PaneSectionList sections={section.main} ctx={ctx} />
      </div>
      <aside className={cn("min-w-0", sideLeft && "lg:order-first")}>
        <PaneSectionList sections={section.side} ctx={ctx} />
      </aside>
    </div>
  );
}
