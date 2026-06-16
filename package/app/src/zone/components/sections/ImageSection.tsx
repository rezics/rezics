import type { ZoneImageSection } from "@rezics/contract";
import { AppSafeLink as SafeLink } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util";
import { zoneLinkHref, zoneRouteLocationFromZone } from "../../models/zoneMenu";
import {
  useZoneSectionTitle,
  type ZonePortalContext,
  ZoneSectionShell,
} from "./shared";

function imageClass(variant: ZoneImageSection["variant"]) {
  switch (variant) {
    case "banner":
      return "aspect-[16/5] w-full rounded-md object-cover";
    case "logo":
      return "size-24 rounded-md object-cover";
    default:
      return "max-h-[28rem] max-w-full rounded-md object-contain";
  }
}

/**
 * Ordered image section for banners, logos, and inline media.
 * 可排序图片分区，用于横幅、标识与正文图片。
 *
 * Mobile:
 * | optional title       |
 * | image max-width 100% |
 *
 * Tablet:
 * | optional title       |
 * | banner/logo/inline   |
 *
 * Desktop:
 * | content follows parent width; banner keeps 16:5 ratio. |
 *
 * Ultra-wide:
 * | image remains constrained by parent container, not viewport width. |
 */
export function ImageSection({
  section,
  ctx,
}: {
  section: ZoneImageSection;
  ctx: ZonePortalContext;
}) {
  const title = useZoneSectionTitle(section, ctx.refUnits);
  const alt = section.altLabelUnitId
    ? (ctx.refUnits[section.altLabelUnitId]?.title ?? "")
    : "";
  const image = (
    <img src={section.url} alt={alt} className={imageClass(section.variant)} />
  );
  const href = section.target
    ? zoneLinkHref(section.target, {
        routeLocation: zoneRouteLocationFromZone(ctx.zone),
        pages: ctx.zone.pages,
        refUnits: ctx.refUnits,
      })
    : null;

  return (
    <ZoneSectionShell title={title}>
      {href ? (
        <SafeLink href={href} className={cn("inline-flex w-fit max-w-full")}>
          {image}
        </SafeLink>
      ) : (
        image
      )}
    </ZoneSectionShell>
  );
}
