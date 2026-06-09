import type { ZoneDTO, ZonePage, ZoneSection } from "@rezics/contract";

export type ZoneSectionSource = Pick<ZoneDTO, "pages" | "sections">;

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
