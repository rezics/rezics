import type { UnitDTO } from "@rezics/contract";
import { unitHref } from "@rezics/ui/primitive/link";

export function buildUnitUrl(unit: UnitDTO): string {
  switch (unit.type) {
    case "BOOK":
      return `/book/${unit.id}`;
    case "POST":
      return `/review/${unit.id}`;
    case "QUOTE":
      return `/excerpt/${unit.id}`;
    case "SHELF":
      // SHELF helper needs owner context; UnitDTO does not carry it. Until the
      // owner slug is plumbed through, fall back to the canonical unitId form.
      return `/shelf/${unit.id}`;
    case "TAG":
      return unitHref({ type: "TAG", unitId: unit.id, slug: unit.slug ?? null });
    case "REALM":
      return unitHref({
        type: "REALM",
        unitId: unit.id,
        slug: unit.slug ?? null,
      });
    case "USER":
      return unitHref({ type: "USER", unitId: unit.id, slug: unit.slug ?? null });
    case "ZONE":
      return unitHref({ type: "ZONE", unitId: unit.id, slug: unit.slug ?? null });
    case "ENTITY":
      return unitHref({
        type: "ENTITY",
        unitId: unit.id,
        slug: unit.slug ?? null,
      });
    default:
      return unit.slug ? `/unit/${unit.slug}` : `/unit/id/${unit.id}`;
  }
}
