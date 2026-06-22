import type { UnitDTO } from "@rezics/contract";
import { unitHref } from "@/shared/ui/link";

export function buildUnitUrl(unit: UnitDTO): string {
  switch (unit.type) {
    case "BOOK":
    case "POST":
    case "QUOTE":
    case "POLL":
    case "SHELF":
      return unitHref({ type: unit.type, unitId: unit.id });
    case "TAG":
    case "REALM":
    case "USER":
    case "ZONE":
    case "ENTITY":
      return unitHref({
        type: unit.type,
        unitId: unit.id,
        slug: unit.slug ?? null,
      });
    default:
      return unit.slug ? `/unit/${unit.slug}` : `/unit/id/${unit.id}`;
  }
}
