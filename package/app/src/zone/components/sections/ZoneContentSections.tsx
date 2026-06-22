import type { ZoneContentSection } from "@rezics/contract";
import { ActionsSection } from "./ActionsSection";
import { CollectionSection } from "./CollectionSection";
import { ImageSection } from "./ImageSection";
import { QuerySection } from "./QuerySection";
import { RichTextSection } from "./RichTextSection";
import { SourcesSection } from "./SourcesSection";
import { StatsSection } from "./StatsSection";
import type { ZonePortalContext } from "./shared";
import { ZoneStreamSection } from "./ZoneStreamSection";

/**
 * Dispatch for the 7 content primitives. Containers (`tabs`, `columns`)
 * live one layer up so their panes can only nest content sections —
 * mirroring the contract's union layering.
 * 7 个内容原语的分发。容器（`tabs`、`columns`）位于上一层，使其面板
 * 只能嵌套内容分区——与契约中的联合分层一致。
 */
export function ZoneContentSectionView({
  section,
  ctx,
}: {
  section: ZoneContentSection;
  ctx: ZonePortalContext;
}) {
  switch (section.kind) {
    case "image":
      return <ImageSection section={section} ctx={ctx} />;
    case "actions":
      return <ActionsSection section={section} ctx={ctx} />;
    case "richText":
      return <RichTextSection section={section} ctx={ctx} />;
    case "collection":
      return <CollectionSection section={section} ctx={ctx} />;
    case "query":
      return <QuerySection section={section} ctx={ctx} />;
    case "stream":
      return <ZoneStreamSection section={section} ctx={ctx} />;
    case "stats":
      return <StatsSection section={section} ctx={ctx} />;
    case "sources":
      return <SourcesSection section={section} ctx={ctx} />;
    default: {
      const _exhaustive: never = section;
      return _exhaustive;
    }
}

export function ZoneContentSectionList({
  sections,
  ctx,
}: {
  sections: ZoneContentSection[];
  ctx: ZonePortalContext;
}) {
  return (
    <div className="flex flex-col gap-10">
      {sections.map((section) => (
        <ZoneContentSectionView key={section.id} section={section} ctx={ctx} />
      ))}
    </div>
  );
}
