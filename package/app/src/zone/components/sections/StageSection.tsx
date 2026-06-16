import type {
  ZoneContentSection,
  ZoneStageChildSection,
  ZoneStageSection,
} from "@rezics/contract";
import type { CSSProperties } from "react";
import { ColumnsSection } from "./ColumnsSection";
import type { ZonePortalContext } from "./shared";
import { TabsSection } from "./TabsSection";
import { ZoneContentSectionView } from "./ZoneContentSections";

function ZoneInfo({
  section,
  ctx,
}: {
  section: Extract<ZoneStageChildSection, { kind: "zoneInfo" }>;
  ctx: ZonePortalContext;
}) {
  const showTitle = section.showTitle !== false;
  const showDescription = section.showDescription !== false;
  if (!showTitle && !showDescription) return null;
  return (
    <div className="flex max-w-3xl flex-col items-start gap-4">
      {showTitle ? (
        <h1 className="text-3xl font-semibold leading-ui text-text-primary">
          {ctx.zone.name}
        </h1>
      ) : null}
      {showDescription && ctx.zone.description ? (
        <p className="text-base leading-body text-text-secondary">
          {ctx.zone.description}
        </p>
      ) : null}
    </div>
  );
}

function StageChildView({
  section,
  ctx,
}: {
  section: ZoneStageChildSection;
  ctx: ZonePortalContext;
}) {
  if (section.kind === "zoneInfo") {
    return <ZoneInfo section={section} ctx={ctx} />;
  }
  if (section.kind === "columns") {
    return <ColumnsSection section={section} ctx={ctx} />;
  }
  if (section.kind === "tabs") {
    return <TabsSection section={section} ctx={ctx} />;
  }
  return (
    <ZoneContentSectionView section={section as ZoneContentSection} ctx={ctx} />
  );
}

function stageStyle(section: ZoneStageSection): CSSProperties {
  return {
    backgroundColor: section.background?.color ?? "var(--zone-color-surface)",
  };
}

/**
 * Decorated stage container: background and mask wrap explicit child sections.
 * stage 装饰容器：背景与蒙板包裹显式子分区。
 *
 * Mobile:
 * | rounded stage                         |
 * | background / mask                     |
 * | zoneInfo or authored child sections   |
 * | children stack with readable spacing  |
 *
 * Tablet:
 * | stage uses same full parent width; child columns may stack by own rules |
 *
 * Desktop:
 * | stage keeps rounded surface, md:px-12 md:py-16, children stay ordered |
 *
 * Ultra-wide:
 * | stage stays inside page max-width; no viewport-wide stretch. |
 */
export function StageSection({
  section,
  ctx,
}: {
  section: ZoneStageSection;
  ctx: ZonePortalContext;
}) {
  const backgroundFit = section.background?.fit ?? "cover";
  const backgroundPosition = section.background?.position ?? "center";
  const hasMask = Boolean(section.mask?.color || section.mask?.opacity != null);

  return (
    <section
      className="relative isolate overflow-hidden rounded-lg bg-surface-subtle"
      style={stageStyle(section)}
    >
      {section.background?.imageUrl ? (
        <img
          src={section.background.imageUrl}
          alt=""
          className="absolute inset-0 -z-20 size-full"
          style={{
            objectFit: backgroundFit,
            objectPosition: backgroundPosition,
          }}
        />
      ) : null}
      {hasMask ? (
        <div
          className="absolute inset-0 -z-10"
          style={{
            backgroundColor: section.mask?.color ?? "black",
            opacity: section.mask?.opacity ?? 0.35,
          }}
        />
      ) : null}
      <div className="flex flex-col gap-10 px-6 py-12 md:px-12 md:py-16">
        {section.sections.map((child) => (
          <StageChildView key={child.id} section={child} ctx={ctx} />
        ))}
      </div>
    </section>
  );
}
