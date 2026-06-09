import type { ZoneDTO, ZonePage, ZoneSection } from "@rezics/contract";

export type ZoneSectionSource = Pick<ZoneDTO, "pages" | "sections">;

export const ZONE_SECTION_KINDS = [
  "latestContent",
  "popularContent",
  "feed",
  "reviewStream",
  "shelfCarousel",
  "realmList",
  "tagNavigation",
  "wikiCollection",
  "manualContent",
  "manualLinks",
] as const satisfies readonly ZoneSection["kind"][];

export type ZoneSectionPrimitive =
  | "manualContent"
  | "configuredLinkList"
  | "zoneScopedData";

export function zoneHomePage(zone: ZoneSectionSource): ZonePage | null {
  if (zone.pages?.home) return zone.pages.home;
  if (zone.sections) {
    return {
      sections: zone.sections,
    };
  }
  return null;
}

export function zoneHomeSections(zone: ZoneSectionSource): ZoneSection[] {
  return zoneHomePage(zone)?.sections ?? [];
}

export function zoneSectionPrimitive(
  section: Pick<ZoneSection, "kind">,
): ZoneSectionPrimitive {
  if (section.kind === "manualContent") return "manualContent";
  if (
    section.kind === "manualLinks" ||
    section.kind === "shelfCarousel" ||
    section.kind === "realmList" ||
    section.kind === "tagNavigation" ||
    section.kind === "wikiCollection"
  ) {
    return "configuredLinkList";
  }
  return "zoneScopedData";
}
