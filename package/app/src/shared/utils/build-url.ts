import type { UnitDTO } from "@rezics/contract";
import { unitHref } from "@/shared/ui/link";

export function buildUnitUrl(unit: UnitDTO): string {
  switch (unit.type) {
    case "BOOK":
      return `/book/${unit.id}`;
    case "POST":
      return `/review/${unit.id}`;
    case "QUOTE":
      return `/excerpt/${unit.id}`;
    case "POLL":
      return `/poll/${unit.id}`;
    case "SHELF":
      // SHELF helper needs owner context; UnitDTO does not carry it. Until the
      // owner slug is plumbed through, fall back to the canonical unitId form.
      // SHELF 辅助函数需要 owner 上下文；UnitDTO 并不携带它。在 owner slug 接入之前，
      // 回退到规范的 unitId 形式。
      return `/shelf/${unit.id}`;
    case "TAG":
      return unitHref({
        type: "TAG",
        unitId: unit.id,
        slug: unit.slug ?? null,
      });
    case "REALM":
      return unitHref({
        type: "REALM",
        unitId: unit.id,
        slug: unit.slug ?? null,
      });
    case "USER":
      return unitHref({
        type: "USER",
        unitId: unit.id,
        slug: unit.slug ?? null,
      });
    case "ZONE":
      return unitHref({
        type: "ZONE",
        unitId: unit.id,
        slug: unit.slug ?? null,
      });
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
